#include "songstick/midi_importer.h"
#include "songstick/playback.h"

#include <emscripten/bind.h>

#include <cstdint>
#include <string>
#include <vector>

namespace {

struct WebPlaybackSnapshot {
    std::string status;
    double position_microseconds{0};
    std::uint16_t speed_permille{0};
    int current_event{-1};
    int next_event{-1};
};

struct WebLedOutput {
    bool active{false};
    std::uint8_t string_index{0};
    std::uint8_t fret{0};
    std::string role{"off"};
    std::uint16_t intensity_permille{0};
};

struct WebLedFrame {
    WebLedOutput current;
    WebLedOutput next;
};

const char* status_name(songstick::PlaybackStatus status) noexcept {
    switch (status) {
        case songstick::PlaybackStatus::stopped:
            return "stopped";
        case songstick::PlaybackStatus::playing:
            return "playing";
        case songstick::PlaybackStatus::paused:
            return "paused";
        case songstick::PlaybackStatus::finished:
            return "finished";
    }
    return "stopped";
}

const char* role_name(songstick::LedRole role) noexcept {
    switch (role) {
        case songstick::LedRole::off:
            return "off";
        case songstick::LedRole::current:
            return "current";
        case songstick::LedRole::next:
            return "next";
    }
    return "off";
}

int event_index(std::size_t index) noexcept {
    return index == songstick::PlaybackState::no_event ? -1 : static_cast<int>(index);
}

WebLedOutput web_output(const songstick::LedOutput& output) {
    return {
        output.active,
        output.position.string_index,
        output.position.fret,
        role_name(output.role),
        output.intensity_permille,
    };
}

emscripten::val import_snapshot(const songstick::ImportResult& result) {
    auto snapshot = emscripten::val::object();
    snapshot.set("success", result.success);
    snapshot.set("instrumentProfileId", std::string("provisional-a-mixolydian-v1"));

    auto summary = emscripten::val::object();
    summary.set("format", result.summary.format);
    summary.set("ticksPerQuarter", result.summary.ticks_per_quarter);
    summary.set("trackName", result.summary.track_name);
    summary.set("midiEventCount", result.summary.midi_event_count);
    summary.set("noteCount", result.summary.note_count);
    summary.set("tempoChangeCount", result.summary.tempo_change_count);
    summary.set("minimumPitch", result.summary.minimum_pitch);
    summary.set("maximumPitch", result.summary.maximum_pitch);
    summary.set("durationMicroseconds", static_cast<double>(result.summary.duration_microseconds));
    summary.set("timeSignatureNumerator", result.summary.time_signature_numerator);
    summary.set("timeSignatureDenominator", result.summary.time_signature_denominator);
    snapshot.set("summary", summary);

    auto diagnostics = emscripten::val::array();
    for (const auto& diagnostic : result.diagnostics) {
        auto item = emscripten::val::object();
        item.set(
            "severity",
            std::string(diagnostic.severity == songstick::DiagnosticSeverity::error ? "error" : "warning"));
        item.set("code", diagnostic.code);
        item.set("message", diagnostic.message);
        item.set("tick", static_cast<double>(diagnostic.tick));
        diagnostics.call<void>("push", item);
    }
    snapshot.set("diagnostics", diagnostics);
    return snapshot;
}

songstick::Song demo_song() {
    return {
        "wasm-demo",
        "Portable core demo",
        {
            {0, 800'000, {0, 2}, 60},
            {1'000'000, 800'000, {1, 4}, 62},
            {2'000'000, 800'000, {2, 5}, 64},
            {3'000'000, 800'000, {1, 4}, 62},
        },
    };
}

class WebPlayback {
public:
    bool load_demo_song() { return playback_.load_song(demo_song()); }
    void play() { playback_.play(); }
    void pause() { playback_.pause(); }
    void restart() { playback_.restart(); }

    bool set_speed_permille(std::uint16_t speed) {
        return playback_.set_speed_permille(speed);
    }

    emscripten::val import_midi(const emscripten::val& uploaded_bytes) {
        const auto length = uploaded_bytes["byteLength"].as<std::size_t>();
        std::vector<std::uint8_t> bytes(length);
        if (!bytes.empty()) {
            auto destination = emscripten::val(
                emscripten::typed_memory_view(bytes.size(), bytes.data()));
            destination.call<void>("set", uploaded_bytes);
        }

        auto result = songstick::import_midi_format_zero(
            {bytes.data(), bytes.size()}, songstick::provisional_a_mixolydian_profile());
        if (result.success && !playback_.load_song(result.song)) {
            result.success = false;
            result.diagnostics.push_back({
                songstick::DiagnosticSeverity::error,
                "MIDI_PLAYBACK_LOAD",
                "The converted song did not satisfy playback invariants.",
                0,
            });
        }
        return import_snapshot(result);
    }

    void update(double monotonic_microseconds) {
        if (monotonic_microseconds < 0) {
            return;
        }
        playback_.update(static_cast<std::uint64_t>(monotonic_microseconds));
    }

    WebPlaybackSnapshot state() const {
        const auto& state = playback_.state();
        return {
            status_name(state.status),
            static_cast<double>(state.position_microseconds),
            state.speed_permille,
            event_index(state.current_event),
            event_index(state.next_event),
        };
    }

    WebLedFrame led_frame() const {
        const auto frame = playback_.led_frame();
        return {web_output(frame.outputs[0]), web_output(frame.outputs[1])};
    }

private:
    songstick::Playback playback_{};
};

}  // namespace

EMSCRIPTEN_BINDINGS(songstick_module) {
    emscripten::value_object<WebPlaybackSnapshot>("PlaybackSnapshot")
        .field("status", &WebPlaybackSnapshot::status)
        .field("positionMicroseconds", &WebPlaybackSnapshot::position_microseconds)
        .field("speedPermille", &WebPlaybackSnapshot::speed_permille)
        .field("currentEvent", &WebPlaybackSnapshot::current_event)
        .field("nextEvent", &WebPlaybackSnapshot::next_event);

    emscripten::value_object<WebLedOutput>("LedOutput")
        .field("active", &WebLedOutput::active)
        .field("stringIndex", &WebLedOutput::string_index)
        .field("fret", &WebLedOutput::fret)
        .field("role", &WebLedOutput::role)
        .field("intensityPermille", &WebLedOutput::intensity_permille);

    emscripten::value_object<WebLedFrame>("LedFrame")
        .field("current", &WebLedFrame::current)
        .field("next", &WebLedFrame::next);

    emscripten::class_<WebPlayback>("Playback")
        .constructor<>()
        .function("loadDemoSong", &WebPlayback::load_demo_song)
        .function("play", &WebPlayback::play)
        .function("pause", &WebPlayback::pause)
        .function("restart", &WebPlayback::restart)
        .function("setSpeedPermille", &WebPlayback::set_speed_permille)
        .function("importMidi", &WebPlayback::import_midi)
        .function("update", &WebPlayback::update)
        .function("state", &WebPlayback::state)
        .function("ledFrame", &WebPlayback::led_frame);
}
