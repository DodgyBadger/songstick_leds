# Plan 0002: Configurable LED strip simulator

- **Status:** Completed
- **Owner:** Development team
- **Created:** 2026-08-06
- **Updated:** 2026-08-06
- **Related requirements:** [Logical LED behaviour](../product/requirements.md#811-logical-led-behaviour), [Physical LED mapping](../product/requirements.md#812-physical-led-mapping), [Browser simulator](../product/requirements.md#9-browser-simulator-requirements)
- **Related ADRs:** [ADR 0002](../adrs/0002-explicit-led-strip-mapping.md)

## Outcome

The online simulator presents playback on a recognizable physical LED strip
instead of text cards. A user can configure fret count, LEDs per fret, optional
LED density, controller description, and explicit fret-to-index mapping without
changing the C++ musical playback behavior.

## Scope

### Included

- Default RGB strip with 12 frets and one LED per fret
- Red, green, and blue string colors from the product requirements
- Current-note and next-note logical intensity
- Editable fret count, LEDs per fret, optional LEDs/metre, controller label, and
  explicit index mapping
- Validation for mapping shape, duplicate indexes, and non-negative integers
- Clear fret and physical-index labels
- Developer snapshot retained behind a disclosure control
- Responsive browser layout

### Excluded

- Electrical timing or controller protocol emulation
- Real-world brightness, power, gamma, or color calibration
- Saving configurations or exporting them to firmware
- Final neck geometry and unequal physical fret spacing
- Product UI approval or touchscreen-specific visual design

## Constraints and assumptions

- Confirmed provisional defaults are RGB, one LED per fret, and 12 frets.
- LED density and controller are unspecified by default and do not affect
  playback behavior.
- Fret 1 maps to LED index 0 through fret 12 mapping to index 11 by default.
- A physical LED shared by current and next logical output gives current output
  priority, consistent with the product requirements.
- Browser configuration remains a platform adapter concern under ADR 0002.

## Approach

Add a typed `LedStripConfig` and pure parsing/validation/mapping functions in the
web adapter. Render physical LEDs in index order and annotate each with its
mapped fret. On every WASM frame, clear the physical strip, apply next outputs,
then current outputs so priority is deterministic. Use CSS opacity and glow to
represent logical intensity, not electrical brightness.

The configuration editor accepts one semicolon-separated group per fret and
comma-separated indexes within a group. For example, `0;1;2` maps three frets
with one LED each, while `0,1;2,3` maps two LEDs to each of two frets.

## Work breakdown

1. Define configuration, defaults, parser, and validation.
2. Add the physical strip renderer and logical-to-physical frame mapping.
3. Add configuration controls with inline errors and reset behavior.
4. Move raw snapshots into optional developer details.
5. Verify type checking, tests, production output, and the shared-host runtime.

## Verification

- `npm test`
- `npm run typecheck`
- `npm run build`
- HTTP checks using `Host: songstick.dodgybadger.icu`
- Confirm default 12-LED mapping and all three string colors during playback.
- Confirm invalid, duplicate, incomplete, and multi-LED mappings are handled.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Simulator details are mistaken for hardware decisions | Label density/controller as unspecified and the profile as provisional. |
| Mapping syntax is difficult to understand | Show generated defaults, a concrete example, and inline validation. |
| Physical mapping leaks into musical playback | Keep mapping entirely after the WASM logical frame boundary. |
| Dense strips overflow small screens | Use horizontal scrolling and a minimum LED size. |

## Open questions

- Exact LED density and controller remain team hardware decisions.
- Whether open strings have a physical LED remains unresolved; this slice maps
  frets 1 through 12 only.
- Persistence and import/export require a later configuration-schema decision.

## Outcome record

- **Result:** Completed
- **Completed:** 2026-08-06
- **What changed:** Replaced the primary logical-output text cards with a
  physical RGB strip simulation. Added a provisional 12-fret default, explicit
  index mapping, configurable LEDs/fret, optional density and controller fields,
  RGB string colors, current/next intensity, collision priority, responsive
  presentation, and collapsed developer diagnostics.
- **Verification performed:** `npm test`, `npm run build`, and
  `./scripts/check-env` passed. Browser-side tests cover defaults, invalid and
  duplicate mappings, sparse multi-LED mappings, string colors, and current-note
  priority. Local HTTP checks with the forwarded production Host header returned
  200 for the page and generated module. Direct public curl receives the host's
  expected authentication response and was not used to bypass access control.
- **Follow-up work:** Gather real strip density, controller, fret geometry, and
  open-string treatment; then define a versioned shared configuration schema
  before firmware export.
