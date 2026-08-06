#include "songstick/playback.h"

#include <algorithm>
#include <limits>

namespace songstick {
namespace {

std::uint64_t saturating_add(std::uint64_t left, std::uint64_t right) noexcept {
    const auto maximum = std::numeric_limits<std::uint64_t>::max();
    return right > maximum - left ? maximum : left + right;
}

std::uint64_t scale_elapsed(std::uint64_t elapsed, std::uint16_t speed) noexcept {
    constexpr std::uint64_t divisor = 1000;
    const auto whole = elapsed / divisor;
    const auto remainder = elapsed % divisor;
    return saturating_add(
        whole * static_cast<std::uint64_t>(speed),
        (remainder * static_cast<std::uint64_t>(speed)) / divisor);
}

std::uint64_t event_end(const NoteEvent& event) noexcept {
    return saturating_add(event.start_microseconds, event.duration_microseconds);
}

}  // namespace

bool Playback::load_song(const Song& song) {
    std::uint64_t previous_start = 0;
    std::uint64_t previous_end = 0;
    bool first = true;

    for (const auto& event : song.events) {
        if (event.duration_microseconds == 0 || event.position.string_index > 2) {
            return false;
        }
        if (!first && (event.start_microseconds < previous_start ||
                       event.start_microseconds < previous_end)) {
            return false;
        }
        first = false;
        previous_start = event.start_microseconds;
        previous_end = event_end(event);
    }

    song_ = song;
    state_ = {};
    state_.speed_permille = default_speed_permille;
    anchor_pending_ = true;
    has_last_monotonic_ = false;
    refresh_event_indexes();
    return true;
}

void Playback::play() noexcept {
    if (song_.events.empty()) {
        state_.status = PlaybackStatus::finished;
        refresh_event_indexes();
        return;
    }
    if (state_.status == PlaybackStatus::finished) {
        state_.position_microseconds = 0;
    }
    if (state_.status != PlaybackStatus::playing) {
        state_.status = PlaybackStatus::playing;
        anchor_pending_ = true;
        refresh_event_indexes();
    }
}

void Playback::pause() noexcept {
    if (state_.status == PlaybackStatus::playing) {
        state_.status = PlaybackStatus::paused;
        anchor_pending_ = true;
    }
}

void Playback::restart() noexcept {
    state_.status = PlaybackStatus::stopped;
    state_.position_microseconds = 0;
    anchor_pending_ = true;
    has_last_monotonic_ = false;
    refresh_event_indexes();
}

bool Playback::set_speed_permille(std::uint16_t speed) noexcept {
    if (speed < minimum_speed_permille || speed > maximum_speed_permille) {
        return false;
    }
    state_.speed_permille = speed;
    if (state_.status == PlaybackStatus::playing && has_last_monotonic_) {
        anchor_monotonic_microseconds_ = last_monotonic_microseconds_;
        anchor_position_microseconds_ = state_.position_microseconds;
        anchor_pending_ = false;
    }
    return true;
}

void Playback::update(std::uint64_t monotonic_microseconds) noexcept {
    if (state_.status != PlaybackStatus::playing) {
        return;
    }

    if (anchor_pending_ ||
        (has_last_monotonic_ && monotonic_microseconds < last_monotonic_microseconds_)) {
        anchor_monotonic_microseconds_ = monotonic_microseconds;
        anchor_position_microseconds_ = state_.position_microseconds;
        anchor_pending_ = false;
    }

    last_monotonic_microseconds_ = monotonic_microseconds;
    has_last_monotonic_ = true;

    const auto elapsed = monotonic_microseconds - anchor_monotonic_microseconds_;
    state_.position_microseconds = saturating_add(
        anchor_position_microseconds_, scale_elapsed(elapsed, state_.speed_permille));

    if (state_.position_microseconds >= song_duration()) {
        state_.position_microseconds = song_duration();
        state_.status = PlaybackStatus::finished;
        anchor_pending_ = true;
    }
    refresh_event_indexes();
}

LedFrame Playback::led_frame() const noexcept {
    LedFrame frame{};
    if (state_.status == PlaybackStatus::finished || song_.events.empty()) {
        return frame;
    }

    if (state_.current_event != PlaybackState::no_event) {
        frame.outputs[0] = {
            true,
            song_.events[state_.current_event].position,
            LedRole::current,
            1000,
        };
    }
    if (state_.next_event != PlaybackState::no_event) {
        const auto next_position = song_.events[state_.next_event].position;
        if (!frame.outputs[0].active || !(frame.outputs[0].position == next_position)) {
            frame.outputs[1] = {true, next_position, LedRole::next, 400};
        }
    }
    return frame;
}

void Playback::refresh_event_indexes() noexcept {
    state_.current_event = PlaybackState::no_event;
    state_.next_event = PlaybackState::no_event;

    if (song_.events.empty() || state_.status == PlaybackStatus::finished) {
        return;
    }
    if (state_.status == PlaybackStatus::stopped) {
        state_.current_event = 0;
        if (song_.events.size() > 1) {
            state_.next_event = 1;
        }
        return;
    }

    const auto position = state_.position_microseconds;
    const auto first_after = std::upper_bound(
        song_.events.begin(), song_.events.end(), position,
        [](std::uint64_t time, const NoteEvent& event) {
            return time < event.start_microseconds;
        });

    if (first_after != song_.events.begin()) {
        const auto candidate = static_cast<std::size_t>(
            std::distance(song_.events.begin(), first_after) - 1);
        if (position < event_end(song_.events[candidate])) {
            state_.current_event = candidate;
        }
    }
    if (first_after != song_.events.end()) {
        state_.next_event = static_cast<std::size_t>(
            std::distance(song_.events.begin(), first_after));
    }
}

std::uint64_t Playback::song_duration() const noexcept {
    return song_.events.empty() ? 0 : event_end(song_.events.back());
}

}  // namespace songstick
