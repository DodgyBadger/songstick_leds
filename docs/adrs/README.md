# Architecture decision records

Use an ADR for a significant, durable technical decision whose context and
tradeoffs future contributors will need to understand. Examples include the
portable-core boundary, WebAssembly binding strategy, canonical serialization,
or an embedded framework choice. Routine implementation details do not need an
ADR.

## Naming

Name ADRs with a four-digit sequence and short kebab-case title:

```text
0001-use-embind-for-initial-wasm-boundary.md
0002-device-song-serialization.md
```

Copy [`template.md`](template.md), choose the next unused number, and add it to
the index below. Numbers are never reused.

## Statuses

- **Proposed:** Open for review; not yet authoritative.
- **Accepted:** The current decision.
- **Rejected:** Considered but not adopted.
- **Superseded:** Replaced by another ADR, linked in both records.

An accepted ADR is a historical record. Correct minor errors in place, but
replace a changed decision with a new ADR that supersedes the old one.

## Index

| ADR | Status | Decision |
|---|---|---|
| [0001](0001-wasm-snapshot-boundary.md) | Accepted | Use Embind on a facade that exchanges coarse playback and LED snapshots. |
| [0002](0002-explicit-led-strip-mapping.md) | Accepted | Map logical fret output to explicit physical LED indexes in platform configuration. |
| [0003](0003-explicit-playable-position-profile.md) | Accepted | Convert pitch using explicit playable string/fret positions. |
| [0004](0004-dedicated-shared-open-led.md) | Accepted | Use one configurable shared RGB LED for logical fret 0. |
| [0005](0005-development-midi-storage.md) | Accepted | Keep disk-backed MIDI uploads in a development-server adapter outside the portable core. |
