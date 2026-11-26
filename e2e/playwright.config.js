// End-to-end test against a fully local copy of the app: nothing here touches production.
// Starts the load test stack (throwaway MongoDB, Firebase Auth emulator, real backend on 5055)
// and the real frontend on localhost:3000 (the origin the backend's CORS allows), then runs tests/.
const path = require("path");
const { defineConfig, devices } = require("@playwright/test");
const cfg = require("../loadtest/lib/config");

const ROOT = path.resolve(__dirname, "..");

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 3 * 60 * 1000,
  expect: { timeout: 15 * 1000 },
  workers: 1,
  retries: 0, // each run gets a fresh stack; a retry would hit the already-submitted application
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"], ["html", { open: "on-failure" }]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  // channel "chromium" = the full Chromium build. The default headless shell intermittently stalls loading
  // Firebase's hidden sign-in frame, so the emulator's Google sign-in never completes.
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], channel: "chromium" } }],
  webServer: [
    {
      command: "node stack.js",
      cwd: path.join(ROOT, "loadtest"),
      url: `${cfg.BACKEND_URL}/health`,
      timeout: 3 * 60 * 1000, // first run downloads a MongoDB binary
      reuseExistingServer: false,
    },
    {
      command: "npm start",
      cwd: path.join(ROOT, "frontend"),
      url: "http://localhost:3000",
      timeout: 3 * 60 * 1000,
      reuseExistingServer: false, // never test a dev server that's pointed at real services
      // Set every Firebase key so nothing from frontend/.env (the real project) leaks in
      env: {
        BROWSER: "none",
        PORT: "3000",
        REACT_APP_API_BASE_URL: cfg.BACKEND_URL,
        REACT_APP_AUTH_EMULATOR_HOST: cfg.AUTH_EMULATOR_HOST,
        REACT_APP_FIREBASE_API_KEY: "demo-key",
        REACT_APP_FIREBASE_AUTH_DOMAIN: "localhost",
        REACT_APP_FIREBASE_PROJECT_ID: cfg.PROJECT_ID,
        REACT_APP_FIREBASE_STORAGE_BUCKET: "",
        REACT_APP_FIREBASE_MESSAGING_SENDER_ID: "",
        REACT_APP_FIREBASE_APP_ID: "",
        REACT_APP_FIREBASE_MEASUREMENT_ID: "",
      },
    },
  ],
});
