import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * GUI-Tests gegen die laufende Anwendung. Startet Backend (frisch geseedet) + Frontend
 * automatisch, sofern nicht bereits Instanzen unter den konfigurierten Ports laufen
 * (siehe reuseExistingServer) — z.B. wenn `./start.sh` bereits läuft.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:5183",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "rm -f deskshare.db && uv run uvicorn app.main:app --port 8010",
      cwd: path.resolve(__dirname, "../backend"),
      url: "http://127.0.0.1:8010/api/health",
      timeout: 60_000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "npm run dev",
      cwd: __dirname,
      url: "http://127.0.0.1:5183",
      timeout: 60_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
