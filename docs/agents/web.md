# Browser simulator

The first integration harness lives under `web/`. It loads the C++ playback core
through the generated Embind module and renders coarse state and LED snapshots
for a fixed test song. It is architecture validation, not an approved product
interface or visual design.

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
`npm run build` for the static production output. The stable shared development
hostname is `songstick.dodgybadger.icu`; keep it in Vite's explicit allowed-host
list rather than allowing arbitrary proxy hostnames.

The current development upload flow saves browser-selected MIDI files through a
same-origin Vite endpoint under ignored `var/midi-uploads/`, loads those persisted
bytes, and sends them to the C++/WASM importer. This endpoint is a development
debugging adapter and is absent from a standalone static production build. Files
remain on disk until removed by a developer; there is no retention UI yet.
TypeScript may display returned summaries and diagnostics but must not parse
MIDI, resolve tempo, or assign fingerings.
