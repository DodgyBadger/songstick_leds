# Implementation plans

Use a plan for work that spans multiple components, introduces a new subsystem,
or benefits from explicit sequencing and verification. Small, local changes do
not require one.

## Naming

Name plans with a four-digit sequence and short kebab-case title:

```text
0001-portable-core-wasm-spike.md
0002-format-zero-midi-import.md
```

Copy [`template.md`](template.md), choose the next unused number, and add the
plan to the index below. Numbers are never reused.

## Statuses

- **Draft:** Under discussion; implementation has not started.
- **Active:** Approved and currently being implemented.
- **Completed:** Delivered and verified; record the outcome.
- **Abandoned:** Intentionally stopped; record why and what remains.

Keep an active plan current when scope, sequencing, or discoveries change. Once
completed or abandoned, treat it as a historical record; append corrections or
link a follow-up plan instead of rewriting its history.

## Index

| Plan | Status | Summary |
|---|---|---|
| [0001](0001-portable-core-wasm-slice.md) | Completed | Prove deterministic native and WebAssembly playback with a minimal browser harness. |
| [0002](0002-configurable-led-strip-simulator.md) | Completed | Replace text output with a configurable physical RGB strip simulation. |
| [0003](0003-format-zero-midi-import.md) | Completed | Import monophonic format-0 MIDI through C++/WASM and play it in the simulator. |
| [0004](0004-open-string-indicator.md) | Completed | Add a shared RGB open-string position to fingering and strip simulation. |
| [0005](0005-disk-backed-midi-upload.md) | Completed | Save browser-selected MIDI files to the development workspace before importing them. |
