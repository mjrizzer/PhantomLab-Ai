# PhantomLab implementation status

This is a functional local checkpoint, not a claim that all twenty project quality gates are complete. Source is prepared for the requested `mjrizzer/PhantomLab-Ai` GitHub repository. Runtime artifacts remain local and are excluded from Git.

## Verified so far — Windows 11, 2026-11-01

- Node 24.20.0, Python 3.14, local Chromium, SQLite, and installed `qwen3.5:4b` detected.
- Production build succeeded; self-hosted Playfair Display, Libre Baskerville, and Instrument Serif render in Chromium.
- First real deterministic signature experiment completed ten browser executions.
- Release A: all five assertions passed. Release B: normal checkout passed; all four injected regressions detected.
- Duplicate checkout: baseline one database order; candidate two. Screenshots, trace ZIPs, JSON observations, and order IDs saved under ignored `data/`.
- Expanded Pytest run: 11 passed. Includes real browsers and database verification, baseline API concurrency, artifact validation, PDF/JSON with all three embedded fonts, idempotency, origin restrictions, cancellation, model evaluation safeguards, real backend outage and restart recovery.
- React Testing Library / Vitest: 2 passed.
- Frontend Playwright: 1 passed, covering the ten rooms, actual font loading, AI-unavailable state, persona goal propagation, Escape dismissal and mobile layout.
- ESLint: passed after explicit project-file scope.
- All ten rooms checked in a real browser: zero page errors. Mobile 390px: no horizontal overflow.
- Production npm audit: zero vulnerabilities. Development-only audit currently has 19 advisories (17 moderate, 2 low); critical advisories were removed by updating Vitest. Do not use `npm audit fix --force` without compatibility review.
- Actual Ollama verification: `EXP-8b924a99-71c`, all six roles produced validated local model outputs. AI selected ordinary and rapid checkout, ran four browser executions, and identified the verified duplicate-order regression. `python -m scripts.verify_ai --experiment EXP-8b924a99-71c` passed against retained local evidence.
- Actual deterministic signature: `EXP-b8ff063d-e0d`, ten executions, all four injected regressions found. These IDs identify local ignored artifacts, not files bundled in Git.
- Synthetic Random Forest evaluation ran on 160 clearly labeled generated rows / 20 independent synthetic families, with five families held out. Precision 0.8333, recall 0.7407, F1 0.7843, balanced accuracy 0.7165. These are illustrative synthetic metrics, not real-world predictive accuracy. No synthetic model is activated as a production risk estimate.
- Backend outage test actually terminates FastAPI: cached journal remains readable, a note queues and synchronizes once after restart, untouched queued work executes with the tab closed, and interrupted jobs retain evidence without blind resubmission.

## Implemented

- Original editorial interface, responsive masthead/index, theme variables and all three bundled OFL fonts.
- Functional Atelier Commerce releases A/B, session cart, quantity updates, search, discounts, checkout, history, fake guest data only.
- FastAPI, SQLAlchemy SQLite/WAL store, numbered SQL migrations, durable single-worker queue, cancellation and bounded runs.
- Restart: queued jobs remain queued; interrupted jobs retain evidence and require explicit fresh replay.
- Isolated Playwright contexts, controlled localhost routes, screenshots, trace downloads and local trace-viewer instructions.
- Evidence Room, recorded browser stage/timeline, real release comparisons and pixel-difference blend.
- Six sequential agent roles using one Ollama model, Pydantic schemas, named scenario tools, timeouts, safe inference retry and explicit degraded states.
- Random Forest training with release-family holdout, Isolation Forest with minimum history, interpretable ranking, deterministic verdict fallback.
- PWA asset precache, IndexedDB summaries/drafts, safe note synchronization with idempotency and revision conflicts.
- PDF (with embedded local fonts) and JSON reports, registered/observed dependency graph, service diagnostics.
- Windows scripts, automated checks, CI and font license notices.

## Validation notes

- Initial AI calls exhausted the structured-output path with thinking enabled; those runs accurately recorded degraded/unavailable states. Explicit `think: false` fixed the local schema path, and the complete six-role run passed.
- Browser monitoring uses before/after captures plus actual event history. No browser activity or screenshot is fabricated.
- Frontend source was formatted, type checked, linted, built and exercised in Chromium. The Windows `scripts/check.ps1` is the reproducible final check entry point.
- Final `scripts/check.ps1` completed successfully: lint, 2 component tests, type checking/production build, 11 Python tests (60.64 seconds), and 1 frontend browser test. It uses a fresh project-local test directory to avoid Windows temp-folder ownership conflicts between execution accounts.

## Known limits / next tasks

- Generic product registration currently stores metadata. Only the reviewed Atelier Commerce fixture has executable tools. External targets are intentionally disabled; no external approval workflow is implemented.
- Browser stage uses captured images, not live video. Replay means rerunning an experiment or opening a captured Playwright trace locally.
- A real production risk probability is unavailable without independent historical releases and validated pre-release features. Synthetic evaluation is illustrative only.
- No machine-wide network adapter disconnect has been performed. Browser non-loopback isolation is a separate automated test; it must not be described as a physical internet-disconnection test.
- Queued jobs survive restarts; interrupted browser actions are never blindly repeated. Artifacts are retained, without automatic disk cleanup yet.
- Persona constraints use bounded reviewed tools. Arbitrary generated browser code is not supported.
- Product screenshots live in experiment evidence; generic screenshot uploads and custom release-tool authoring remain future work.
- No Supabase/Firebase dependency: optional team synchronization is future work, preserving the offline SQLite source of truth.

## Quality-gate audit

| Gate | Status and evidence |
| --- | --- |
| 1. Windows launch | Verified locally with Node 24 / Python 3.14 / Chromium |
| 2. Exact fonts | Browser FontFaceSet checks passed; PDFs embed all three |
| 3. No runtime CDN | Bundled JS/CSS/fonts; controlled loopback services |
| 4. Editorial design | Real desktop/mobile captures under ignored `data/ui-checks/`; generate with `scripts/inspect_ui.py` |
| 5. Local demo product | Functional A/B fixture and tested cart/order APIs |
| 6–8. Real browsers, artifacts, regression | Ten deterministic runs; actual PNG/ZIP/database evidence verified |
| 9. Release comparison | Stored A/B results, synchronized scenario and pixel blend |
| 10. Real local AI | Six actual Ollama role outputs verified |
| 11. Deterministic assertions | Reviewed Python/browser tools and SQLite evidence |
| 12. Honest ML | Real training/evaluation and anomaly pipeline; release verdict explicitly uses fallback |
| 13. Internet-free archive | Assets local; non-loopback browser isolation tested |
| 14. Local testing/AI with physical internet disabled | **Still requires manual adapter-disconnection acceptance test** |
| 15. Backend unavailable | Actual process shutdown/PWA reload verified |
| 16. Queue recovery | Persisted queued job runs after restart; interrupted job is retained safely |
| 17. Evidence-based reports | JSON matches stored results; PDF structure/fonts verified |
| 18. Navigation/metrics | Ten rooms exercised; missing data and unavailable services labeled |
| 19. Automated workflows | 11 Pytest + 2 component + 1 frontend browser tests; lint/type/build checks |
| 20. Open-source readiness | Source, licenses, docs, lockfiles, CI, Windows scripts included; generic tools and development-only advisories remain explicit limitations |
