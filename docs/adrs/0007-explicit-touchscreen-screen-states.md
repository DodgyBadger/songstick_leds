# ADR 0007: Use explicit touchscreen screen states

- **Status:** Accepted
- **Date:** 2026-09-02
- **Deciders:** Development team
- **Related plans:** [Plan 0008](../plans/0008-tiny-screen-interface.md)
- **Supersedes:** None
- **Superseded by:** None

## Context

The initial simulator presented import, song selection, playback, tempo, and
developer controls as stacked web panels. This duplicated Play controls and did
not test the constraints of the eventual small on-instrument touchscreen.
Normal navigation and destructive confirmation also need distinct interaction
patterns that can translate to an embedded UI without requiring a web router.

## Decision drivers

- Prototype the on-instrument interaction rather than a desktop web application.
- Avoid duplicate transport controls.
- Keep each screen understandable at a small viewport.
- Preserve a simple state model that can be reimplemented on ESP32.
- Keep developer-only controls available without placing them on the instrument.

## Considered options

### Option: Continue with stacked web panels

This keeps all controls visible but hides the navigation and space constraints
that need early usability feedback.

### Option: Use nested modal dialogs

Dialogs conserve apparent space but create awkward navigation and focus behavior
when used for ordinary tasks.

### Option: Explicit full-screen states

A small state set makes one task primary at a time. A transient overlay remains
appropriate for confirming permanent deletion.

## Decision

Model the instrument prototype with three explicit states: `library`, `player`,
and `manage`. Selecting a library row loads the song and navigates to Player but
does not begin playback. Player exclusively owns Play/Pause, Restart, progress,
and tempo. Manage owns import and deletion. Use a bounded confirmation overlay
only for deletion.

Render this stateful interface inside a mock screen above the virtual LED strip.
Keep strip configuration, detailed import diagnostics, and raw snapshots in web
developer panels outside the device mock. Use 320×240 and 480×320 only as
provisional review presets, not hardware decisions.

## Consequences

### Positive

- Feedback now exercises space and task boundaries closer to the instrument.
- Transport and tempo controls have one authoritative location.
- Navigation can map to a small embedded state machine later.

### Negative

- Fewer operations are visible simultaneously.
- Some simulator-only details require scrolling below the virtual strip.
- Exact density and sizing must be revisited when the display is known.

### Follow-up

- Validate the flow with team members at both provisional viewport sizes.
- Confirm the physical display dimensions, orientation, and touch technology.
