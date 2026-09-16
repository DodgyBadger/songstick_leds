# ADR 0008: Store public-demo songs in each visitor's browser

- **Status:** Accepted
- **Date:** 2026-09-16
- **Deciders:** Product owner and development team
- **Related plans:** [Plan 0009](../plans/0009-static-browser-demo.md)
- **Supersedes:** [ADR 0005](0005-development-midi-storage.md)
- **Superseded by:** None

## Context

The simulator is now intended to be a publicly shareable interface demo hosted
away from the development server. Its Vite-only filesystem API prevents a static
deployment and would expose one unauthenticated, mutually deletable song library
if published unchanged. The demo does not need accounts or collaboration.

## Decision drivers

- Publish from GitHub without operating a server or database.
- Keep each visitor's imported files private to that browser.
- Preserve imports across reloads and browser sessions.
- Keep storage out of the portable C++ core and avoid constraining ESP32 storage.
- Retain an always-available, non-deletable built-in demonstration song.

## Considered options

### Option: Public server filesystem

This is closest to the development adapter, but it creates shared unauthenticated
state, needs persistent hosting, and lets visitors delete one another's files.

### Option: Hosted database or object storage

This supports shared content but introduces accounts, authorization, retention,
cost, and service choices that the interface demo does not require.

### Option: Browser-local IndexedDB

This supports binary files and persistent per-origin data without a server. Its
contents are specific to a browser profile and can be removed when site data is
cleared.

## Decision

The public browser simulator stores imported MIDI metadata and raw bytes in
IndexedDB. The built-in MIDI is bundled with the application rather than stored
in the database. The browser adapter continues to pass selected raw bytes to the
portable WebAssembly importer; it does not interpret MIDI.

The development HTTP/filesystem adapter is removed. This choice applies only to
the browser simulator and does not select an ESP32 storage representation.

## Consequences

### Positive

- The complete demo can run on static hosting.
- Imported files are not uploaded to the project team or exposed to other visitors.
- No application server, credentials, database, or storage bill is required.
- The existing platform-adapter boundary remains intact.

### Negative

- Imports do not follow a visitor across browsers or devices.
- Clearing site data deletes imported songs.
- Developers can no longer inspect another visitor's failed MIDI file on disk.

### Follow-up

- Choose ESP32 persistence separately when board and filesystem requirements are confirmed.
- Make a new product and security decision before introducing shared browser storage.
