# Plan 0008: Tiny-screen instrument interface

- **Status:** Completed
- **Owner:** Development team
- **Created:** 2026-09-02
- **Updated:** 2026-09-02
- **Related requirements:** [Player interface](../product/requirements.md#91-player-interface)
- **Related ADRs:** [ADR 0007](../adrs/0007-explicit-touchscreen-screen-states.md)

## Outcome

The simulator presents a bounded instrument touchscreen with separate Songs,
Player, and Manage screens above the virtual LED strip. Playback and tempo are
available only on Player.

## Scope

### Included

- Provisional 320×240 and 480×320 mock-screen presets
- Full-screen Songs, Player, and Manage states
- Whole-row song selection that prepares but does not start playback
- Player-only transport, progress, and 50–100% tempo controls
- Import and delete management screen
- Bounded delete confirmation overlay
- Simulator configuration and diagnostics below the LED strip
- Updated product, architecture, agent, and user documentation

### Excluded

- Final display dimensions, orientation, or embedded UI framework
- Animation or transition design
- Hardware touch input
- New MIDI compatibility behavior
- Final visual branding

## Constraints and assumptions

- The two viewport sizes are provisional review aids.
- Tempo changes use 10-percentage-point steps within the existing 50–100% range.
- The whole filename row is a selection target; no Play icon appears in Songs.
- Detailed conversion failures remain available outside the device mock.

## Approach

Keep a local explicit screen-state controller in the browser adapter. Reuse the
existing catalog, WASM playback, and LED mapping while reorganizing their UI
bindings. Use ordinary sections with `hidden` state and a bounded confirmation
overlay, without a router or UI framework.

## Work breakdown

1. Record the screen-state architecture and confirmed interaction.
2. Replace stacked import/library/playback panels with the mock touchscreen.
3. Bind selection, playback, tempo, import, deletion, and navigation states.
4. Move developer-only controls below the virtual strip.
5. Verify both viewport presets, full behavior, builds, and regressions.

## Verification

- TypeScript, native, WASM, and web tests pass.
- Production build succeeds.
- Served HTML contains one bounded screen and the three state panels.
- The catalog API remains available and the built-in demo remains compatible.
- Manual review confirms content stays within both provisional viewport bounds.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Prototype dimensions are mistaken for hardware | Label presets provisional everywhere. |
| Navigation state diverges from playback state | Keep screen selection in the adapter and playback in C++. |
| Conversion errors do not fit | Show a concise status in Player and details below the strip. |
| Delete becomes too easy | Require a separate bounded confirmation overlay. |

## Open questions

- Final display size, orientation, and touchscreen technology remain unknown.

## Outcome record

- **Result:** Completed
- **Completed:** 2026-09-02
- **What changed:** Replaced stacked web controls with a bounded device mock and
  explicit Songs, Player, and Manage states. Song rows now navigate rather than
  play directly; Player owns transport, progress, and tempo; Manage owns import
  and confirmed deletion. Developer controls moved below the virtual strip.
- **Verification performed:** `npm test`, `npm run build`,
  `./scripts/check-env`, and `git diff --check` passed. New structure tests verify
  the bounded screen ordering, all three states, one exclusive transport area,
  and external diagnostics. The live Vite server exposes the new markup and the
  compatible built-in catalog record.
- **Follow-up work:** Gather visual/usability feedback at both provisional sizes
  and replace them once the actual display is selected.
