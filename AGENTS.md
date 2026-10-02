# Exact2 game

This repository consumes Exact2 as an external game. Before changing it, read
the Exact2 checkout's `AGENTS.md`, `rules/RULES.md`, `rules/DEFERRED.md`, and
`game/README.md` at the version being used.

- Contract owns layout, accessibility, HUD, and controls.
- Rust under `logic/` owns deterministic gameplay and saved state.
- Use only world time and world randomness inside simulation ticks.
- Put authored images and WAV/Ogg sounds in `art/`; `assets/` is generated.
- Run `bun "$EXACT2/game/app/shells.mjs" . --test` and compile
  `app.contract` before landing a change.
- Do not commit `.shells/`, `target/`, `assets/`, or `.baked-assets.json`.
