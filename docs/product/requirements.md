# Song Stick LED Teacher — Product Requirements Document

**Status:** Initial draft
**Version:** 0.8
**Date:** 2026-09-02
**Project:** West End Maker Shed Song Stick
**Development approach:** Simulation-first, shared portable C++ core

## 1. Product summary

The Song Stick is a three-string beginner instrument intended primarily for seniors. Addressable LEDs mounted along the neck show where to play the current and upcoming notes.

The teaching software will run on the ESP32 board already being developed by the team. That board also supports a touchscreen and an ESP-NOW pickup/amplification system that transmits audio to a remote ESP32 attached to a speaker.

Development will begin with a browser simulator that reproduces the intended user journey: upload a MIDI file, convert it for the Song Stick, select playback speed, and watch the simulated fret LEDs. The musical and playback core will be written once in portable C++, compiled to WebAssembly for the browser, and compiled natively for the ESP32 through PlatformIO.

## 2. Goals

1. Let a user upload a Standard MIDI File and quickly see it operating the simulated Song Stick LEDs.
2. Create one authoritative implementation of MIDI parsing, song conversion, fingering, timing, playback state, and logical LED output.
3. Support rapid remote sharing and iteration through a web application without requiring physical meetings, ESP32 flashing, or connected LEDs.
4. Keep the eventual ESP32 module non-blocking and compatible with the team’s touchscreen and time-sensitive ESP-NOW audio work.
5. Keep the player experience simple and appropriate for seniors.
6. Preserve clear extension points for future tablature import, physical controls, note detection, chords, and other teaching modes.

## 3. Non-goals for the first release

The first release does not require:

- Live MIDI input
- MIDI 2.0
- Tablature or text-note import
- Chord instruction
- Microphone-based note recognition
- A “wait until the correct note is played” mode
- Wi-Fi song uploads to the physical instrument
- NFC
- Physical knobs or buttons
- Audio synthesis or preview playback
- Physical addressable LED output
- ESP-NOW implementation or modification
- A full score or tablature editor

The architecture should allow these capabilities to be added later.

## 4. Users

### Player

A senior or beginner who wants a simple way to select a song, adjust its speed, and follow illuminated fret positions.

### Volunteer or facilitator

A person who prepares songs, resolves MIDI compatibility issues, and eventually loads songs onto the physical instrument.

### Development team

Maker Shed contributors working on the ESP32 board, touchscreen, ESP-NOW pickup system, web simulator, and LED integration.

## 5. Primary web user journey

1. Open the Song Stick web simulator.
2. Upload a `.mid` or `.midi` file.
3. See the file’s title, tracks, duration, tempo information, pitch range, and compatibility results.
4. If required, choose the track or MIDI channel containing the melody.
5. Convert MIDI pitches to positions on the configured three-string Song Stick.
6. See clear warnings about polyphony, altered notes, dropped notes, or notes outside the playable range.
7. Review the converted song and simulated neck.
8. Press Play.
9. Watch current and next-note LEDs follow the MIDI timing.
10. Pause, restart, and adjust playback speed.
11. Optionally export the converted, device-ready song representation.

The application should proceed automatically when conversion is unambiguous and request user decisions only when necessary.

## 6. Product principles

- **One implementation of musical behaviour:** Musical interpretation must not be duplicated in TypeScript and C++.
- **Simple player experience:** Keep primary controls large, obvious, and limited to essential actions.
- **Explicit conversion decisions:** Never silently discard polyphony or unplayable notes.
- **Deterministic playback:** The same song, configuration, commands, and clock values must produce the same state and LED output.
- **Platform separation:** Keep browser, touchscreen, LED-hardware, filesystem, and ESP-NOW details outside the portable core.
- **Bounded embedded work:** Avoid blocking operations, busy waits, and unbounded allocation in playback.

## 7. System architecture

### 7.1 Portable C++ core

Implement the application core in modern, dependency-light C++. The same source files must compile:

- to WebAssembly using Emscripten;
- as native ESP32 firmware through PlatformIO;
- as native host tests where practical.

The portable core owns:

- MIDI parsing
- MIDI normalization
- Tempo-map interpretation
- Melody extraction or reduction
- Pitch-to-string/fret conversion
- Canonical song representation
- Playback timing and state
- Logical LED output
- Validation and structured diagnostics

### 7.2 Browser application

TypeScript or JavaScript owns:

- File upload and drag-and-drop
- MIDI import workflow screens
- Touchscreen-style controls
- Fretboard and LED rendering
- Browser clock integration
- `requestAnimationFrame`
- Converted-song downloads
- Developer and debugging tools

The browser must call the WebAssembly core for all musical interpretation and playback state transitions.

### 7.3 ESP32 application

ESP32-specific adapters will eventually own:

- Touchscreen rendering and touch input
- Physical LED output
- ESP32 monotonic clock
- Filesystem or flash access
- Integration with existing ESP-NOW/audio firmware

The ESP32 will receive a native build of the shared C++ sources. The WebAssembly binary itself will not be flashed onto the ESP32.

### 7.4 Suggested repository structure

```text
/
├── platformio.ini
├── CMakeLists.txt
├── core/
│   ├── include/songstick/
│   │   ├── midi_parser.h
│   │   ├── midi_importer.h
│   │   ├── instrument.h
│   │   ├── fingering.h
│   │   ├── song.h
│   │   ├── playback.h
│   │   └── led_state.h
│   └── src/
├── web/
│   ├── src/
│   ├── index.html
│   └── package.json
├── firmware/
│   └── src/
├── tests/
│   ├── unit/
│   ├── fixtures/
│   └── midi/
└── examples/
```

The existing team repository may require another layout, but it must preserve the boundary between portable core and platform adapters.

## 8. Functional requirements

### 8.0 Song library and selection

Preparing songs and choosing a song to play are separate steps. A facilitator
loads MIDI files onto the controller. The on-instrument screen presents all
stored songs in a simple song selector for the player.

The import action must:

- accept filenames ending in `.mid` or `.midi`, case-insensitively;
- reject other filename extensions;
- persist accepted MIDI files so they remain available after the current screen
  or browser session ends; and
- update the song selector without requiring an application restart.

The song selector must:

- list every imported MIDI file using its original filename;
- provide an explicit Play action that loads the stored file and begins playback;
- place a very small, icon-only Play control to the left of each song so selector
  rows remain on one line;
- provide a Delete action with confirmation before permanently removing a file;
- show an empty-library state; and
- report loading, playback-conversion, and deletion errors without removing the
  stored source file.

The browser simulator must exercise this workflow with development storage. The
ESP32 filesystem, metadata representation, capacity, and provisioning transport
remain separate platform decisions.

For the prototype, the selector must always include a playable built-in test
song. It must be visibly distinguished from imported songs and cannot be
deleted. This guarantees a known-good demonstration path without requiring an
upload. The prototype demo must contain enough note changes to exercise the LED
display and last at least 10 musical seconds at 100% playback speed.

### 8.1 Instrument profile

The instrument definition must be configurable and contain at least:

- Three open-string MIDI pitches
- Number of frets
- Treatment of open-string positions
- Optional permitted positions
- Optional preferred beginner fret range
- Logical-fret-to-physical-LED mapping

Use a clearly labelled provisional test profile until the team confirms the real tuning and fret geometry.

The current implementation assumptions and their physical verification checklist
are maintained in [`provisional-instrument-profile.md`](provisional-instrument-profile.md).
They may be used to unblock simulation and MIDI work but are not confirmed
construction requirements.

### 8.2 Standard MIDI File support

The browser must accept `.mid` and `.midi` files and pass the raw bytes to the C++/WebAssembly core.

The initial MIDI parser must support:

- Standard MIDI File format 0
- Standard MIDI File format 1
- Header and track chunks
- Variable-length quantities
- Running status
- Note On
- Note Off
- Note On with velocity zero as Note Off
- Set Tempo meta-events
- Track Name meta-events
- Sequence and track text useful for display
- End of Track
- Time Signature for metadata and musical-position display
- Multiple tracks and channels
- Safe skipping of unknown but valid events according to their encoded lengths

The parser must:

- Validate signatures, chunk sizes, and bounds
- Reject malformed or truncated files safely
- Avoid unbounded allocation
- Return structured, human-readable diagnostics
- Never crash when given invalid uploaded bytes

Initial exclusions may include:

- MIDI 2.0
- Live MIDI input
- SysEx interpretation
- Controller automation unrelated to notes
- Percussion interpretation
- Direct synthesizer playback

MIDI files using SMPTE time division should initially be rejected or clearly marked unsupported unless correct support is inexpensive to implement.

### 8.3 MIDI import summary

After upload, display:

- Filename
- Inferred song title
- MIDI format
- Duration
- Tempo or number of tempo changes
- Time signature when available
- Track list and track names
- Channels used
- Note count
- Pitch range
- Polyphony warning
- Out-of-range note count
- Selected melody source

Defaults:

- Automatically select the only note-containing track.
- When several tracks exist, suggest a likely melody track while allowing manual selection.
- Exclude MIDI percussion channel 10 by default.
- Automatically proceed when conversion is unambiguous.

### 8.4 Canonical timing model

Preserve MIDI timing accurately.

Use:

- Integer MIDI ticks for imported event positions
- Pulses per quarter note from the MIDI header
- An ordered tempo map
- Integer microseconds, or another overflow-safe integer representation, for resolved playback time

Do not immediately convert imported timing to floating-point beats and discard the original ticks.

The browser may display beats and seconds as derived values.

### 8.5 Canonical song representation

The core song model must contain at least:

```text
Song
- stable ID
- title
- source metadata
- timing division
- tempo map
- note events
- instrument definition or profile reference
- import decisions
- diagnostics
```

Each imported note event must contain at least:

```text
NoteEvent
- source track
- source channel
- MIDI pitch
- velocity
- start tick
- duration ticks
- resolved string
- resolved fret
```

The representation must allow corrected fingerings to be stored later.

### 8.6 Melody selection and polyphony

The initial teaching system displays one position at a time, while MIDI files may contain accompaniment, chords, or multiple instruments.

The importer must detect polyphony and must not silently treat a polyphonic source as monophonic.

For the first release:

- Show available tracks and channels.
- Let the user select a melody track or channel.
- Exclude percussion channel 10 by default.
- If selected material remains polyphonic, offer a clearly labelled automatic melody reduction.
- Report how many notes were dropped, shortened, or otherwise changed.
- Let the user cancel instead of accepting the reduction.

Initial deterministic melody-reduction policies may include:

- Highest active pitch
- Lowest active pitch
- Highest-velocity note
- Minimum movement from the previously selected note

Use **highest active pitch** as the initial default because melodies commonly sit above accompaniment. Place this choice in an advanced import control.

Resolve polyphony during import rather than in the runtime playback engine.

### 8.7 Pitch-to-fingering conversion

MIDI contains pitch and timing but usually does not identify the intended string and fret. Conversion must therefore include a separate fingering stage:

```text
MIDI notes
    ↓
melody selection/reduction
    ↓
pitch events
    ↓
instrument tuning and fret range
    ↓
string/fret assignment
    ↓
playable Song Stick events
```

The same pitch may be available at multiple positions. The initial algorithm must be deterministic and configurable.

Fingering objectives, in priority order:

1. Use only playable positions.
2. Minimize large fret jumps.
3. Minimize unnecessary string changes.
4. Prefer lower or easier fret positions.
5. Produce identical results from identical input and configuration.

Implement fingering behind an isolated strategy interface so the algorithm can improve without changing MIDI parsing or playback.

### 8.8 Fingering review

After conversion, the simulator must show:

- Simulated neck LEDs
- Current MIDI pitch
- Selected string and fret
- Source track and channel
- Warnings for unplayable notes
- A summary of automatic fingering decisions

A full editor is outside the first release. The design must allow manual string/fret corrections to be added later.

### 8.9 Playback controls

The playback engine must support:

- Load converted song
- Start
- Pause
- Resume
- Restart from beginning
- Change speed before playback
- Change speed during playback
- Advance from externally supplied elapsed time
- Finish cleanly after the final note

Initial speed range:

- Minimum: 50%
- Default: 75%
- Maximum: 100%
- UI increments: 5% or 10%

Represent speed using an integer where practical:

- `500` = 50%
- `750` = 75%
- `1000` = 100%

Changing speed during playback must preserve the logical musical position. It must not restart the song or unpredictably skip notes.

The core must not obtain the time itself. The browser or ESP32 adapter supplies monotonic timestamps.

### 8.10 Playback state

The core must expose a complete logical state containing at least:

```text
PlaybackState
- selected song
- status: stopped | playing | paused | finished
- playback position
- effective speed
- current event
- next event
- diagnostics or completion state where relevant
```

The result must be deterministic for a supplied song, command sequence, and sequence of clock values.

### 8.11 Logical LED behaviour

Logical LED output identifies positions using:

```text
string + fret + role + intensity
```

Initial roles:

- **Current note:** 100% logical intensity
- **Next note:** 40% logical intensity
- **Off:** 0%

Initial string colours:

- String 1: red
- String 2: green
- String 3: blue

Keep colours configurable outside the playback algorithm.

Rules:

- If current and next notes use the same physical position, the current-note state takes priority.
- While paused, keep the current and next notes visible.
- While stopped, show the first note as ready.
- At completion, either clear the LEDs after a brief completion state or return to first-note-ready; keep this configurable until usability testing decides it.
- A gradual next-note fade may be added after the basic current/next behaviour is working and tested.
- The eventual hardware adapter applies the safe electrical brightness limit; the core outputs logical intensity only.

### 8.12 Physical LED mapping

Keep logical musical positions separate from physical LED indexes.

Use an explicit mapping structure such as:

```json
{
  "open": 0,
  "frets": {
    "1": 4,
    "2": 8,
    "3": 12,
    "4": 15
  }
}
```

This mapping accommodates unequal fret spacing, different neck lengths, and calibration differences between instruments.

The initial physical concept uses one shared RGB LED at the nut for open strings
plus one RGB LED position per fret area, with string represented by colour. Open
is logical fret 0. Do not assume one physical LED per string.

The developer view should show both logical fret positions and physical LED indexes.

The browser simulator must make strip particulars configurable, including at
least fret count, LEDs per fret, optional LEDs per metre, controller description,
and explicit index mapping. Until physical hardware is confirmed, use a clearly
provisional RGB profile with one shared open indicator and 12 frets using one LED
per fret. Unconfirmed density and controller values must remain unspecified
rather than appearing as hardware decisions.

## 9. Browser simulator requirements

### 9.1 Player interface

Provide:

- MIDI upload
- Persistent song selector with Play and Delete actions
- Song/import status
- Song title
- Play/Pause
- Restart
- Speed selection
- Playback progress
- Simulated fretboard or side-mounted LED strip

Design for touch:

- Large targets and text
- Strong contrast
- No hover-only actions
- No precision dragging for essential actions
- No nested menus in the normal playing flow
- Plain labels rather than icons alone
- Obvious Play/Pause state
- A usable default speed
- Protection against accidental song changes during playback

Support configurable viewport presets so the team can test likely touchscreen sizes before the exact hardware is known.

The online prototype must present the player experience inside a bounded mock
instrument screen above the separate virtual LED strip. It must optimize the
interaction for a small touchscreen rather than expanding controls to fill the
browser page. Use clearly provisional 320×240 and 480×320 viewport presets until
the actual display is selected.

Break the instrument interaction into explicit full-screen states:

- **Songs:** a simple list where selecting a row opens that song's player;
- **Player:** song title, Play/Pause, Restart, progress, and tempo adjustment;
- **Manage:** MIDI import and confirmed deletion of imported songs.

Selecting a song prepares it but does not start playback. The Player screen owns
all transport and tempo controls; do not repeat Play controls in the song list.
Use an overlay only for a focused confirmation such as permanent deletion, not
for ordinary navigation. Keep simulator configuration and detailed import/debug
information outside the mock instrument screen.

### 9.2 Developer panel

Provide an optional panel showing:

- Playback status
- Current tick, beat, and elapsed time
- Current event index
- Current MIDI note
- Next MIDI note
- Effective tempo and speed
- Selected string and fret
- Physical LED index
- Source track and channel
- Import and validation diagnostics
- Simulated frame/update timing

The developer panel is not part of the senior-facing touchscreen design.

### 9.3 Export

Allow the converted, device-ready song representation to be downloaded. The export must preserve:

- Source metadata
- Tempo map
- Converted events
- Resolved fingerings
- Instrument-profile reference or definition
- Import/reduction decisions
- Relevant warnings
- Schema version

## 10. Core API concept

The exact names may change, but preserve a narrow boundary equivalent to:

```cpp
ImportResult importMidi(
    ByteSpan midiBytes,
    const ImportOptions& options,
    const Instrument& instrument
);

void loadSong(const Song& song);
void play();
void pause();
void restart();
void setSpeedPermille(std::uint16_t speed);
void update(std::uint64_t monotonicMicroseconds);

PlaybackState playbackState() const;
LedFrame ledFrame() const;
```

## 11. WebAssembly boundary

Use Emscripten to compile the portable C++ core for the browser.

### Initial binding choice

Use **Embind** initially for rapid development and readable browser integration while the API is evolving.

A small C-compatible ABI may replace it later if binary size, binding stability, or cross-platform fixture reuse warrants the change.

Regardless of binding mechanism:

- JavaScript passes uploaded MIDI bytes to WebAssembly.
- C++ returns structured import results and diagnostics.
- C++ retains ownership of core playback state.
- Avoid a separate WebAssembly call for every LED on every animation frame when a compact frame object or typed array can cross the boundary once.
- Keep DOM and browser concepts out of C++.

TypeScript must not independently calculate:

- Tempo interpretation
- Melody reduction
- String/fret assignment
- Event boundaries
- Current or next note
- Speed-adjusted playback position
- Logical LED roles or intensities

## 12. ESP32 integration constraints

The eventual firmware module must:

- Remain non-blocking
- Avoid long `delay()` calls
- Avoid busy-wait loops
- Avoid frequent dynamic allocation during playback
- Avoid blocking filesystem work during playback
- Avoid disabling interrupts for long periods
- Avoid monopolizing a CPU core or high-priority task
- Keep each update and LED write brief and bounded
- Cooperate with existing ESP-NOW and audio code
- Expose a small command and state API to the touchscreen
- Allow physical LED output to be disabled for testing

The portable core should avoid:

- Browser APIs
- Filesystem assumptions
- Exceptions if target firmware disables them
- RTTI when unnecessary
- Threads
- OS-specific calls
- Large desktop-only libraries

Allocation during MIDI import is acceptable within configured limits. Playback should use precomputed data and bounded work.

Do not choose an RTOS task/core arrangement until the existing ESP32 board and ESP-NOW audio architecture are known.

## 13. Performance and robustness requirements

- Playback must be independent of browser frame rate.
- A delayed browser frame or ESP32 update must advance to the correct musical state rather than replaying every missed frame.
- MIDI parsing must be bounds-checked throughout.
- Import limits for file size, track count, event count, and duration must be configurable.
- Playback work per update must be bounded.
- Avoid allocation in the steady-state playback loop.
- Use monotonic time rather than wall-clock time.
- Use overflow-safe integer timing calculations.
- Invalid MIDI must produce diagnostics rather than crashes or undefined behaviour.

## 14. Testing requirements

Use deterministic native C++ tests and, where practical, run equivalent tests against the WebAssembly build.

Use a fake monotonic clock. Tests must not depend on real delays or timers.

### 14.1 MIDI fixtures

Include fixtures covering:

- Format 0 single-track melody
- Format 1 with separate melody and accompaniment
- Tempo changes
- Running status
- Velocity-zero Note Off
- Overlapping notes
- Repeated notes
- Multiple channels
- Percussion track
- Notes below and above instrument range
- Notes still active at End of Track
- Empty MIDI
- Malformed headers
- Truncated chunks
- Invalid variable-length quantities
- Very large declared chunk lengths

### 14.2 Golden assertions

Assert:

- Parsed note events
- Tempo-map resolution
- Track/channel metadata
- Melody-reduction decisions
- Dropped or changed-note diagnostics
- String/fret assignments
- Playback state at exact monotonic timestamps
- Pause and resume without timing jumps
- Restart behaviour
- Speed changes before and during playback
- Single-note and empty-song behaviour
- Large time jumps
- Logical fret-to-physical-LED mapping
- Logical LED frames
- Determinism independent of UI frame rate

Fuzz the MIDI parser once the basic implementation is stable because it accepts arbitrary uploaded binary data.

## 15. First vertical slice

The first end-to-end deliverable must demonstrate:

1. Open the web application.
2. Upload a known monophonic format-0 MIDI file.
3. Parse it in the shared C++ core compiled to WebAssembly.
4. Map pitches to a configurable three-string instrument.
5. Report unplayable notes.
6. Display converted events.
7. Press Play.
8. Watch current and next LEDs in the simulator.
9. Pause, restart, and change speed.
10. Run deterministic native C++ tests over the same MIDI fixture.

After this works, add:

1. Format-1 track selection
2. Channel selection
3. Polyphony detection
4. Explicit melody reduction
5. Converted-song export

## 16. First-release acceptance criteria

The first release is complete when:

- A user can upload a valid format-0 or format-1 MIDI file in the browser.
- MIDI parsing and all musical conversion occur in C++ compiled to WebAssembly.
- The application clearly reports incompatible or altered material.
- A user can select the melody source when necessary.
- The importer deterministically assigns playable notes to strings and frets.
- The simulator shows current and next-note LEDs at the correct times.
- Play, pause, restart, and speed adjustment work without timing jumps.
- The same core sources compile for native tests, WebAssembly, and the selected ESP32 PlatformIO environment.
- Automated tests cover parsing, conversion, fingering, timing, and LED output.
- The web build can be shared as a static deployment.
- The README documents local development, tests, WebAssembly build, and deployment.

## 17. Information required from the team

Obtain the following before physical integration:

1. Exact ESP32 model and board schematic
2. Flash and PSRAM capacity
3. Touchscreen model, resolution, and orientation
4. Touch/display interface, such as SPI or parallel RGB
5. UI framework, such as LVGL or custom rendering
6. Arduino framework or ESP-IDF under PlatformIO
7. ESP-NOW audio architecture
8. Audio sample rate and timing requirements
9. Existing task priorities and core assignments
10. Available GPIO and intended LED data pin
11. Existing repository structure and build targets
12. Filesystem or flash-partition design
13. Song Stick open-string tuning
14. Number of frets
15. Treatment of open strings
16. Preferred beginner fret range
17. Neck geometry and eventual physical LED mapping

## 18. Open product decisions

- Default handling of polyphonic MIDI beyond the proposed highest-note reduction
- Whether the first release needs manual fingering correction
- Exact Song Stick tuning and playable fret range
- Whether completion clears the LEDs or returns to first-note-ready
- Final touchscreen dimensions and UI framework
- Import and storage limits appropriate to the selected ESP32
- Whether MIDI files will eventually be parsed on-device or converted to a compact device format before installation

## 19. Related project file

The earlier electronics BOM is parked pending details of the team’s existing board and is available at `WE Maker Shed/Song Stick - Electronics BOM.md`.
