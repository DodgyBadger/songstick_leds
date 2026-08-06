# ADR 0004: Use one shared RGB LED for the open-string position

- **Status:** Accepted
- **Date:** 2026-08-06
- **Deciders:** Songstick development team
- **Related plans:** [Plan 0004](../plans/0004-open-string-indicator.md)
- **Supersedes:** None
- **Superseded by:** None

## Context

Open strings are playable notes but have no fret to illuminate. Asking a player
to infer open from a fret LED pattern or look away at the touchscreen would make
the teaching language inconsistent. The current monophonic system already uses
one RGB LED per physical position and color to identify the string.

## Decision drivers

- Keep the neck indication visible where the player is looking.
- Reuse string color and current/next intensity semantics.
- Represent open as a real musical position rather than a special playback case.
- Preserve explicit physical index mapping.
- Avoid premature chord-display hardware.

## Considered options

### Blink fret 1 specially

Requires players to remember an exception and visually conflates open with fret
1.

### Show open only on the touchscreen

Clear in isolation, but divides attention between the neck and screen.

### Use three open LEDs

Can show several open strings simultaneously, but introduces string-specific
physical LEDs before the broader chord-display design is known.

### Use one shared RGB LED at the nut

Matches the existing one-position RGB language. Color identifies the string and
intensity/animation identifies current versus next.

## Decision

Represent open strings as logical `fret 0`. Add one shared RGB indicator at or
immediately behind the nut, before fret 1. The default physical mapping uses LED
index 0 for open and indexes 1–12 for frets 1–12.

The open indicator's indexes remain explicit configuration so later hardware may
map open to more than one LED. Current output takes priority over next output on
the shared indicator.

## Consequences

### Positive

- MIDI fingering can select open positions normally.
- The player receives one consistent neck-based visual language.
- The default strip has 13 LEDs but remains configurable.

### Negative

- A single LED cannot display multiple simultaneous open strings.
- Physical construction needs a clear nut-adjacent mounting position.

### Follow-up

- Verify placement and visibility on the completed stick.
- Address simultaneous strings as part of a future chord-display decision.
