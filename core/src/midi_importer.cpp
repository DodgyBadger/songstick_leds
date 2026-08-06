#include "songstick/midi_importer.h"

#include <algorithm>
#include <array>
#include <limits>
#include <tuple>

namespace songstick {
namespace {

constexpr std::uint32_t default_tempo_microseconds = 500'000;

class Reader {
public:
    explicit Reader(ByteSpan bytes) : bytes_(bytes) {}

    bool read_u8(std::uint8_t& value) noexcept {
        if (remaining() < 1) return false;
        value = bytes_.data[position_++];
        return true;
    }

    bool read_be16(std::uint16_t& value) noexcept {
        std::uint8_t high = 0;
        std::uint8_t low = 0;
        if (!read_u8(high) || !read_u8(low)) return false;
        value = static_cast<std::uint16_t>(
            (static_cast<std::uint16_t>(high) << 8U) | static_cast<std::uint16_t>(low));
        return true;
    }

    bool read_be32(std::uint32_t& value) noexcept {
        std::uint8_t bytes[4]{};
        if (!read_u8(bytes[0]) || !read_u8(bytes[1]) || !read_u8(bytes[2]) ||
            !read_u8(bytes[3])) {
            return false;
        }
        value = (static_cast<std::uint32_t>(bytes[0]) << 24U) |
                (static_cast<std::uint32_t>(bytes[1]) << 16U) |
                (static_cast<std::uint32_t>(bytes[2]) << 8U) |
                static_cast<std::uint32_t>(bytes[3]);
        return true;
    }

    bool read_vlq(std::uint32_t& value) noexcept {
        value = 0;
        for (int count = 0; count < 4; ++count) {
            std::uint8_t byte = 0;
            if (!read_u8(byte)) return false;
            value = (value << 7U) | static_cast<std::uint32_t>(byte & 0x7FU);
            if ((byte & 0x80U) == 0) return true;
        }
        return false;
    }

    bool skip(std::size_t count) noexcept {
        if (count > remaining()) return false;
        position_ += count;
        return true;
    }

    bool subspan(std::size_t count, ByteSpan& span) noexcept {
        if (count > remaining()) return false;
        span = {bytes_.data + position_, count};
        position_ += count;
        return true;
    }

    [[nodiscard]] std::size_t remaining() const noexcept { return bytes_.size - position_; }
    [[nodiscard]] std::size_t position() const noexcept { return position_; }

private:
    ByteSpan bytes_{};
    std::size_t position_{0};
};

struct RawNote {
    std::uint64_t start_tick{0};
    std::uint64_t end_tick{0};
    std::uint8_t pitch{0};
    std::uint8_t velocity{0};
    std::uint8_t channel{0};
};

struct ActiveNote {
    bool active{false};
    std::uint64_t start_tick{0};
    std::uint8_t velocity{0};
};

struct TempoEvent {
    std::uint64_t tick{0};
    std::uint32_t microseconds_per_quarter{default_tempo_microseconds};
};

void add_diagnostic(
    ImportResult& result,
    DiagnosticSeverity severity,
    const char* code,
    const std::string& message,
    std::uint64_t tick = 0) {
    result.diagnostics.push_back({severity, code, message, tick});
}

bool has_errors(const ImportResult& result) {
    return std::any_of(
        result.diagnostics.begin(), result.diagnostics.end(), [](const Diagnostic& diagnostic) {
            return diagnostic.severity == DiagnosticSeverity::error;
        });
}

bool read_signature(Reader& reader, const std::array<std::uint8_t, 4>& expected) noexcept {
    for (const auto expected_byte : expected) {
        std::uint8_t actual = 0;
        if (!reader.read_u8(actual) || actual != expected_byte) return false;
    }
    return true;
}

std::uint64_t saturating_add(std::uint64_t left, std::uint64_t right) noexcept {
    const auto maximum = std::numeric_limits<std::uint64_t>::max();
    return right > maximum - left ? maximum : left + right;
}

std::uint64_t saturating_multiply(std::uint64_t left, std::uint64_t right) noexcept {
    if (left == 0 || right == 0) return 0;
    const auto maximum = std::numeric_limits<std::uint64_t>::max();
    return left > maximum / right ? maximum : left * right;
}

std::uint64_t ticks_to_microseconds(
    std::uint64_t tick,
    const std::vector<TempoEvent>& tempos,
    std::uint16_t division) noexcept {
    std::uint64_t resolved = 0;
    std::uint64_t previous_tick = 0;
    std::uint32_t tempo = default_tempo_microseconds;

    for (const auto& event : tempos) {
        if (event.tick > tick) break;
        const auto delta = event.tick - previous_tick;
        const auto whole = delta / division;
        const auto remainder = delta % division;
        resolved = saturating_add(
            resolved,
            saturating_add(
                saturating_multiply(whole, tempo),
                saturating_multiply(remainder, tempo) / division));
        previous_tick = event.tick;
        tempo = event.microseconds_per_quarter;
    }

    const auto delta = tick - previous_tick;
    const auto whole = delta / division;
    const auto remainder = delta % division;
    return saturating_add(
        resolved,
        saturating_add(
            saturating_multiply(whole, tempo),
            saturating_multiply(remainder, tempo) / division));
}

std::string stable_id(ByteSpan bytes) {
    std::uint64_t hash = 14'695'981'039'346'656'037ULL;
    for (std::size_t index = 0; index < bytes.size; ++index) {
        hash ^= bytes.data[index];
        hash *= 1'099'511'628'211ULL;
    }
    constexpr char hex[] = "0123456789abcdef";
    std::string id = "midi-";
    id.reserve(21);
    for (int shift = 60; shift >= 0; shift -= 4) {
        id.push_back(hex[(hash >> static_cast<unsigned int>(shift)) & 0x0FU]);
    }
    return id;
}

bool parse_channel_event(
    Reader& reader,
    std::uint8_t status,
    bool has_first_data,
    std::uint8_t first_data,
    std::uint64_t tick,
    std::array<std::array<ActiveNote, 128>, 16>& active,
    std::vector<RawNote>& notes,
    ImportResult& result,
    const ImportLimits& limits) {
    const auto type = static_cast<std::uint8_t>(status & 0xF0U);
    const auto channel = static_cast<std::uint8_t>(status & 0x0FU);
    const int data_count = (type == 0xC0U || type == 0xD0U) ? 1 : 2;
    std::uint8_t data[2]{};
    int offset = 0;
    if (has_first_data) data[offset++] = first_data;
    while (offset < data_count) {
        if (!reader.read_u8(data[offset])) {
            add_diagnostic(result, DiagnosticSeverity::error, "MIDI_TRUNCATED_EVENT", "Channel event data is truncated.", tick);
            return false;
        }
        ++offset;
    }
    for (int index = 0; index < data_count; ++index) {
        if (data[index] >= 0x80U) {
            add_diagnostic(result, DiagnosticSeverity::error, "MIDI_INVALID_DATA_BYTE", "Channel event contains an invalid data byte.", tick);
            return false;
        }
    }

    if (type != 0x80U && type != 0x90U) return true;
    const auto pitch = data[0];
    const bool note_on = type == 0x90U && data[1] != 0;
    auto& slot = active[channel][pitch];
    if (note_on) {
        if (slot.active) {
            add_diagnostic(result, DiagnosticSeverity::error, "MIDI_REPEATED_NOTE_ON", "A note starts again before its matching note off.", tick);
            return true;
        }
        slot = {true, tick, data[1]};
        return true;
    }

    if (!slot.active) {
        add_diagnostic(result, DiagnosticSeverity::error, "MIDI_UNMATCHED_NOTE_OFF", "A note off has no matching active note.", tick);
        return true;
    }
    if (notes.size() >= limits.maximum_notes) {
        add_diagnostic(result, DiagnosticSeverity::error, "MIDI_NOTE_LIMIT", "The MIDI file exceeds the configured note limit.", tick);
        return false;
    }
    if (tick == slot.start_tick) {
        add_diagnostic(result, DiagnosticSeverity::error, "MIDI_ZERO_DURATION_NOTE", "A note has zero duration.", tick);
    } else {
        notes.push_back({slot.start_tick, tick, pitch, slot.velocity, channel});
    }
    slot = {};
    return true;
}

}  // namespace

InstrumentProfile provisional_a_mixolydian_profile() {
    constexpr std::array<std::uint8_t, 3> open_pitches{45, 52, 57};
    constexpr std::array<std::uint8_t, 12> fret_offsets{2, 4, 5, 7, 9, 10, 12, 14, 16, 17, 19, 21};
    InstrumentProfile profile{"provisional-a-mixolydian-v2", "Provisional A Mixolydian (A2 E3 A3 with open)", {}};
    profile.positions.reserve(open_pitches.size() * (fret_offsets.size() + 1));
    for (std::size_t string_index = 0; string_index < open_pitches.size(); ++string_index) {
        profile.positions.push_back({
            open_pitches[string_index],
            {static_cast<std::uint8_t>(string_index), 0},
        });
        for (std::size_t fret_index = 0; fret_index < fret_offsets.size(); ++fret_index) {
            profile.positions.push_back({
                static_cast<std::uint8_t>(open_pitches[string_index] + fret_offsets[fret_index]),
                {static_cast<std::uint8_t>(string_index), static_cast<std::uint8_t>(fret_index + 1)},
            });
        }
    }
    return profile;
}

ImportResult import_midi_format_zero(
    ByteSpan bytes,
    const InstrumentProfile& instrument,
    const ImportLimits& limits) {
    ImportResult result{};
    if (bytes.data == nullptr || bytes.size == 0) {
        add_diagnostic(result, DiagnosticSeverity::error, "MIDI_EMPTY", "The uploaded file is empty.");
        return result;
    }
    if (bytes.size > limits.maximum_file_bytes) {
        add_diagnostic(result, DiagnosticSeverity::error, "MIDI_FILE_LIMIT", "The uploaded file exceeds the configured 1 MiB limit.");
        return result;
    }

    Reader reader(bytes);
    if (!read_signature(reader, {'M', 'T', 'h', 'd'})) {
        add_diagnostic(result, DiagnosticSeverity::error, "MIDI_HEADER_SIGNATURE", "The file does not start with a valid MThd header.");
        return result;
    }
    std::uint32_t header_length = 0;
    std::uint16_t track_count = 0;
    if (!reader.read_be32(header_length) || header_length < 6 ||
        !reader.read_be16(result.summary.format) || !reader.read_be16(track_count) ||
        !reader.read_be16(result.summary.ticks_per_quarter)) {
        add_diagnostic(result, DiagnosticSeverity::error, "MIDI_TRUNCATED_HEADER", "The MIDI header is truncated or invalid.");
        return result;
    }
    if (header_length > 6 && !reader.skip(header_length - 6)) {
        add_diagnostic(result, DiagnosticSeverity::error, "MIDI_TRUNCATED_HEADER", "The declared MIDI header length exceeds the file.");
        return result;
    }
    if (result.summary.format != 0 || track_count != 1) {
        add_diagnostic(result, DiagnosticSeverity::error, "MIDI_FORMAT_UNSUPPORTED", "This slice accepts only Standard MIDI File format 0 with one track.");
        return result;
    }
    if ((result.summary.ticks_per_quarter & 0x8000U) != 0 || result.summary.ticks_per_quarter == 0) {
        add_diagnostic(result, DiagnosticSeverity::error, "MIDI_DIVISION_UNSUPPORTED", "SMPTE or zero MIDI time division is unsupported.");
        return result;
    }
    if (!read_signature(reader, {'M', 'T', 'r', 'k'})) {
        add_diagnostic(result, DiagnosticSeverity::error, "MIDI_TRACK_SIGNATURE", "The format-0 MIDI track chunk is missing.");
        return result;
    }
    std::uint32_t track_length = 0;
    ByteSpan track_bytes{};
    if (!reader.read_be32(track_length) || !reader.subspan(track_length, track_bytes)) {
        add_diagnostic(result, DiagnosticSeverity::error, "MIDI_TRUNCATED_TRACK", "The declared track length exceeds the uploaded file.");
        return result;
    }
    if (reader.remaining() != 0) {
        add_diagnostic(result, DiagnosticSeverity::warning, "MIDI_TRAILING_BYTES", "Bytes after the format-0 track were ignored.");
    }

    Reader track(track_bytes);
    std::array<std::array<ActiveNote, 128>, 16> active{};
    std::vector<RawNote> raw_notes;
    std::vector<TempoEvent> tempos;
    std::uint64_t tick = 0;
    std::uint8_t running_status = 0;
    bool end_of_track = false;

    while (track.remaining() > 0 && !end_of_track) {
        if (result.summary.midi_event_count >= limits.maximum_events) {
            add_diagnostic(result, DiagnosticSeverity::error, "MIDI_EVENT_LIMIT", "The track exceeds the configured event limit.", tick);
            break;
        }
        ++result.summary.midi_event_count;
        std::uint32_t delta = 0;
        if (!track.read_vlq(delta) || tick > std::numeric_limits<std::uint64_t>::max() - delta) {
            add_diagnostic(result, DiagnosticSeverity::error, "MIDI_INVALID_DELTA", "A delta-time value is truncated, too long, or overflows.", tick);
            break;
        }
        tick += delta;

        std::uint8_t first = 0;
        if (!track.read_u8(first)) {
            add_diagnostic(result, DiagnosticSeverity::error, "MIDI_TRUNCATED_EVENT", "The track ends before an event status.", tick);
            break;
        }
        bool has_first_data = first < 0x80U;
        std::uint8_t status = first;
        if (has_first_data) {
            if (running_status == 0) {
                add_diagnostic(result, DiagnosticSeverity::error, "MIDI_RUNNING_STATUS", "Running status is used before a channel status byte.", tick);
                break;
            }
            status = running_status;
        }

        if (status >= 0x80U && status <= 0xEFU) {
            running_status = status;
            if (!parse_channel_event(track, status, has_first_data, first, tick, active, raw_notes, result, limits)) break;
            continue;
        }
        if (status == 0xFFU) {
            std::uint8_t type = 0;
            std::uint32_t length = 0;
            ByteSpan payload{};
            if (!track.read_u8(type) || !track.read_vlq(length) || !track.subspan(length, payload)) {
                add_diagnostic(result, DiagnosticSeverity::error, "MIDI_TRUNCATED_META", "A meta-event length exceeds the track.", tick);
                break;
            }
            if (type == 0x2FU) {
                if (length != 0) add_diagnostic(result, DiagnosticSeverity::warning, "MIDI_END_TRACK_LENGTH", "End-of-track metadata should have zero length.", tick);
                end_of_track = true;
            } else if (type == 0x51U) {
                if (length != 3) {
                    add_diagnostic(result, DiagnosticSeverity::error, "MIDI_TEMPO_LENGTH", "Set Tempo must contain exactly three bytes.", tick);
                } else {
                    const auto tempo = (static_cast<std::uint32_t>(payload.data[0]) << 16U) |
                                       (static_cast<std::uint32_t>(payload.data[1]) << 8U) |
                                       static_cast<std::uint32_t>(payload.data[2]);
                    if (tempo == 0) add_diagnostic(result, DiagnosticSeverity::error, "MIDI_TEMPO_ZERO", "Set Tempo cannot be zero.", tick);
                    else tempos.push_back({tick, tempo});
                }
            } else if (type == 0x03U) {
                result.summary.track_name.assign(
                    reinterpret_cast<const char*>(payload.data), payload.size);
            } else if (type == 0x58U && length >= 2) {
                result.summary.time_signature_numerator = payload.data[0];
                if (payload.data[1] <= 7) {
                    result.summary.time_signature_denominator = static_cast<std::uint8_t>(1U << payload.data[1]);
                }
            }
            continue;
        }
        if (status == 0xF0U || status == 0xF7U) {
            std::uint32_t length = 0;
            if (!track.read_vlq(length) || !track.skip(length)) {
                add_diagnostic(result, DiagnosticSeverity::error, "MIDI_TRUNCATED_SYSEX", "A SysEx event length exceeds the track.", tick);
                break;
            }
            running_status = 0;
            continue;
        }
        int system_data_count = -1;
        if (status == 0xF1U || status == 0xF3U) system_data_count = 1;
        else if (status == 0xF2U) system_data_count = 2;
        else if (status == 0xF6U || status == 0xF8U || status == 0xFAU ||
                 status == 0xFBU || status == 0xFCU || status == 0xFEU) {
            system_data_count = 0;
        }
        if (system_data_count >= 0) {
            bool valid = true;
            for (int index = 0; index < system_data_count; ++index) {
                std::uint8_t ignored = 0;
                if (!track.read_u8(ignored) || ignored >= 0x80U) valid = false;
            }
            if (!valid) {
                add_diagnostic(result, DiagnosticSeverity::error, "MIDI_TRUNCATED_SYSTEM_EVENT", "A system event is truncated or invalid.", tick);
                break;
            }
            if (status < 0xF8U) running_status = 0;
            continue;
        }
        add_diagnostic(result, DiagnosticSeverity::error, "MIDI_SYSTEM_EVENT_UNSUPPORTED", "Unsupported system event in Standard MIDI File.", tick);
        break;
    }

    if (end_of_track && track.remaining() != 0) {
        add_diagnostic(result, DiagnosticSeverity::warning, "MIDI_DATA_AFTER_END_TRACK", "Data after the End of Track event was ignored.", tick);
    }

    if (!end_of_track && !has_errors(result)) {
        add_diagnostic(result, DiagnosticSeverity::warning, "MIDI_END_TRACK_MISSING", "The track has no End of Track event.", tick);
    }
    for (std::size_t channel = 0; channel < active.size(); ++channel) {
        for (std::size_t pitch = 0; pitch < active[channel].size(); ++pitch) {
            if (active[channel][pitch].active) {
                add_diagnostic(result, DiagnosticSeverity::error, "MIDI_NOTE_STILL_ACTIVE", "A note is still active at the end of the track.", tick);
            }
        }
    }

    std::sort(raw_notes.begin(), raw_notes.end(), [](const RawNote& left, const RawNote& right) {
        return std::tie(left.start_tick, left.pitch, left.channel) <
               std::tie(right.start_tick, right.pitch, right.channel);
    });
    for (std::size_t index = 1; index < raw_notes.size(); ++index) {
        if (raw_notes[index].start_tick < raw_notes[index - 1].end_tick) {
            add_diagnostic(result, DiagnosticSeverity::error, "MIDI_POLYPHONY", "The selected format-0 track contains overlapping notes.", raw_notes[index].start_tick);
            break;
        }
    }
    if (raw_notes.empty() && !has_errors(result)) {
        add_diagnostic(result, DiagnosticSeverity::error, "MIDI_NO_NOTES", "The MIDI track contains no complete notes.");
    }

    result.summary.note_count = static_cast<std::uint32_t>(raw_notes.size());
    result.summary.tempo_change_count = static_cast<std::uint32_t>(tempos.size());
    if (!raw_notes.empty()) {
        result.summary.minimum_pitch = raw_notes.front().pitch;
        result.summary.maximum_pitch = raw_notes.front().pitch;
        for (const auto& note : raw_notes) {
            result.summary.minimum_pitch = std::min(result.summary.minimum_pitch, note.pitch);
            result.summary.maximum_pitch = std::max(result.summary.maximum_pitch, note.pitch);
        }
    }

    Song converted{stable_id(bytes), result.summary.track_name.empty() ? "Imported MIDI" : result.summary.track_name, {}};
    converted.events.reserve(raw_notes.size());
    bool has_previous = false;
    Position previous{};
    for (const auto& note : raw_notes) {
        const auto start = ticks_to_microseconds(note.start_tick, tempos, result.summary.ticks_per_quarter);
        const auto end = ticks_to_microseconds(note.end_tick, tempos, result.summary.ticks_per_quarter);
        result.summary.duration_microseconds = std::max(result.summary.duration_microseconds, end);
        if (note.channel == 9) {
            add_diagnostic(result, DiagnosticSeverity::error, "MIDI_PERCUSSION_UNSUPPORTED", "Percussion channel 10 is not supported as a melody source.", note.start_tick);
            continue;
        }
        const PlayablePosition* best = nullptr;
        std::tuple<unsigned int, unsigned int, unsigned int, unsigned int> best_score{};
        for (const auto& candidate : instrument.positions) {
            if (candidate.midi_pitch != note.pitch) continue;
            const auto fret_movement = has_previous
                ? static_cast<unsigned int>(candidate.position.fret > previous.fret
                    ? candidate.position.fret - previous.fret
                    : previous.fret - candidate.position.fret)
                : 0U;
            const auto string_change = has_previous && candidate.position.string_index != previous.string_index ? 1U : 0U;
            const auto score = std::make_tuple(
                fret_movement,
                string_change,
                static_cast<unsigned int>(candidate.position.fret),
                static_cast<unsigned int>(candidate.position.string_index));
            if (best == nullptr || score < best_score) {
                best = &candidate;
                best_score = score;
            }
        }
        if (best == nullptr) {
            add_diagnostic(result, DiagnosticSeverity::error, "MIDI_PITCH_UNPLAYABLE", "MIDI pitch " + std::to_string(note.pitch) + " is not available in the provisional instrument profile.", note.start_tick);
            continue;
        }
        converted.events.push_back({
            start,
            end > start ? end - start : 0,
            best->position,
            note.pitch,
            note.velocity,
            0,
            note.channel,
        });
        previous = best->position;
        has_previous = true;
    }

    result.song = std::move(converted);
    result.success = !has_errors(result) && !result.song.events.empty();
    return result;
}

}  // namespace songstick
