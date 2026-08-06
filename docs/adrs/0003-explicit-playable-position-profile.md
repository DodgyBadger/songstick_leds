# ADR 0003: Represent instrument tuning as explicit playable positions

- **Status:** Accepted
- **Date:** 2026-08-06
- **Deciders:** Songstick development team
- **Related plans:** [Plan 0003](../plans/0003-format-zero-midi-import.md)
- **Supersedes:** None
- **Superseded by:** None

## Context

The SongStick uses diatonic frets and may later gain chromatic frets. A formula
such as `open pitch + fret number` is incorrect for the current instrument and
would make alternate constructions difficult to represent. MIDI import needs a
deterministic list of pitches that can be assigned to illuminated positions.

## Decision drivers

- Correctly represent diatonic and later chromatic constructions.
- Support duplicate pitches available on different strings/frets.
- Keep tuning independent of physical LED indexes.
- Allow provisional profiles to be replaced without parser changes.
- Produce deterministic automatic fingering.

## Considered options

### Derive pitch chromatically from open string and fret

Compact, but incorrect for a diatonic fretboard.

### Store scale intervals plus open-string pitches

Correct for the current uniform layout, but assumes every string shares one
interval pattern and makes irregular additions harder to express.

### Store explicit pitch, string, and fret positions

Slightly more data, but represents any playable layout and separates profile
generation from fingering.

## Decision

The instrument profile presented to conversion contains explicit playable
positions of `MIDI pitch + string + fret`. Profile construction may generate
those positions from open strings and scale intervals, but fingering consumes
only the explicit table.

Pitch selection uses deterministic scoring: minimize fret movement, then string
changes, then lower fret, then lower string index. Provisional profile details
are recorded separately and must not be presented as confirmed hardware facts.

## Consequences

### Positive

- Diatonic, chromatic, and irregular fretboards share one conversion API.
- MIDI parsing remains independent of instrument geometry.
- Tests can use small synthetic profiles without changing algorithms.

### Negative

- Profiles require validation for duplicates and invalid positions.
- Changing a profile may change generated fingerings for the same MIDI file.

### Follow-up

- Version the profile when converted-song export is introduced.
- Verify the provisional table against the physical SongStick.
