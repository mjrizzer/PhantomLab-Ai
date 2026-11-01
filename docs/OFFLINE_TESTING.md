# Offline verification

Do not confuse a stopped backend with a disconnected internet connection.

## Automated isolation and real backend outage

After `npm run build`, run:

```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_z_offline.py -q
```

The test runs a local backend with a temporary SQLite store. A Chromium route policy rejects every non-loopback destination while allowing localhost. It confirms a public fetch fails while a local request succeeds, activates the actual production service worker, then **terminates the owned backend process**. The cached PWA must reload, show archive mode, render a saved report, and persist a note. A restarted backend must synchronize the note exactly once, preserve an interrupted job, and execute a previously queued job while the browser is closed.

The browser route policy is an application-level internet isolation test. It is not a claim that the Windows network adapter was disconnected or that Ollama’s OS process was firewalled. The actual adapter-disconnection procedure below remains a separate manual quality gate.

## Physical internet-disconnection acceptance test

1. Install dependencies, Chromium and `qwen3.5:4b` while online.
2. Start Ollama and `scripts/start.ps1`. Open `http://127.0.0.1:8765` and run one experiment. Wait for the service worker to activate; reload.
3. Disconnect Wi-Fi/Ethernet using Windows Quick Settings. Keep the local processes running.
4. Verify a public website cannot load. Verify `http://127.0.0.1:8765/api/health` still reports the backend and model available.
5. Run a fresh local AI investigation and a deterministic five-scenario investigation. Confirm real artifacts and reports are created without internet.
6. Reconnect the network. Record experiment IDs, browser/OS versions and outcomes in `IMPLEMENTATION_STATUS.md`.

This procedure should be run locally by an engineer who can restore connectivity. It was not silently performed on the user’s network adapter during development.

## Backend disconnected acceptance test

1. With the network available, load a report and wait for its metadata to cache.
2. Stop only the backend terminal using Ctrl+C. Leave the browser and internet running.
3. Reload the installed PWA. Confirm archive mode, saved report text and draft editing remain usable.
4. Trace downloads, screenshot binaries, new browser tests and AI execution must be unavailable. Missing binary images must not be fabricated.
5. Save a note. Restart the backend. Confirm the pending metadata count decreases and the note appears once.
6. Make competing edits from two browser profiles. Confirm the losing revision is retained for conflict review and does not overwrite the server silently.

## Ollama unavailable acceptance test

Stop Ollama or select an uninstalled model through the startup environment. Confirm AI mode is unavailable while deterministic tests work. CI uses an unreachable local Ollama endpoint to cover this distinction. No external model fallback is configured.
