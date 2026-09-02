# ADR 0005: Keep development MIDI storage outside the portable core

- **Status:** Accepted
- **Date:** 2026-09-02
- **Deciders:** Development team
- **Related plans:** [Plan 0005](../plans/0005-disk-backed-midi-upload.md)
- **Supersedes:** None
- **Superseded by:** None

## Context

Browser-selected files were previously passed directly to WebAssembly. This made
imports private to the browser session and prevented developers from inspecting
files that failed conversion. The shared simulator needs development-time disk
storage, but filesystem and HTTP behavior must not enter the portable playback
core or imply an ESP32 storage design.

## Decision drivers

- Make uploaded test files inspectable in the development workspace.
- Exercise loading the exact bytes that were persisted.
- Preserve the portable C++ core and static production build.
- Avoid introducing a web framework or separate service for this small need.
- Constrain writes made through the publicly proxied development server.

## Considered options

### Option: Browser-only storage

IndexedDB would persist files across browser sessions, but developers and agents
inside the container could not inspect them.

### Option: Separate application server

A dedicated server would support a future song library, but adds deployment and
dependency complexity before those requirements exist.

### Option: Vite development-server adapter

A small same-origin endpoint can persist and retrieve MIDI bytes using Node's
standard library while keeping the feature explicitly development-only.

## Decision

Add a Vite development and preview server plugin with a narrow same-origin API.
It accepts only `.mid` or `.midi` filenames, requires an `MThd` header, limits
files to 1 MiB, generates opaque server-side identifiers, and writes beneath
ignored `var/midi-uploads/`. After saving, the browser retrieves the file by its
identifier and passes those returned bytes to the existing WASM importer.

This is a development observability adapter, not the device song-storage model.
The production build remains static and receives no storage endpoint.

## Consequences

### Positive

- Failed imports remain available for direct inspection.
- The importer operates on the persisted copy rather than browser-only bytes.
- No new runtime framework or service is required.

### Negative

- Uploads have no retention or deletion policy and must be managed locally.
- `vite preview` can provide the endpoint, but a standalone static host cannot.
- Anyone with access to the shared development site can consume local disk up to
  the per-file limit.

### Follow-up

- Define authentication, quotas, retention, and a song-library model before
  treating storage as a production capability.
- Choose an ESP32 storage adapter separately when device requirements are known.
