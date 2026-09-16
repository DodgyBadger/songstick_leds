# Plan 0009: Publish a static browser demo

- **Status:** Completed
- **Owner:** Development team
- **Created:** 2026-09-16
- **Updated:** 2026-09-16
- **Related requirements:** [PRD sections 2, 5, 7.2, and 8.0](../product/requirements.md)
- **Related ADRs:** [ADR 0008](../adrs/0008-browser-local-demo-storage.md)

## Outcome

The simulator can be published to GitHub Pages and used without an application
server. Each visitor can import, revisit, play, and delete MIDI files stored only
in that browser, while the built-in demonstration song is always available.

## Scope

### Included

- IndexedDB-backed browser song-library adapter
- Bundled built-in demonstration MIDI
- Removal of the Vite development storage endpoint
- GitHub Actions build and GitHub Pages deployment
- Documentation and automated coverage for the static deployment boundary

### Excluded

- Shared song libraries, accounts, authentication, or cloud storage
- A production ESP32 storage design
- UI or musical-behavior changes
- Custom-domain configuration

## Constraints and assumptions

- The hosted site is an interface demo for team review, not a shared content service.
- Imported MIDI remains private to the browser profile and device that imported it.
- Clearing site data removes imported songs; the built-in song remains available.
- The portable C++ core continues to own MIDI interpretation and playback behavior.

## Approach

Replace the HTTP client with a browser platform adapter backed by IndexedDB.
Keep metadata and raw MIDI bytes together in one object store, and serve the
built-in song directly from a bundled TypeScript asset. Configure Vite's base
path at build time and publish `dist/` from an Emscripten build container through
GitHub Actions.

## Work breakdown

1. Record the browser-local persistence decision and supersede development disk storage.
2. Implement and test the static browser song-library adapter.
3. Remove the Vite storage middleware and update browser integration.
4. Add and validate the GitHub Pages build workflow.
5. Update contributor and product documentation and close this plan.

## Verification

- `npm test`
- `npm run build`
- `./scripts/check-env`
- `git diff --check`
- Inspect the production bundle for root-relative application API requests.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Browser storage is unavailable or denied | Surface adapter failures in the existing status areas while retaining the bundled song path. |
| A project-site path breaks generated assets | Supply the repository path through Vite's build-time `base` setting. |
| Visitors mistake local songs for shared uploads | Document that imports stay in the current browser. |
| Build environment drifts from the supported compiler | Build Pages inside the pinned Emscripten 6.0.6 image and use Node 22. |

## Open questions

- None for the static interface demo. Shared storage would require a separate product decision.

## Outcome record

- **Result:** Completed
- **Completed:** 2026-09-16
- **What changed:** Replaced the Vite HTTP/filesystem adapter with tested
  IndexedDB persistence, bundled the built-in MIDI in the static application,
  added a repository-path-aware GitHub Pages workflow, and documented the
  browser-local privacy and lifecycle boundary.
- **Verification performed:** `npm test`, `VITE_BASE_PATH=/songstick_leds/ npm
  run build`, `./scripts/check-env`, `git diff --check`, and `npm audit
  --include=dev` passed. A local production-preview smoke test returned HTTP 200
  for the project-path HTML, JavaScript, and WebAssembly assets, and the bundle
  contains no application API requests.
- **Follow-up work:** Enable GitHub Actions as the repository's Pages source if
  it is not already enabled, then publish these changes.
