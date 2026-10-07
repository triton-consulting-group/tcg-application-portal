const path = require("path");
const { createRequire } = require("module");

const ROOT = path.resolve(__dirname, "..");
const TMP = path.join(ROOT, ".tmp");
const BACKEND_DIR = path.resolve(ROOT, "..", "backend");

module.exports = {
  ROOT,
  TMP,
  BACKEND_DIR,
  // Load mongoose / firebase-admin from the backend's own node_modules so versions match production
  backendRequire: createRequire(path.join(BACKEND_DIR, "package.json")),

  PROJECT_ID: "demo-tcg-loadtest", // "demo-" projects only ever talk to the local emulator
  AUTH_EMULATOR_HOST: "127.0.0.1:9099",
  MONGO_PORT: 27018,
  BACKEND_PORT: 5055,
  BACKEND_URL: "http://127.0.0.1:5055",

  APPLICANTS: Number(process.env.APPLICANTS || 700),
  ADMINS: Number(process.env.ADMINS || 30),

  STACK_FILE: path.join(TMP, "stack.json"),
  TOKENS_FILE: path.join(TMP, "tokens.json"),
  RESULTS_DIR: path.join(TMP, "results"),
  FIXTURES_DIR: path.join(TMP, "fixtures"),
  LOGS_DIR: path.join(TMP, "logs"),
};
