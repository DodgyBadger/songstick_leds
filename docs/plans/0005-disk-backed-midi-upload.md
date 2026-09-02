# Plan 0005: Disk-backed development MIDI upload

- **Status:** Completed
- **Owner:** Development team
- **Created:** 2026-09-02
- **Updated:** 2026-09-02
- **Related requirements:** Development debugging request
- **Related ADRs:** [ADR 0005](../adrs/0005-development-midi-storage.md)

## Outcome

Selecting a MIDI file in the shared development simulator saves it inside the
workspace, reloads the saved bytes, and then imports them through WASM. A failed
file remains available for developer inspection.

## Scope

### Included

- Same-origin development API to save and retrieve MIDI files
- Ignored runtime storage under `var/midi-uploads/`
- Filename, signature, path, method, and 1 MiB size constraints
- Browser save-then-load flow and clear progress/error messages
- Automated server adapter coverage and documentation

### Excluded

- Production hosting or authentication
- Upload listing, deletion, retention, and song-library management
- ESP32 persistence
- Changes to MIDI conversion rules

## Constraints and assumptions

- Caddy continues to forward the stable hostname to Vite port 43173.
- This endpoint is available only when using the Vite development or preview server.
- The development site is shared with trusted project collaborators.

## Approach

Install a small Vite middleware backed by Node filesystem primitives. POST raw
MIDI bytes and a separately encoded filename, return an opaque identifier, then
GET that identifier and import the response bytes. The portable core remains
unaware of HTTP and disk storage.

## Work breakdown

1. Record the development-only storage boundary.
2. Implement constrained disk persistence and retrieval middleware.
3. Change the browser path to save, reload, and import.
4. Add automated and live-server checks.
5. Update contributor documentation and close the plan.

## Verification

- Upload test proves the saved file matches both posted and retrieved bytes.
- Invalid content and unsafe requests are rejected.
- Existing native, WASM, browser, build, and environment checks remain green.
- A live Vite request creates a file under the ignored runtime directory and
  retrieves identical bytes.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Arbitrary filesystem writes | Generate identifiers and never use client paths. |
| Unbounded disk writes | Enforce 1 MiB per file; defer broader quotas to production design. |
| Accidental production dependency | Document and implement the API as a Vite-only adapter. |
| Persisted sensitive files | Accept MIDI extensions/signatures only and document local retention. |

## Open questions

- Retention and deletion behavior belongs to a future song-library requirement.

## Outcome record

- **Result:** Completed
- **Completed:** 2026-09-02
- **What changed:** Added a constrained Vite storage adapter, a typed browser
  client, save-then-load import behavior, visible saved identifiers, ignored
  runtime storage, and automated middleware coverage.
- **Verification performed:** `npm test`, `npm run build`,
  `./scripts/check-env`, and `git diff --check` passed. A live request through
  the configured host header returned HTTP 201, created a file beneath
  `var/midi-uploads/`, and the endpoint and disk copy had identical SHA-256
  hashes.
- **Follow-up work:** Define lifecycle, authentication, quotas, and production
  storage only as part of a future song-library requirement.
