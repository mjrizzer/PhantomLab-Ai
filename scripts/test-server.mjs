import { spawn } from "node:child_process";
const python =
  process.platform === "win32"
    ? ".venv/Scripts/python.exe"
    : ".venv/bin/python";
const child = spawn(
  python,
  [
    "-m",
    "uvicorn",
    "backend.main:app",
    "--host",
    "127.0.0.1",
    "--port",
    "8890",
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      PHANTOM_PORT: "8890",
      PHANTOM_DATA: "data/e2e",
      OLLAMA_URL: "http://127.0.0.1:1",
    },
  },
);
for (const event of ["SIGINT", "SIGTERM"])
  process.on(event, () => child.kill());
child.on("exit", (code) => process.exit(code || 0));
