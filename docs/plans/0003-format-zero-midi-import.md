# Plan 0003: Format-zero MIDI import

- **Status:** Completed
- **Owner:** Development team
- **Created:** 2026-08-06
- **Updated:** 2026-08-06
- **Related requirements:** [Standard MIDI support](../product/requirements.md#82-standard-midi-file-support), [First vertical slice](../product/requirements.md#15-first-vertical-slice)
- **Related ADRs:** [ADR 0003](../adrs/0003-explicit-playable-position-profile.md)

## Outcome

A user can upload a valid monophonic Standard MIDI File format 0, inspect its
metadata and diagnostics, convert it through the portable C++ core using the
documented provisional instrument profile, and play it on the simulated strip.

## Scope

### Included

- Bounds-checked format-0 header and track parsing
- Variable-length quantities, running status, note on/off, velocity-zero note
  off, tempo, track name, time signature, end-of-track, and safe event skipping
- PPQN timing resolved to integer microseconds through tempo changes
- Polyphony detection, unmatched-note and malformed-file diagnostics
- Explicit pitch-to-position conversion with deterministic fingering
- Raw MIDI bytes crossing the WASM boundary
- Browser file upload, summary, diagnostics, and playback
- Configurable import limits with conservative initial defaults

### Excluded

- Format 1, SMPTE division, SysEx interpretation, percussion interpretation,
  polyphony reduction, manual fingering, and exported device-song files
- Treating the provisional instrument assumptions as confirmed construction data

## Constraints and assumptions

- Use the [provisional profile](../product/provisional-instrument-profile.md).
- Reject rather than silently alter polyphonic or unplayable material.
- Parse arbitrary uploaded bytes without exceptions escaping or undefined access.
- Initial limits: 1 MiB file, one track, 100,000 MIDI events, 20,000 notes, and
  four-byte variable-length quantities.
- Import-time allocation is allowed; playback behavior remains precomputed.

## Approach

Add a dependency-free portable importer returning a canonical `Song`, summary,
and structured diagnostics. Parse events into tick-based notes and a tempo map,
validate monophony, then resolve ticks to integer microseconds. Run fingering as
a separate stage against explicit playable positions. The WASM facade copies one
uploaded `Uint8Array` into the importer and returns one coarse result snapshot.

## Work breakdown

1. Define importer, diagnostics, summary, limits, and instrument profile types.
2. Implement bounded parsing, timing, validation, and fingering.
3. Add valid and malformed native fixtures.
4. Add the WASM byte boundary and integration assertions.
5. Add browser upload, summary, diagnostics, and imported playback.
6. Run all checks and close the plan with actual results.

## Verification

- Native fixtures for format 0, tempo changes, running status, velocity-zero
  note off, truncation, invalid lengths, polyphony, and unplayable pitches
- WASM integration imports raw bytes and loads the resulting song
- `npm test`, `npm run build`, and shared-host HTTP checks

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Hostile lengths cause out-of-bounds access | Central bounded reader and configured limits. |
| Timing drifts across tempo changes | Preserve ticks and resolve with integer segment arithmetic. |
| Import silently changes music | Reject polyphony and unplayable pitches with explicit diagnostics. |
| Provisional tuning becomes implicit fact | Link every summary to the assumptions document and label the browser profile. |

## Open questions

- The physical instrument verification checklist remains open.
- Format-1 melody selection and polyphony reduction require a later plan.

## Outcome record

- **Result:** Completed
- **Completed:** 2026-08-06
- **What changed:** Added a bounded portable format-0 parser, integer tempo-map
  resolution, structured diagnostics, explicit provisional instrument positions,
  deterministic fingering, a single-call WASM byte-import boundary, and browser
  upload/summary/playback integration.
- **Verification performed:** `npm test`, `npm run build`,
  `./scripts/check-env`, and shared-host HTTP checks passed. Native fixtures cover
  running status, velocity-zero note-off, tempo changes, time signature,
  truncation, invalid variable-length quantities, polyphony, percussion, and
  unplayable pitches. WASM tests cover valid, malformed, and empty byte arrays.
- **Follow-up work:** Exercise the importer with the team's real MIDI collection,
  then plan format-1 track/channel selection and explicit polyphony reduction.
