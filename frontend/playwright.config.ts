import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";
import path from "node:path";

// find the backend even when the frontend was extracted into another folder
let repository = process.cwd();
while (!existsSync(path.join(repository, "src/app/main.py"))) {
  const parent = path.dirname(repository);
  if (parent === repository) {
    throw new Error(
      "Keep this frontend inside the Interest-Finder repository to run integration tests.",
    );
  }
  repository = parent;
}

let python = process.env.TEST_PYTHON;
if (!python) {
  const candidates = [
    path.join(repository, "venv/bin/python"),
    path.join(repository, ".venv/bin/python"),
    path.join(repository, "venv/Scripts/python.exe"),
    path.join(repository, ".venv/Scripts/python.exe"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      python = candidate;
      break;
    }
  }
}
if (!python) {
  throw new Error(
    "Install the backend dependencies in venv first, or set TEST_PYTHON to its Python executable.",
  );
}

function quote(value: string) {
  if (process.platform === "win32") {
    return '"' + value.replaceAll('"', '""') + '"';
  }
  return "'" + value.replaceAll("'", "'\\''") + "'";
}

export default defineConfig({
  testDir: "./tests/integration",
  timeout: 60000,
  expect: { timeout: 10000 },
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3001",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
    },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    {
      command: quote(python) + " scripts/run-test-api.py",
      url: "http://127.0.0.1:8001/api/v1/health",
      timeout: 60000,
      reuseExistingServer: false,
    },
    {
      command: "npm run dev -- --port 3001",
      url: "http://localhost:3001/login",
      timeout: 120000,
      reuseExistingServer: false,
      env: {
        BACKEND_API_URL: "http://127.0.0.1:8001/api/v1",
        APP_ORIGIN: "http://localhost:3001",
        NEXT_TELEMETRY_DISABLED: "1",
        NEXT_DIST_DIR: ".next-integration",
      },
    },
  ],
});
