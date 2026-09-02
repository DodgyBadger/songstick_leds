# Plan 0007: Built-in prototype demo song

- **Status:** Completed
- **Owner:** Development team
- **Created:** 2026-09-02
- **Updated:** 2026-09-02
- **Related requirements:** [Song library and selection](../product/requirements.md#80-song-library-and-selection)
- **Related ADRs:** [ADR 0006](../adrs/0006-platform-song-library-adapter.md)

## Outcome

The prototype song selector always contains a known-good Songstick demo that can
be played without importing a file.

## Scope

### Included

- A small valid format-0, monophonic built-in MIDI song
- Catalog listing and retrieval through the existing development adapter
- A visible built-in label and Play action
- Protection against deletion through both UI and API
- Tests and documentation

### Excluded

- A final bundled song collection
- User customization of built-in content
- Treating this development representation as the ESP32 packaging format

## Constraints and assumptions

- “Always at least one” means the built-in entry cannot be deleted.
- The demo uses pitches playable by the provisional instrument profile.
- Imported songs remain separately persisted and deletable.

## Approach

Expose constant known-good MIDI bytes as a read-only catalog record from the
development storage adapter. Reuse the selector's existing Play behavior and
mark the record as built-in so rendering can omit Delete.

## Work breakdown

1. Record the prototype requirement and assumptions.
2. Add and serve a built-in MIDI catalog entry.
3. Distinguish and protect it in the selector.
4. Verify playback compatibility, listing, retrieval, and deletion rejection.
5. Update documentation and close the plan.

## Verification

- An empty runtime directory still lists one song.
- Built-in bytes pass the WASM MIDI importer and use playable positions.
- GET returns the built-in MIDI; DELETE is rejected.
- Existing imported-song behavior remains green.
- Full tests, type checks, build, and environment checks pass.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Demo drifts from importer support | Exercise the bytes through WASM tests. |
| User expects to delete every entry | Label it clearly and omit Delete. |
| Built-in bytes imply device packaging | Keep them in the development adapter and document prototype scope. |

## Open questions

- Final preloaded controller songs remain a future content decision.

## Outcome record

- **Result:** Completed
- **Completed:** 2026-09-02
- **What changed:** Added a two-note, format-0 built-in MIDI record, read-only
  catalog retrieval, a visible Built in badge, and UI/API deletion protection.
- **Verification performed:** `npm test`, `npm run build`,
  `./scripts/check-env`, and `git diff --check` passed. WASM imported both demo
  notes successfully. Live Vite checks listed the built-in alongside the prior
  upload, retrieved all 67 bytes, and rejected deletion with HTTP 409.
- **Follow-up work:** Choose final bundled controller content and packaging only
  after device storage constraints are known.

## Follow-up update: 2026-09-02

Usability feedback showed the initial two-note demo was too short to evaluate
the LED sequence. It was expanded to 20 notes and exactly 10 musical seconds at
100% speed. The selector's secondary size/date line was also removed so every
song entry remains strictly single-line.
