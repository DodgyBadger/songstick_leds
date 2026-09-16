# ADR 0006: Keep song-library persistence in platform adapters

- **Status:** Accepted
- **Date:** 2026-09-02
- **Deciders:** Development team
- **Related plans:** [Plan 0006](../plans/0006-song-selector.md)
- **Supersedes:** None
- **Superseded by:** None

## Context

The product workflow now separates installing MIDI files from selecting a stored
song to play. Both the browser simulator and ESP32 will need a song catalog, but
their filesystems, metadata constraints, and provisioning mechanisms differ. The
portable core should continue to receive bytes and own musical conversion only.

## Decision drivers

- Exercise the final two-step import and selection workflow in the simulator.
- Preserve original filenames for a human-readable selector.
- Avoid embedding Node filesystem assumptions in portable C++.
- Avoid prematurely choosing an ESP32 filesystem or device song format.

## Considered options

### Option: Put the catalog in the portable core

This could share listing behavior but would couple the core to allocation,
persistence, and lifecycle concepts that differ by platform.

### Option: Treat imported browser files as the device format

This would imply that ESP32 must retain and parse raw MIDI before its storage and
conversion requirements are known.

### Option: Platform-owned catalog adapters

Each platform owns storage and returns selected bytes to the portable importer or
playback core. The browser implementation can evolve without constraining ESP32.

## Decision

Keep song-library listing, import persistence, retrieval, and deletion in a
platform adapter. For development, store raw MIDI files and adjacent JSON
metadata beneath `var/midi-uploads/`; expose same-origin list, create, retrieve,
and delete operations through the Vite server. The browser passes retrieved raw
bytes to WASM only when Play is selected.

This establishes an interaction boundary, not a shared persistence schema. The
ESP32 adapter may store raw MIDI or a converted representation once device
constraints are known.

## Consequences

### Positive

- Browser and eventual instrument can present the same user workflow.
- Original filenames and import timestamps survive browser sessions.
- Unsupported MIDI remains available for diagnosis and future importer upgrades.

### Negative

- Catalog implementations are platform-specific.
- Raw MIDI compatibility is discovered when Play is selected in this slice.
- Development metadata sidecars are not device-ready artifacts.

### Follow-up

- Define ESP32 filesystem, capacity, and device song representation after board
  details are confirmed.
- Consider compatibility status in catalog metadata when the import workflow can
  resolve format-1 tracks and other user decisions.

## Follow-up update: 2026-09-16

[ADR 0008](0008-browser-local-demo-storage.md) replaces the browser adapter's
development filesystem and HTTP implementation with IndexedDB for the static
public demo. The platform-owned catalog boundary decided here remains unchanged.
