#include "songstick/playback.h"

#include <cstdlib>
#include <iostream>
#include <string_view>

namespace {

int failures = 0;

void check(bool condition, std::string_view expression, int line) {
    if (!condition) {
        std::cerr << "line " << line << ": check failed: " << expression << '\n';
        ++failures;
    }
}

#define CHECK(expression) check((expression), #expression, __LINE__)

songstick::Song demo_song() {
    return {
        "demo",
        "Deterministic demo",
        {
            {0, 1'000'000, {0, 2}, 60},
            {1'500'000, 500'000, {1, 4}, 62},
            {2'500'000, 500'000, {2, 5}, 64},
        },
    };
}

void test_load_and_ready_state() {
    songstick::Playback playback;
    CHECK(playback.load_song(demo_song()));
    CHECK(playback.state().status == songstick::PlaybackStatus::stopped);
    CHECK(playback.state().speed_permille == 750);
    CHECK(playback.state().current_event == 0);
    CHECK(playback.state().next_event == 1);

    const auto frame = playback.led_frame();
    CHECK(frame.outputs[0].active);
    CHECK(frame.outputs[0].role == songstick::LedRole::current);
    CHECK((frame.outputs[0].position == songstick::Position{0, 2}));
    CHECK(frame.outputs[0].intensity_permille == 1000);
    CHECK(frame.outputs[1].active);
    CHECK(frame.outputs[1].role == songstick::LedRole::next);
    CHECK(frame.outputs[1].intensity_permille == 400);
}

void test_external_time_and_large_jump() {
    songstick::Playback playback;
    CHECK(playback.load_song(demo_song()));
    playback.play();
    playback.update(10'000'000);
    CHECK(playback.state().position_microseconds == 0);

    playback.update(11'000'000);
    CHECK(playback.state().position_microseconds == 750'000);
    CHECK(playback.state().current_event == 0);

    playback.update(12'000'000);
    CHECK(playback.state().position_microseconds == 1'500'000);
    CHECK(playback.state().current_event == 1);
    CHECK(playback.state().next_event == 2);

    playback.update(20'000'000);
    CHECK(playback.state().status == songstick::PlaybackStatus::finished);
    CHECK(playback.state().position_microseconds == 3'000'000);
    CHECK(!playback.led_frame().outputs[0].active);
}

void test_pause_resume_and_speed_change() {
    songstick::Playback playback;
    CHECK(playback.load_song(demo_song()));
    playback.play();
    playback.update(1'000'000);
    playback.update(2'000'000);
    CHECK(playback.state().position_microseconds == 750'000);

    playback.pause();
    playback.update(9'000'000);
    CHECK(playback.state().position_microseconds == 750'000);
    CHECK(playback.state().status == songstick::PlaybackStatus::paused);

    playback.play();
    playback.update(10'000'000);
    playback.update(10'100'000);
    CHECK(playback.state().position_microseconds == 825'000);

    CHECK(playback.set_speed_permille(1000));
    playback.update(10'200'000);
    CHECK(playback.state().position_microseconds == 925'000);
    CHECK(!playback.set_speed_permille(499));
    CHECK(playback.state().speed_permille == 1000);
}

void test_restart_and_validation() {
    songstick::Playback playback;
    CHECK(playback.load_song(demo_song()));
    playback.play();
    playback.update(0);
    playback.update(2'000'000);
    playback.restart();
    CHECK(playback.state().status == songstick::PlaybackStatus::stopped);
    CHECK(playback.state().position_microseconds == 0);
    CHECK(playback.state().current_event == 0);

    auto invalid = demo_song();
    invalid.events[1].start_microseconds = 999'999;
    CHECK(!playback.load_song(invalid));

    songstick::Song empty{"empty", "Empty", {}};
    CHECK(playback.load_song(empty));
    playback.play();
    CHECK(playback.state().status == songstick::PlaybackStatus::finished);
}

void test_duplicate_position_is_not_emitted_twice() {
    auto song = demo_song();
    song.events[1].position = song.events[0].position;
    songstick::Playback playback;
    CHECK(playback.load_song(song));
    const auto frame = playback.led_frame();
    CHECK(frame.outputs[0].active);
    CHECK(!frame.outputs[1].active);
}

}  // namespace

int main() {
    test_load_and_ready_state();
    test_external_time_and_large_jump();
    test_pause_resume_and_speed_change();
    test_restart_and_validation();
    test_duplicate_position_is_not_emitted_twice();

    if (failures != 0) {
        std::cerr << failures << " test assertion(s) failed\n";
        return EXIT_FAILURE;
    }
    std::cout << "All playback tests passed\n";
    return EXIT_SUCCESS;
}
