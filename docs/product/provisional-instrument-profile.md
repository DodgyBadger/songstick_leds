# Provisional instrument profile

**Status:** Assumptions pending verification against the completed SongStick
**Recorded:** 2026-08-06

This profile unblocks simulation and MIDI work. It is not a final construction
specification. Update it when the physical instrument arrives, and add migration
tests before changing any persisted song data derived from it.

## Assumptions

1. Open strings are `A2`, `E3`, and `A3` (MIDI 45, 52, and 57). The team email's
   `A3 E3 A4` is treated as a likely octave typo because it would not produce
   `D3 A3 D4` at the third diatonic fret.
2. All strings share twelve physical fret positions based on A Mixolydian:
   semitone offsets `2, 4, 5, 7, 9, 10, 12, 14, 16, 17, 19, 21` from each open
   string.
3. Frets are numbered 1–12 after the open position. Fret 3 is five semitones
   above open and therefore produces `D3 A3 D4` across the three strings.
4. Open strings are logical fret 0 and may be selected by automatic fingering.
   One shared RGB LED at or immediately behind the nut indicates open; its color
   identifies the string. Frets 1–12 retain one RGB LED each.
5. When a pitch has multiple positions, fingering minimizes fret movement first,
   then string changes, then lower fret number, with stable string order as the
   final tie-breaker.
6. Scale length is provisionally 24 inches. It affects future physical spacing,
   not pitch conversion or the current equally spaced browser rendering.
7. The strip is on the player-facing side of the neck. This affects later
   orientation and physical index calibration, not the initial logical mapping.

## Verification checklist

- Confirm all three open-string octaves.
- Confirm the exact number and pitch order of diatonic frets.
- Confirm the open indicator's exact nut-adjacent placement and visibility.
- Measure the final scale length and fret distances.
- Record strip direction, first physical LED, density, and controller.
- Confirm whether fret numbering and physical LED indexes increase in the same
  direction when viewed by the player.
