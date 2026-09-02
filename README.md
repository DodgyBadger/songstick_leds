# Songstick LEDs

Control software and a browser simulator for an ESP32-powered, LED-guided
three-string song stick. The first implementation slice provides a portable C++
playback core compiled natively and to WebAssembly, plus a minimal browser
integration harness.

## Bootstrap

Prerequisites are uv 0.12.x, Node.js 22, npm, and Bash. `uv` will obtain or select
Python 3.11. If you use `nvm`, run `nvm use` after cloning.

```bash
./scripts/bootstrap
./scripts/check-env
```

The bootstrap is safe to run again. It runs `uv sync --locked` to reproduce the
repository-local Python environment and PlatformIO CLI. It uses the committed
JavaScript lockfile with `npm ci --include=dev`. Run tools such as PlatformIO
with `uv run pio`.

## Build and test

```bash
./scripts/test-native
./scripts/test-wasm
npm test
npm run build
```

The core is C++17 and uses CMake/Ninja. The WebAssembly facade is built with the
container-provided Emscripten SDK and tested from Node before the web build.

## Browser integration harness

```bash
npm run dev
```

The server binds to `0.0.0.0:43173` and fails if that port is already occupied.
The stable shared URL is `https://songstick.dodgybadger.icu`, forwarded by Caddy
to port `43173`.
It displays a fixed, already-fingered test song on a configurable physical RGB
strip simulation. The provisional default is one shared RGB open indicator plus
12 frets with one LED per fret;
density, controller description, and explicit index mapping can be changed in
the browser. Playback and logical LED snapshots remain authoritative C++/WASM
output. The current screen is still an evolving simulator, not an approved
touchscreen design.

The simulator can also import MIDI files into a persistent development song
library under ignored `var/midi-uploads/`. The separate song selector lists the
stored files and provides Play and confirmed Delete actions. Play reloads the
saved bytes before passing them to the portable C++ core. This storage endpoint
exists only in the Vite development/preview server and is not part of the static
build. Parsing, tempo resolution, validation, and provisional A-Mixolydian
fingering all run in the portable C++ core. Format 1, polyphony reduction, and
final instrument calibration remain future work. Current tuning assumptions are documented in
[`docs/product/provisional-instrument-profile.md`](docs/product/provisional-instrument-profile.md).

See [AGENTS.md](AGENTS.md) for coding-agent guidance and
[docs/agents/environment.md](docs/agents/environment.md) for environment details.
Project documentation is indexed in [docs/README.md](docs/README.md).
