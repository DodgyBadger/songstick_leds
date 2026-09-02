# Development environment

## Supported baseline

- Linux or a Linux development container
- Python 3.11.x
- Node.js 22.x and npm
- uv 0.12.x
- CMake, Ninja, and a C++17 compiler
- Emscripten SDK 6.0.6
- Bash

`.python-version` and `.nvmrc` advertise the expected runtime families to common
version managers. `./scripts/bootstrap` validates Node, then `uv` selects Python,
creates `.venv`, and installs the exact dependencies recorded in `uv.lock`.

JavaScript packages must be installed locally. Commit `package-lock.json`;
bootstrap uses `npm ci --include=dev` so the environment remains complete even
when the host sets `NODE_ENV=production`.

## Commands

```bash
./scripts/bootstrap
./scripts/check-env
uv run pio --version
./scripts/test-native
./scripts/test-wasm
```

Use `uv add --dev` and commit both `pyproject.toml` and `uv.lock` when changing
Python tools. Do not use `pip`, global `platformio`, or global npm package
installs for project tools.
Do not commit `.venv`, `node_modules`, build output, secrets, or local `.env`
files.

MIDI files selected in the development simulator are stored beneath
`var/midi-uploads/`. The entire `var/` runtime directory is ignored by Git. It is
safe to inspect these files when diagnosing imports; do not depend on them as
committed fixtures or production storage.

## Container and networking

Development runs inside a Docker coding container. Public TLS and reverse proxy
configuration belong to Caddy on the real host, not in this repository unless a
later task explicitly adds an example. Web development servers must bind to
`0.0.0.0`, use an explicitly selected non-standard port, and fail rather than
silently moving to another port.

Native and WebAssembly compilers are provided by the container image, not
downloaded by repository bootstrap. `emcc` and `emcmake` must resolve without
sourcing a host-specific environment file.
