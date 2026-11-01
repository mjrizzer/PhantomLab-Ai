# PhantomLab

**A living laboratory for software products.**

An original, local-first engineering instrument for reproducible browser investigations. An editorial React interface surrounds a Python worker, SQLite evidence store, Playwright tools, and sequential Ollama agents. No paid API, account, cloud database, or runtime CDN is required.

This repository is a **working checkpoint centered on the Double Checkout Paradox**, not a finished general-purpose autonomous QA platform. See [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) for verified results and remaining scope.

## The first experiment

Atelier Commerce is a real fictional shop included in the backend. Release A handles checkout safely. Release B introduces four reproducible defects. The laboratory opens isolated Chromium sessions, exercises both versions, checks the browser **and SQLite order records**, saves screenshots and Playwright traces, and produces a release report.

Five reviewed scenarios are available:

| Scenario | Deterministic condition |
| --- | --- |
| Ordinary checkout | One submission produces one $48 order |
| Rapid checkout | Two immediate clicks must produce exactly one order |
| Discount | STUDIO10 must reduce 4800 cents to 4320 cents |
| Keyboard | Tab after the discount input must focus Apply code |
| Slow network | A successful delayed request must not announce a premature timeout |

The evaluation manifest is [demo/defects.json](demo/defects.json). It is never sent to the model. The operator uses reviewed test implementations; the AI chooses hypotheses and scenarios rather than generating executable code.

## Install on Windows 11

Install these prerequisites once while online:

1. **Node.js 24 LTS**, including npm, from [nodejs.org](https://nodejs.org/).
2. **Python 3.14**, including the Python launcher, from [python.org](https://www.python.org/downloads/). This checkpoint was tested with Python 3.14 wheels on Windows.
3. **Git** from [git-scm.com](https://git-scm.com/downloads/win).
4. Optional **Ollama for Windows** from [ollama.com](https://ollama.com/download/windows). Start Ollama, then download the model:

```powershell
ollama pull qwen3.5:4b
ollama list
```

Clone and install in PowerShell:

```powershell
git clone https://github.com/mjrizzer/PhantomLab-Ai.git
cd PhantomLab-Ai
powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1
.\scripts\start.ps1
```

The installer creates `.venv`, installs pinned Python/npm dependencies, copies distributable fonts and license notices, downloads Playwright Chromium, and builds the PWA. It does not download model weights into this repository.

Open **http://127.0.0.1:8765**. Keep the backend terminal running for queued experiments, even if the browser tab closes. Use one backend process; do not enable multiple Uvicorn workers.

If PowerShell blocks a project script, invoke it using `powershell -ExecutionPolicy Bypass -File .\scripts\start.ps1`; this applies only to that invocation.

## Run the demonstration

1. Open **Product Registry** from the masthead Index. Open baseline A and candidate B to explore the shop.
2. Choose **Begin a New Experiment**. Start in **Deterministic / manual** mode to verify the complete five-scenario workflow without AI.
3. Enter the **Experiment Studio**. The center shows actual captured browser images, explicitly labeled as captures. The left records plan and tool activity; the right shows assertions and database observations.
4. Open **Evidence Room** for stable evidence IDs, before/after screenshots, reproduction instructions, console/network records, and trace ZIPs.
5. Open **Compare** and select **Rapid checkout**. Baseline should have one database order and candidate two.
6. Read the **Findings Journal**; export PDF/JSON or print the typography-preserving browser report.
7. With Ollama available, repeat in **Local AI** mode. Six roles share `qwen3.5:4b`, sequentially. The model can narrow the reviewed scenario set; ordinary and rapid checkout remain mandatory for the signature experiment.

To replay, begin a fresh investigation from the Studio. Fresh contexts avoid reusing prior order state. To inspect captured actions without executing them, download a trace and run:

```powershell
.\.venv\Scripts\python.exe -m playwright show-trace C:\path\to\A-rapid_checkout.zip
```

Trace viewing uses Playwright’s local viewer. No trace upload service is required.

## Offline operation

Use the production build, not the Vite development server, to test PWA behavior. Visit localhost once while the backend is available, wait for the service worker to activate, and reload. Chromium may offer **Install PhantomLab** from its address bar/menu.

| Condition | Available behavior |
| --- | --- |
| Internet disconnected; backend + Ollama running | Local browser experiments, local inference, comparisons, reports, evidence |
| Backend stopped | Cached app shell, last 20 experiment records, product metadata, notes and plan drafts |
| Ollama stopped or model missing | Reviewed deterministic tools; AI state clearly unavailable |

Fonts, JS, CSS, icon, manifest and HTML are precached. IndexedDB stores bounded metadata, drafts and a safe note-edit queue. Screenshot/trace binaries stay on local backend disk and are **not** automatically cached by the PWA. A backend outage therefore preserves report text and evidence references, but does not promise offline binary viewing.

The Python worker continues while the browser tab is closed. A service worker cannot run Python, Playwright, or Ollama. Queued jobs survive process restart. Interrupted jobs preserve their completed evidence and require explicit fresh replay, rather than repeating potentially completed checkout actions.

See [docs/OFFLINE_TESTING.md](docs/OFFLINE_TESTING.md) for separate internet-disconnection and backend-outage procedures and the exact limits of automated verification.

## Development and checks

```powershell
# Backend terminal
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8765

# Optional frontend development terminal
npm run dev

# Complete check sequence
.\scripts\check.ps1

# Individual checks
npm run lint
npm test
npm run build
.\.venv\Scripts\python.exe -m pytest -q
npm run e2e

# Capture real UI screenshots; backend must already be running
.\.venv\Scripts\python.exe scripts\inspect_ui.py
```

Pytest runs a temporary SQLite database and an isolated local server on port 8877. It executes the actual Chromium scenarios, checks files and database evidence, stops the backend to verify the cached PWA, reconnects safe note synchronization, and verifies restart recovery. The frontend Playwright suite uses a separate server on port 8890. Ollama is deliberately unavailable in automated CI; actual local AI verification is recorded separately.

Node dependencies are locked by `package-lock.json`; Python packages by `requirements.lock.txt`. Update deliberately and rerun browser/offline checks. Development-tool audit advisories are documented in the status file; the last production dependency audit found none.

## Machine learning, without invented certainty

`backend/ml.py` includes:

- A Random Forest classifier using **pre-outcome** features and a release-family grouped holdout. Training rejects fewer than 40 rows/eight independent families or a one-class split. Metrics include precision, recall, F1 and balanced accuracy.
- Isolation Forest anomaly detection after 20 prior executions. An anomaly is not automatically a defect; repeated demo histories do not establish production validity.
- An interpretable priority score based on journey criticality, observed failure ratio, and an untested bonus.

The release screen currently uses **deterministic fallback**: a verified candidate assertion failure with a passing baseline produces a hold verdict. It does not show a made-up probability, confidence, or accuracy. A trained production estimate still requires validated independent histories and a complete feature provenance path.

Generate and evaluate illustrative data locally:

```powershell
.\.venv\Scripts\python.exe -m scripts.synthetic_data
.\.venv\Scripts\python.exe -m scripts.train data/synthetic-history.csv --synthetic
```

Synthetic models are saved separately and never activated as production risk models. For a real dataset, use `python -m scripts.train history.csv`. Required columns and leakage boundaries are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Configuration and data

`.env.example` documents environment variables. Export them in the terminal before launching; `.env` is an example template, not automatically loaded.

```powershell
$env:OLLAMA_MODEL = 'qwen3.5:4b'
$env:OLLAMA_URL = 'http://127.0.0.1:11434'
$env:PHANTOM_DATA = 'C:\Users\YOUR_NAME\phantomlab-data'
```

Leave `PHANTOM_PORT=8765` unless using a custom development setup. The PowerShell start script binds port 8765. Data defaults to ignored `data/`: SQLite/WAL, artifacts, generated PDF font files and model files. Do not commit databases, sessions, traces, screenshots, model weights, personal information or virtual environments. To back up a database, stop the backend first, then copy the entire data directory.

Font assets in `public/fonts/` are intentional distributable application resources. Their SIL OFL notices are preserved in `licenses/fonts/`. The application code is MIT-licensed. Optional Supabase/Firebase team sync is not required or implemented in this checkpoint.

## Scope and safety

Only the controlled Atelier fixture is executable. Product registration accepts localhost metadata; it does not grant arbitrary browser-tool execution. External domains, arbitrary shell tools, website-supplied code, real credentials and real payments are not supported.

See [docs/SECURITY.md](docs/SECURITY.md) for local trust boundaries. Do not expose the unauthenticated loopback backend to a network, tunnel it publicly, or run the injected demo defects against real users.

Implementation references: [Playwright tracing](https://playwright.dev/python/docs/api/class-tracing), [local trace viewer](https://playwright.dev/python/docs/trace-viewer), [Ollama structured outputs](https://ollama.com/blog/structured-outputs).
