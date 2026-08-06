# Product context and open decisions

Read [`../product/requirements.md`](../product/requirements.md) as the
authoritative specification before product-facing work. Follow
[`../product/README.md`](../product/README.md) when changing or versioning it.
This file is a concise routing aid and must not override the specification.

## Known

- The instrument has three strings and diatonic tuning.
- An LED strip runs along the side of the song stick.
- LEDs tell a learner which string and fret to play.
- Songs will be loaded onto an ESP32 and selected by the learner.
- A shareable browser simulator will support development and feedback without
  repeatedly flashing hardware.

## Not yet specified

- Physical fret count and LED-to-string/fret mapping
- Tuning, note representation, chords, rhythm, and lesson progression
- ESP32 board, LED chipset, controls, display, storage, and electrical design
- Song authoring and file format
- Simulator appearance, interactions, and sharing workflow

Update this document when the user confirms decisions. Clearly distinguish a
confirmed requirement from an implementation choice or temporary assumption.
