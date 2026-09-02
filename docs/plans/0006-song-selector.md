# Plan 0006: Persistent song selector

- **Status:** Completed
- **Owner:** Development team
- **Created:** 2026-09-02
- **Updated:** 2026-09-02
- **Related requirements:** [Song library and selection](../product/requirements.md#80-song-library-and-selection)
- **Related ADRs:** [ADR 0006](../adrs/0006-platform-song-library-adapter.md)

## Outcome

Importing adds a MIDI file to persistent development storage. A separate song
selector displays all stored files and lets a user play or delete each one.

## Scope

### Included

- Persistent original filename and import metadata
- List and delete storage operations
- Two-step import then selection workflow
- Play and confirmed Delete actions
- Empty, progress, success, compatibility-error, and deletion-error states
- Case-insensitive `.mid` and `.midi` extension enforcement
- Product, architecture, contributor, and user documentation

### Excluded

- ESP32 filesystem implementation
- Production authentication, quotas, and provisioning
- Format-1 or multi-track conversion support
- Converted-song caching and compatibility status in catalog metadata
- Rename, sorting controls, and bulk operations

## Constraints and assumptions

- A valid MIDI header is still required in addition to an accepted extension.
- Stored MIDI that the current converter cannot play remains listed.
- Play means load, convert, and immediately start the chosen song.
- Delete is permanent and requires browser confirmation.

## Approach

Extend the Vite adapter with per-file JSON metadata, catalog listing, and bounded
identifier-based deletion. Change browser import to storage-only. Render the
catalog from the server and invoke the existing WASM import only from Play.

## Work breakdown

1. Record the confirmed workflow and platform boundary.
2. Extend persistent storage metadata and API operations.
3. Add import and selector interactions.
4. Cover persistence, listing, playback loading, extension rejection, and deletion.
5. Run live and automated verification, update documentation, and close the plan.

## Verification

- Server tests cover create, list, retrieve, delete, invalid extension, and invalid header.
- A stored pre-catalog MIDI remains visible through fallback metadata.
- Browser type checks and production static build pass.
- Native and WASM playback regression tests pass.
- Live simulator shows stored songs across reload and removes a confirmed deletion.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Accidental deletion | Require an explicit confirmation prompt. |
| Original filename used as a path | Keep server-generated IDs as storage paths. |
| Unsupported MIDI disappears | Separate storage import from conversion on Play. |
| Browser design constrains ESP32 | Keep catalog API and metadata platform-owned. |

## Open questions

- Final controller capacity and converted-song format remain pending hardware details.

## Outcome record

- **Result:** Completed
- **Completed:** 2026-09-02
- **What changed:** Added persistent catalog metadata, list and delete API
  operations, a two-step import/selection UI, Play and confirmed Delete actions,
  responsive selector styling, and explicit extension rejection coverage.
- **Verification performed:** `npm test`, `npm run build`,
  `./scripts/check-env`, and `git diff --check` passed. Live Vite checks created
  and listed a `.midi` file with its original name, deleted it with HTTP 204,
  confirmed both data and metadata were gone, and confirmed the selector markup
  is served. The pre-catalog user upload remains listed through fallback metadata.
- **Follow-up work:** Replace the current fallback filename by reimporting that
  original test file if desired. Device storage and format-1 selection remain
  separate future slices.
