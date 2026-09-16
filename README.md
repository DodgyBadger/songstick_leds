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

The simulator models a small instrument touchscreen above the virtual LED strip,
with separate Songs, Player, and Manage screens. Selecting a stored song opens
Player, where Play/Pause, Restart, progress, and tempo controls live. Manage
imports MIDI files into browser-local IndexedDB and provides confirmed deletion.
Imports stay on the visitor's device and persist across browser sessions unless
site data is cleared. A non-deletable built-in demo is always available.
Selecting a song reloads its saved bytes before passing them to the portable C++
core. Parsing, tempo resolution, validation, and provisional A-Mixolydian
fingering all run in the portable C++ core. Format 1, polyphony reduction, and
final instrument calibration remain future work. Current tuning assumptions are documented in
[`docs/product/provisional-instrument-profile.md`](docs/product/provisional-instrument-profile.md).

## Publish the browser demo

The static build is ready for GitHub Pages. In the GitHub repository, choose
**Settings → Pages → Build and deployment → GitHub Actions** once. Pushes to
`main` then run the pinned Node 22 and Emscripten 6.0.6 build and publish `dist/`
at `https://<owner>.github.io/songstick_leds/`. The workflow can also be run
manually from the Actions tab.

The default workflow base path targets the repository URL above. Adjust
`VITE_BASE_PATH` in `.github/workflows/deploy-pages.yml` if the repository is
renamed or the site moves to a root custom domain.

See [AGENTS.md](AGENTS.md) for coding-agent guidance and
[docs/agents/environment.md](docs/agents/environment.md) for environment details.
Project documentation is indexed in [docs/README.md](docs/README.md).
