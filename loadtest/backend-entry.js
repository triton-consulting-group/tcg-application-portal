// Starts the real backend (backend/server.js) wired to local test services only.
const fs = require("fs");
const path = require("path");
const cfg = require("./lib/config");

if (!process.env.MONGO_URI || !process.env.MONGO_URI.includes(`127.0.0.1:${cfg.MONGO_PORT}`)) {
  console.error("Refusing to start: MONGO_URI must point at the local test database (run via stack.js).");
  process.exit(1);
}

// Never pick up real credentials: no AWS (uploads go to local disk), Firebase emulator only
for (const key of ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "S3_BUCKET_NAME", "AWS_REGION", "ADMIN_API_TOKEN"]) {
  delete process.env[key];
}
process.env.FIREBASE_PROJECT_ID = cfg.PROJECT_ID;
process.env.FIREBASE_AUTH_EMULATOR_HOST = cfg.AUTH_EMULATOR_HOST;
process.env.PORT = String(cfg.BACKEND_PORT);
process.env.NODE_ENV = "production";

// Run from an empty scratch dir so dotenv finds no .env and uploads land in .tmp/
const cwd = path.join(cfg.TMP, "backend-cwd");
fs.mkdirSync(cwd, { recursive: true });
process.chdir(cwd);

// Keep the application window open for the test, whatever the real dates are
require(path.join(cfg.BACKEND_DIR, "config", "deadlineConfig")).isActive = false;

require(path.join(cfg.BACKEND_DIR, "server.js"));
