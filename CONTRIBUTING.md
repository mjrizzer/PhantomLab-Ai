# Contributing

Start with the Windows setup and check sequence in the README. Keep each change reproducible on the local fixture, without cloud credentials.

- Preserve the separation between model hypotheses, deterministic assertions and statistical warnings.
- Add new browser capabilities as reviewed named tools. Never execute model-generated code or webpage instructions.
- Every new executable target needs a threat model, origin boundary and explicit authorization policy. Registration alone must not grant execution.
- Keep inference sequential by default and resource use bounded for 16 GB RAM / 6 GB VRAM machines.
- Treat offline app navigation, local-service availability and public internet connectivity as separate concerns.
- Use independent release families for ML evaluation; do not train on the outcome being predicted. Mark synthetic data at generation, evaluation and presentation.
- Preserve font licenses, offline font delivery, reduced-motion support and accessible focus states.
- Add numbered SQL migrations for schema changes. Keep runtime databases and binary experiment artifacts out of Git.
- Record the actual checks and remaining limits in `IMPLEMENTATION_STATUS.md`. Do not claim physical network disconnection from browser request interception.

Run `scripts/check.ps1` before opening a pull request. Use `npx prettier --write src` to format frontend source. UI screenshots can be generated using `scripts/inspect_ui.py`; review generated captures locally rather than committing test sessions and traces.
