#pragma once

#include "songstick/song.h"

#include <cstddef>
#include <cstdint>
#include <string>
#include <vector>

namespace songstick {

struct ByteSpan {
    const std::uint8_t* data{nullptr};
    std::size_t size{0};
};

enum class DiagnosticSeverity : std::uint8_t {
    warning,
    error,
};

struct Diagnostic {
    DiagnosticSeverity severity{DiagnosticSeverity::error};
    std::string code;
    std::string message;
    std::uint64_t tick{0};
};

struct MidiSummary {
    std::uint16_t format{0};
    std::uint16_t ticks_per_quarter{0};
    std::string track_name;
    std::uint32_t midi_event_count{0};
    std::uint32_t note_count{0};
    std::uint32_t tempo_change_count{0};
    std::uint8_t minimum_pitch{0};
    std::uint8_t maximum_pitch{0};
    std::uint64_t duration_microseconds{0};
    std::uint8_t time_signature_numerator{0};
    std::uint8_t time_signature_denominator{0};
};

struct PlayablePosition {
    std::uint8_t midi_pitch{0};
    Position position{};
};

struct InstrumentProfile {
    std::string id;
    std::string name;
    std::vector<PlayablePosition> positions;
};

struct ImportLimits {
    std::size_t maximum_file_bytes{1024U * 1024U};
    std::uint32_t maximum_events{100'000};
    std::uint32_t maximum_notes{20'000};
};

struct ImportResult {
    bool success{false};
    MidiSummary summary{};
    Song song{};
    std::vector<Diagnostic> diagnostics;
};

[[nodiscard]] InstrumentProfile provisional_a_mixolydian_profile();

[[nodiscard]] ImportResult import_midi_format_zero(
    ByteSpan bytes,
    const InstrumentProfile& instrument,
    const ImportLimits& limits = {});

}  // namespace songstick
