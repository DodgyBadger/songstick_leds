#pragma once

#include <cstdint>
#include <string>
#include <vector>

namespace songstick {

struct Position {
    std::uint8_t string_index{0};
    std::uint8_t fret{0};
};

constexpr bool operator==(const Position& left, const Position& right) noexcept {
    return left.string_index == right.string_index && left.fret == right.fret;
}

struct NoteEvent {
    std::uint64_t start_microseconds{0};
    std::uint64_t duration_microseconds{0};
    Position position{};
    std::uint8_t midi_pitch{0};
    std::uint8_t velocity{0};
    std::uint8_t source_track{0};
    std::uint8_t source_channel{0};
};

struct Song {
    std::string id;
    std::string title;
    std::vector<NoteEvent> events;
};

}  // namespace songstick
