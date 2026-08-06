# Plan 0001: Portable playback core WebAssembly slice

- **Status:** Completed
- **Owner:** Development team
- **Created:** 2026-08-06
- **Updated:** 2026-08-06
- **Related requirements:** [First vertical slice](../product/requirements.md#15-first-vertical-slice), [WebAssembly boundary](../product/requirements.md#11-webassembly-boundary)
- **Related ADRs:** [ADR 0001](../adrs/0001-wasm-snapshot-boundary.md)

## Outcome

A deterministic, portable C++17 playback core runs the same fixed test song in
native tests and WebAssembly. A minimal browser harness drives it with supplied
monotonic timestamps and renders the logical current/next LED frame.

## Scope

### Included

- CMake/Ninja native and Emscripten builds
- Core song, playback state, speed, and logical LED frame types
- Start, pause, resume, restart, speed change, and externally timed update
- Deterministic native tests, including delayed frames and speed changes
- A compact Embind snapshot API
- Minimal TypeScript browser integration and static development build
- Reproducible commands and documentation

### Excluded

- MIDI parsing, melody selection, and fingering algorithms
- Physical LED indexes or hardware output
- ESP32 build target before the board and framework are confirmed
- Product visual design, persistence, deployment, and accessibility sign-off
- Audio synthesis and ESP-NOW integration

## Constraints and assumptions

- The core uses C++17 features supported by the host compiler, Emscripten, and
  expected ESP32 toolchains.
- The fixed song contains already resolved string/fret positions; it is test
  data, not a provisional instrument profile.
- Browser time is supplied in integer microseconds and the core never reads a
  platform clock.
- The container-provided Emscripten 3.1.6 is the current reproducible baseline.
- Playback owns no platform objects and performs no steady-state allocation.

## Approach

Build `songstick_core` as a platform-neutral CMake library. Playback stores a
prevalidated sequence of resolved events and derives state directly from an
integer song position. Platform adapters issue commands and call `update()` with
monotonic time. Logical LED frames are fixed-size snapshots containing current
and next positions.

The WebAssembly target wraps the core in a small facade. Embind exposes commands
and snapshot values without exposing internal containers or domain classes. The
browser harness imports only the generated module and renders the snapshots.

## Work breakdown

1. Define core value types and playback invariants.
2. Implement deterministic playback and native tests.
3. Add CMake presets/scripts for native and Emscripten builds.
4. Bind the facade with Embind and verify it under Node.
5. Add a dependency-light TypeScript/Vite browser harness.
6. Run all checks and record the delivered outcome.

## Verification

- `./scripts/build-native`
- `./scripts/test-native`
- `./scripts/build-wasm`
- `npm test`
- `npm run build`
- `./scripts/check-env`
- Native assertions cover stopped-ready, play, delayed update, pause/resume,
  restart, completion, and speed changes without timing jumps.
- A Node integration test exercises the generated WebAssembly module.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Embind types leak into the portable core | Compile bindings as a separate target and expose a facade. |
| Browser frame cadence changes playback | Derive state from supplied absolute monotonic time and test large jumps. |
| API churn creates fragile bindings | Transfer coarse snapshot objects described by ADR 0001. |
| Desktop behavior uses unsupported embedded features | Keep C++17 core dependency-free and compile without exceptions/RTTI-specific behavior. |

## Open questions

- Exact ESP32 board/framework remains required before adding the firmware target.
- Product completion behavior remains configurable later; this slice finishes
  with LEDs off and a `finished` state.

## Outcome record

- **Result:** Completed
- **Completed:** 2026-08-06
- **What changed:** Added a C++17 core with deterministic externally timed
  playback and logical LED frames; native tests; a WebAssembly-only Embind
  facade; a Node WASM integration test; and a minimal Vite/TypeScript browser
  harness using the same module.
- **Verification performed:** `./scripts/check-env`, `npm test`, `npm run build`,
  and HTTP smoke checks for `/` and `/wasm/songstick.wasm` all passed. Native
  tests cover ready, playing, delayed updates, pause/resume, speed changes,
  restart, completion, validation, empty songs, and duplicate LED positions.
- **Follow-up work:** Plan the format-0 MIDI import slice after confirming its
  parser limits and provisional instrument-position representation.
