#pragma once

#include "songstick/song.h"

#include <array>
#include <cstddef>
#include <cstdint>
#include <limits>

namespace songstick {

enum class PlaybackStatus : std::uint8_t {
    stopped,
    playing,
    paused,
    finished,
};

enum class LedRole : std::uint8_t {
    off,
    current,
    next,
};

struct PlaybackState {
    static constexpr std::size_t no_event = std::numeric_limits<std::size_t>::max();

    PlaybackStatus status{PlaybackStatus::stopped};
    std::uint64_t position_microseconds{0};
    std::uint16_t speed_permille{750};
    std::size_t current_event{no_event};
    std::size_t next_event{no_event};
};

struct LedOutput {
    bool active{false};
    Position position{};
    LedRole role{LedRole::off};
    std::uint16_t intensity_permille{0};
};

struct LedFrame {
    std::array<LedOutput, 2> outputs{};
};

class Playback {
public:
    static constexpr std::uint16_t minimum_speed_permille = 500;
    static constexpr std::uint16_t maximum_speed_permille = 1000;
    static constexpr std::uint16_t default_speed_permille = 750;

    [[nodiscard]] bool load_song(const Song& song);
    void play() noexcept;
    void pause() noexcept;
    void restart() noexcept;
    [[nodiscard]] bool set_speed_permille(std::uint16_t speed) noexcept;
    void update(std::uint64_t monotonic_microseconds) noexcept;

    [[nodiscard]] const PlaybackState& state() const noexcept { return state_; }
    [[nodiscard]] LedFrame led_frame() const noexcept;
    [[nodiscard]] const Song& song() const noexcept { return song_; }

private:
    void refresh_event_indexes() noexcept;
    [[nodiscard]] std::uint64_t song_duration() const noexcept;

    Song song_{};
    PlaybackState state_{};
    std::uint64_t anchor_monotonic_microseconds_{0};
    std::uint64_t anchor_position_microseconds_{0};
    std::uint64_t last_monotonic_microseconds_{0};
    bool anchor_pending_{true};
    bool has_last_monotonic_{false};
};

}  // namespace songstick
