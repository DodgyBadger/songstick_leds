# Agent guidance

## Scope

Songstick is an ESP32-controlled LED learning aid for a three-string,
diatonically tuned instrument. LEDs indicate which string and fret to play.
A browser simulator is planned so behavior can be reviewed without hardware.

The product requirements are intentionally incomplete. Do not invent musical,
interaction, hardware, file-format, or visual-design requirements. Ask for or
record decisions before making them structural.

## Working rules

- Run `./scripts/bootstrap` before using project tooling.
- Manage Python and `.venv` with `uv`; keep JavaScript dependencies in `node_modules`.
- Pin direct development dependencies and commit their lockfiles.
- Keep hardware-independent behavior separate from ESP32 and browser adapters.
- Do not add a framework, dependency, service, or deployment configuration until
  the current task requires it.
- Preserve unrelated work. Run relevant checks before reporting completion.
- Keep `README.md` and the applicable agent documentation current.

## Progressive documentation

Read only the documents relevant to the task:

- Environment or tooling: `docs/agents/environment.md`
- Browser simulator: `docs/agents/web.md`
- ESP32 firmware or LEDs: `docs/agents/firmware.md`
- Product assumptions and open decisions: `docs/agents/product.md`
- Implementation planning or architecture decisions: `docs/agents/planning.md`
