# ADR 0002: Keep explicit LED strip mapping outside musical playback

- **Status:** Accepted
- **Date:** 2026-08-06
- **Deciders:** Songstick development team
- **Related plans:** [Plan 0002](../plans/0002-configurable-led-strip-simulator.md)
- **Supersedes:** None
- **Superseded by:** None

## Context

The playback core identifies a logical string and fret, while physical strips
vary in density, LED count, controller, neck geometry, and index wiring. The
browser must simulate those particulars, and eventual firmware must translate
the same logical output to its installed strip. Physical configuration must not
change MIDI interpretation or playback timing.

## Decision drivers

- Support non-contiguous, reversed, and multiple-LED fret mappings.
- Avoid assuming equal physical fret spacing or one LED per string.
- Keep controller and electrical details out of portable musical behavior.
- Make logical-to-physical collisions deterministic.
- Permit browser simulation before hardware is finalized.

## Considered options

### Derive LED indexes arithmetically in the playback core

This is simple for one strip layout but couples musical positions to wiring and
cannot represent calibration gaps or unusual index order without core changes.

### Store a single first index and fixed LEDs-per-fret rule

This supports dense uniform strips but cannot describe skipped, reversed, or
individually calibrated indexes.

### Use an explicit fret-to-index mapping in platform configuration

Each fret maps to one or more physical indexes. Platform adapters apply the
mapping after receiving a logical frame, while descriptive hardware fields stay
alongside the mapping.

## Decision

Keep the portable core output as logical `string + fret + role + intensity`.
Represent physical strip layout with an explicit mapping from each playable
fret to one or more unique non-negative LED indexes. Store density, controller,
color order, and similar electrical metadata in platform configuration, not the
playback algorithm.

When multiple logical outputs resolve to one physical index, apply next output
first and current output second so current takes priority.

## Consequences

### Positive

- Musical behavior remains independent of installed hardware.
- Mapping can describe gaps, reversal, density, and multiple LEDs per fret.
- The simulator can expose both logical frets and physical indexes.

### Negative

- Configuration requires explicit validation.
- Browser and firmware adapters must implement the same mapping semantics.
- A shared serialized configuration schema is still needed before export.

### Follow-up

- Define a versioned shared configuration schema before firmware export.
- Validate the provisional mapping against the real neck and strip.
