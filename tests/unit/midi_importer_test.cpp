#include "songstick/midi_importer.h"

#include <cstdint>
#include <cstdlib>
#include <iostream>
#include <string_view>
#include <vector>

namespace {

int failures = 0;

void check(bool condition, std::string_view expression, int line) {
    if (!condition) {
        std::cerr << "line " << line << ": check failed: " << expression << '\n';
        ++failures;
    }
}

#define CHECK(expression) check((expression), #expression, __LINE__)

void append_be16(std::vector<std::uint8_t>& bytes, std::uint16_t value) {
    bytes.push_back(static_cast<std::uint8_t>(value >> 8U));
    bytes.push_back(static_cast<std::uint8_t>(value & 0xFFU));
}

void append_be32(std::vector<std::uint8_t>& bytes, std::uint32_t value) {
    bytes.push_back(static_cast<std::uint8_t>(value >> 24U));
    bytes.push_back(static_cast<std::uint8_t>((value >> 16U) & 0xFFU));
    bytes.push_back(static_cast<std::uint8_t>((value >> 8U) & 0xFFU));
    bytes.push_back(static_cast<std::uint8_t>(value & 0xFFU));
}

std::vector<std::uint8_t> midi_file(
    const std::vector<std::uint8_t>& track,
    std::uint16_t format = 0,
    std::uint16_t tracks = 1) {
    std::vector<std::uint8_t> bytes{'M', 'T', 'h', 'd'};
    append_be32(bytes, 6);
    append_be16(bytes, format);
    append_be16(bytes, tracks);
    append_be16(bytes, 480);
    bytes.insert(bytes.end(), {'M', 'T', 'r', 'k'});
    append_be32(bytes, static_cast<std::uint32_t>(track.size()));
    bytes.insert(bytes.end(), track.begin(), track.end());
    return bytes;
}

std::vector<std::uint8_t> valid_track() {
    return {
        0x00, 0xFF, 0x03, 0x04, 'T', 'e', 's', 't',
        0x00, 0xFF, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08,
        0x00, 0xFF, 0x51, 0x03, 0x07, 0xA1, 0x20,
        0x00, 0x90, 0x32, 0x64,
        0x83, 0x60, 0x32, 0x00,
        0x00, 0xFF, 0x51, 0x03, 0x0F, 0x42, 0x40,
        0x00, 0x34, 0x64,
        0x83, 0x60, 0x34, 0x00,
        0x00, 0xFF, 0x2F, 0x00,
    };
}

songstick::ImportResult import(const std::vector<std::uint8_t>& bytes) {
    return songstick::import_midi_format_zero(
        {bytes.data(), bytes.size()}, songstick::provisional_a_mixolydian_profile());
}

bool has_code(const songstick::ImportResult& result, std::string_view code) {
    for (const auto& diagnostic : result.diagnostics) {
        if (diagnostic.code == code) return true;
    }
    return false;
}

void test_provisional_profile() {
    const auto profile = songstick::provisional_a_mixolydian_profile();
    CHECK(profile.positions.size() == 39);
    CHECK(profile.positions[0].midi_pitch == 45);
    CHECK(profile.positions[0].position.string_index == 0);
    CHECK(profile.positions[0].position.fret == 0);
    CHECK(profile.positions[3].midi_pitch == 50);
    CHECK(profile.positions[3].position.string_index == 0);
    CHECK(profile.positions[3].position.fret == 3);
    CHECK(profile.positions[13].midi_pitch == 52);
    CHECK(profile.positions[13].position.string_index == 1);
    CHECK(profile.positions[13].position.fret == 0);
    CHECK(profile.positions[16].midi_pitch == 57);
    CHECK(profile.positions[16].position.string_index == 1);
    CHECK(profile.positions[16].position.fret == 3);
    CHECK(profile.positions[29].midi_pitch == 62);
}

void test_valid_running_status_and_tempo_map() {
    const auto bytes = midi_file(valid_track());
    const auto result = import(bytes);
    CHECK(result.success);
    CHECK(result.summary.format == 0);
    CHECK(result.summary.ticks_per_quarter == 480);
    CHECK(result.summary.track_name == "Test");
    CHECK(result.summary.note_count == 2);
    CHECK(result.summary.tempo_change_count == 2);
    CHECK(result.summary.minimum_pitch == 50);
    CHECK(result.summary.maximum_pitch == 52);
    CHECK(result.summary.duration_microseconds == 1'500'000);
    CHECK(result.summary.time_signature_numerator == 4);
    CHECK(result.summary.time_signature_denominator == 4);
    CHECK(result.song.events.size() == 2);
    CHECK(result.song.events[0].start_microseconds == 0);
    CHECK(result.song.events[0].duration_microseconds == 500'000);
    CHECK(result.song.events[0].position.fret == 3);
    CHECK(result.song.events[1].start_microseconds == 500'000);
    CHECK(result.song.events[1].duration_microseconds == 1'000'000);
    CHECK(result.song.events[1].position.fret == 4);
}

void test_open_string_fingering() {
    const auto open_note = import(midi_file({
        0x00, 0x90, 0x2D, 0x64,
        0x83, 0x60, 0x2D, 0x00,
        0x00, 0xFF, 0x2F, 0x00,
    }));
    CHECK(open_note.success);
    CHECK(open_note.song.events.size() == 1);
    CHECK(open_note.song.events[0].midi_pitch == 45);
    CHECK(open_note.song.events[0].position.string_index == 0);
    CHECK(open_note.song.events[0].position.fret == 0);
}

void test_rejections_are_structured() {
    const auto empty = import({});
    CHECK(!empty.success);
    CHECK(has_code(empty, "MIDI_EMPTY"));

    const auto format_one = import(midi_file(valid_track(), 1, 1));
    CHECK(!format_one.success);
    CHECK(has_code(format_one, "MIDI_FORMAT_UNSUPPORTED"));

    auto truncated = midi_file(valid_track());
    truncated.pop_back();
    CHECK(has_code(import(truncated), "MIDI_TRUNCATED_TRACK"));

    const auto invalid_vlq = import(midi_file({0x81, 0x80, 0x80, 0x80}));
    CHECK(!invalid_vlq.success);
    CHECK(has_code(invalid_vlq, "MIDI_INVALID_DELTA"));
}

void test_polyphony_and_unplayable_pitch() {
    const auto polyphonic = import(midi_file({
        0x00, 0x90, 0x32, 0x64,
        0x00, 0x90, 0x34, 0x64,
        0x83, 0x60, 0x80, 0x32, 0x00,
        0x00, 0x80, 0x34, 0x00,
        0x00, 0xFF, 0x2F, 0x00,
    }));
    CHECK(!polyphonic.success);
    CHECK(has_code(polyphonic, "MIDI_POLYPHONY"));

    const auto unplayable = import(midi_file({
        0x00, 0x90, 0x14, 0x64,
        0x83, 0x60, 0x90, 0x14, 0x00,
        0x00, 0xFF, 0x2F, 0x00,
    }));
    CHECK(!unplayable.success);
    CHECK(has_code(unplayable, "MIDI_PITCH_UNPLAYABLE"));

    const auto percussion = import(midi_file({
        0x00, 0x99, 0x32, 0x64,
        0x83, 0x60, 0x99, 0x32, 0x00,
        0x00, 0xFF, 0x2F, 0x00,
    }));
    CHECK(!percussion.success);
    CHECK(has_code(percussion, "MIDI_PERCUSSION_UNSUPPORTED"));
}

}  // namespace

int main() {
    test_provisional_profile();
    test_valid_running_status_and_tempo_map();
    test_open_string_fingering();
    test_rejections_are_structured();
    test_polyphony_and_unplayable_pitch();

    if (failures != 0) {
        std::cerr << failures << " MIDI test assertion(s) failed\n";
        return EXIT_FAILURE;
    }
    std::cout << "All MIDI importer tests passed\n";
    return EXIT_SUCCESS;
}
