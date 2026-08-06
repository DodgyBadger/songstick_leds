# Development environment

## Supported baseline

- Linux or a Linux development container
- Python 3.11.x
- Node.js 22.x and npm
- uv 0.12.x
- Bash

`.python-version` and `.nvmrc` advertise the expected runtime families to common
version managers. `./scripts/bootstrap` validates Node, then `uv` selects Python,
creates `.venv`, and installs the exact dependencies recorded in `uv.lock`.

JavaScript packages must be installed locally. Once a web `package.json` exists,
commit `package-lock.json`; bootstrap will then use `npm ci`.

## Commands

```bash
./scripts/bootstrap
./scripts/check-env
uv run pio --version
```

Use `uv add --dev` and commit both `pyproject.toml` and `uv.lock` when changing
Python tools. Do not use `pip`, global `platformio`, or global npm package
installs for project tools.
Do not commit `.venv`, `node_modules`, build output, secrets, or local `.env`
files.

## Container and networking

Development runs inside a Docker coding container. Public TLS and reverse proxy
configuration belong to Caddy on the real host, not in this repository unless a
later task explicitly adds an example. Web development servers must bind to
`0.0.0.0`, use an explicitly selected non-standard port, and fail rather than
silently moving to another port.
