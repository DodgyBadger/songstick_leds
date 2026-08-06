# ADR 0001: Use an Embind snapshot boundary for the initial WebAssembly API

- **Status:** Accepted
- **Date:** 2026-08-06
- **Deciders:** Songstick development team
- **Related plans:** [Plan 0001](../plans/0001-portable-core-wasm-slice.md)
- **Supersedes:** None
- **Superseded by:** None

## Context

The product requires one C++ implementation of playback behavior compiled both
natively and to WebAssembly. Browser code needs to issue playback commands and
observe complete state and logical LED output. The API will evolve as MIDI and
instrument conversion are added, while the portable core must remain free of
browser and Emscripten types.

## Decision drivers

- Preserve a strict portable-core/platform-adapter boundary.
- Prevent TypeScript from reimplementing playback calculations.
- Keep browser crossings coarse and deterministic.
- Permit rapid API iteration during the first vertical slices.
- Avoid binding internal containers and ownership semantics.

## Considered options

### Bind the C++ domain model directly with Embind

This is quick initially, but exposes internal classes, container choices, and
lifetime rules to JavaScript. Ordinary core refactors would become browser API
changes.

### Expose an Embind facade with command methods and snapshots

A separate facade translates browser inputs to core commands and returns
complete playback/LED snapshots. It adds a small translation layer while
keeping ownership and internals private.

### Define a stable C ABI immediately

A C ABI offers maximum control and potentially smaller output, but requires
manual serialization and memory handling before the API and song schema have
stabilized.

## Decision

Use Embind on a WebAssembly-only facade. Expose coarse command methods and
complete snapshot values. Do not bind portable domain classes, standard-library
containers, or individual LEDs. Keep all Emscripten headers and types outside
the portable core.

Reconsider a C ABI after the canonical song/export schema stabilizes or if
measured module size and call overhead justify the additional complexity.

## Consequences

### Positive

- Core code remains compilable without Emscripten.
- JavaScript receives authoritative, internally consistent state.
- Browser calls do not scale with the number of LEDs.
- Binding implementation can change without reshaping core ownership.

### Negative

- Snapshot fields must be maintained explicitly in the facade.
- Embind adds generated glue and some module-size overhead.
- The facade is not yet a stable cross-language ABI.

### Follow-up

- Measure output size and integration ergonomics after the MIDI import slice.
- Create a superseding ADR if adopting a C ABI or serialized message boundary.
