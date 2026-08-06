# Plan 0004: Open-string indicator

- **Status:** Completed
- **Owner:** Development team
- **Created:** 2026-08-06
- **Updated:** 2026-08-06
- **Related requirements:** [Instrument profile](../product/requirements.md#81-instrument-profile), [Physical LED mapping](../product/requirements.md#812-physical-led-mapping)
- **Related ADRs:** [ADR 0004](../adrs/0004-dedicated-shared-open-led.md)

## Outcome

Open-string MIDI notes are valid automatic fingerings and illuminate a dedicated
shared RGB `OPEN` position before fret 1 in the simulator. Its physical indexes
are explicit and configurable.

## Scope

### Included

- Fret-zero positions for all provisional open strings
- Default open mapping at LED index 0 and frets 1–12 at indexes 1–12
- Configurable one-or-more open LED indexes
- Open label and visual separation in the simulator
- Current/next priority and all three string colors
- MIDI, mapping, WASM, browser, and documentation tests

### Excluded

- Multi-string chord display
- Final mounting geometry or electrical controller choice
- A dedicated open LED per string

## Constraints and assumptions

- Open remains logical fret 0 and is independent of physical index 0.
- The default physical strip grows from 12 to 13 LEDs.
- One shared RGB open LED is sufficient for current monophonic teaching.
- Automatic fingering keeps the existing deterministic score, so an open
  position may be chosen when it minimizes movement or fret number.

## Approach

Extend the explicit playable-position profile with each open pitch at fret 0.
Extend platform strip configuration with `openLedIndexes`, validated for unique
non-negative indexes alongside fret mappings. Render open before the fret LEDs
when configured that way, without adding special cases to playback state.

## Work breakdown

1. Record the open-indicator decision and update assumptions.
2. Add fret-zero playable positions and native tests.
3. Extend strip parsing, mapping, configuration UI, and rendering.
4. Update product and agent documentation.
5. Run all checks and record the result.

## Verification

- Provisional profile contains A2, E3, and A3 at fret 0.
- MIDI conversion can select an open position.
- Default strip renders 13 physical LEDs with `OPEN` at index 0.
- Duplicate open/fret indexes are rejected.
- Current/next and RGB string behavior work at open.
- `npm test`, `npm run build`, and shared-host HTTP checks pass.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Fret 0 becomes coupled to physical index 0 | Keep explicit `openLedIndexes`. |
| Open/fret index collision creates ambiguity | Validate uniqueness across all mappings. |
| Shared LED is mistaken for chord support | Document monophonic scope and defer chords. |

## Open questions

- Exact nut-adjacent placement awaits the completed instrument.

## Outcome record

- **Result:** Completed
- **Completed:** 2026-08-06
- **What changed:** Added provisional fret-zero playable positions, profile
  version `v2`, a configurable shared-open physical mapping, a default 13-LED
  strip, distinct `OPEN` rendering, and an open note at the start of the demo.
- **Verification performed:** `npm test`, `npm run build`,
  `./scripts/check-env`, and shared-host HTTP checks passed. Native tests verify
  open A2 fingering; WASM tests verify profile identity and fret-zero output;
  browser tests verify default mapping, RGB output, collision priority, and
  rejection of open/fret index reuse.
- **Follow-up work:** Verify the nut-adjacent mounting location on the completed
  stick and revisit simultaneous-string display only when chord teaching is
  planned.
