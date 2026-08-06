# Songstick LEDs

Control software and a planned browser simulator for an ESP32-powered,
LED-guided three-string song stick.

Product development has not started yet. This repository currently establishes
only the reproducible development-tool baseline.

## Bootstrap

Prerequisites are uv 0.12.x, Node.js 22, npm, and Bash. `uv` will obtain or select
Python 3.11. If you use `nvm`, run `nvm use` after cloning.

```bash
./scripts/bootstrap
./scripts/check-env
```

The bootstrap is safe to run again. It runs `uv sync --locked` to reproduce the
repository-local Python environment and PlatformIO CLI. It will use `npm ci`
once a JavaScript lockfile is introduced. Run tools such as PlatformIO with
`uv run pio`.

See [AGENTS.md](AGENTS.md) for coding-agent guidance and
[docs/agents/environment.md](docs/agents/environment.md) for environment details.
Project documentation is indexed in [docs/README.md](docs/README.md).
