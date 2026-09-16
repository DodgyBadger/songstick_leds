# Browser simulator

The integration harness lives under `web/`. It loads the C++ playback core
through the generated Embind module and renders playback state and LED output.
The top-level web page frames a bounded mock instrument touchscreen above the
virtual strip; it remains a prototype rather than approved final visual design.

When requirements arrive, keep the domain/playback model independent from DOM
rendering and transport. Treat the browser LED display as an adapter for the
same observable behavior expected from the physical strip.

The harness uses TypeScript and Vite without a UI framework. Do not treat its
markup, styling, demo song, or control layout as final product design. Its
configurable physical-strip view and provisional 12-fret, one-LED-per-fret RGB
default are confirmed simulator requirements. The default also includes one
shared RGB `OPEN` indicator before fret 1. Do not add
a UI framework, song schema, or persistence mechanism without a requirement and
an implementation plan. Any development server must follow the networking rules
in `environment.md`.

Run `npm run dev` for the strict `0.0.0.0:43173` development server and
`npm run build` for the static production output. Set `VITE_BASE_PATH` when the
static host serves the application below an origin path. The stable shared development
hostname is `songstick.dodgybadger.icu`; keep it in Vite's explicit allowed-host
list rather than allowing arbitrary proxy hostnames.

The simulator saves browser-selected MIDI files and catalog metadata in
per-origin IndexedDB, loads those persisted bytes, and sends them to the
C++/WASM importer. Files never need to leave the visitor's browser and clearing
site data removes imported songs. Files are catalogued using their original names. Import adds a file to the library;
the separate song selector lists, plays, and deletes stored files. Delete must
require confirmation.
Preserve the original import filename as catalog metadata; never show the opaque
storage identifier as the normal song label. The instrument UI uses explicit
`library`, `player`, and `manage` screen states. Selecting a whole song row opens
Player; do not put transport controls in the song list. Keep normal navigation
full-screen and use an in-screen overlay only for confirmed deletion. Use the
pinned Lucide dependency for interface icons rather than text glyphs.
The prototype catalog also includes a known-good built-in MIDI demonstration
song lasting at least 10 musical seconds. Mark it as built-in and do not offer
Delete for it. Keep selector rows strictly single-line; omit secondary metadata
instead of wrapping it beneath the filename.
Keep detailed diagnostics, strip configuration, and other developer controls
outside the bounded instrument screen. The 320×240 and 480×320 presets are
provisional and must not be recorded as final hardware dimensions.
TypeScript may display returned summaries and diagnostics but must not parse
MIDI, resolve tempo, or assign fingerings.
