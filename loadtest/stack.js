// Starts the local test stack and keeps it running until Ctrl+C:
//   MongoDB (mongodb-memory-server) -> Firebase Auth emulator -> backend (real code, test config)
const fs = require("fs");
const path = require("path");
const net = require("net");
const { spawn } = require("child_process");
const { MongoMemoryServer } = require("mongodb-memory-server");
const cfg = require("./lib/config");

const children = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const waitForPort = async (port, label, timeoutMs = 120000) => {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const open = await new Promise((resolve) => {
      const sock = net.connect(port, "127.0.0.1", () => { sock.end(); resolve(true); });
      sock.on("error", () => resolve(false));
    });
    if (open) return;
    await sleep(500);
  }
  throw new Error(`${label} did not start on port ${port}`);
};

const waitForLog = async (file, text, label, timeoutMs = 60000) => {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const log = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
    if (log.includes(text)) return;
    if (/Error connecting to MongoDB/.test(log)) throw new Error(`${label} could not reach MongoDB (see ${file})`);
    await sleep(500);
  }
  throw new Error(`${label} did not log "${text}" (see ${file})`);
};

const startChild = (name, cmd, args, opts) => {
  const logFile = path.join(cfg.LOGS_DIR, `${name}.log`);
  const out = fs.openSync(logFile, "w");
  const child = spawn(cmd, args, { stdio: ["ignore", out, out], ...opts });
  child.on("exit", (code) => console.log(`[stack] ${name} exited (${code})`));
  children.push(child);
  return { child, logFile };
};

(async () => {
  fs.mkdirSync(cfg.LOGS_DIR, { recursive: true });

  console.log("[stack] starting MongoDB (first run downloads the server binary, ~1 min)...");
  const mongo = await MongoMemoryServer.create({ instance: { port: cfg.MONGO_PORT, ip: "127.0.0.1", dbName: "test" } });
  const mongoUri = `mongodb://127.0.0.1:${cfg.MONGO_PORT}/test`;
  console.log(`[stack] MongoDB ready at ${mongoUri}`);

  console.log("[stack] starting Firebase Auth emulator...");
  startChild("auth-emulator", "firebase", ["emulators:start", "--only", "auth", "--project", cfg.PROJECT_ID], { cwd: cfg.ROOT });
  await waitForPort(9099, "Auth emulator");
  console.log(`[stack] Auth emulator ready at ${cfg.AUTH_EMULATOR_HOST}`);

  console.log("[stack] starting backend...");
  const { child: backend, logFile } = startChild("backend", process.execPath, [path.join(cfg.ROOT, "backend-entry.js")], {
    cwd: cfg.ROOT,
    env: { ...process.env, MONGO_URI: mongoUri },
  });
  await waitForLog(logFile, "MongoDB Connected", "Backend");
  await waitForPort(cfg.BACKEND_PORT, "Backend");
  console.log(`[stack] backend ready at ${cfg.BACKEND_URL} (log: ${logFile})`);

  fs.writeFileSync(cfg.STACK_FILE, JSON.stringify({ mongoUri, backendPid: backend.pid, startedAt: new Date().toISOString() }, null, 2));
  console.log("[stack] up. Leave this running; in another tab run `npm run rush` or `npm run review`. Ctrl+C to stop.");

  const shutdown = async () => {
    console.log("\n[stack] stopping...");
    for (const c of children) c.kill("SIGTERM");
    try {
      await mongo.stop();
    } catch (err) {
      console.log(`[stack] MongoDB was already stopping (${err.message})`);
    }
    fs.rmSync(cfg.STACK_FILE, { force: true });
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
})().catch((err) => {
  console.error(`[stack] failed: ${err.message}`);
  for (const c of children) c.kill("SIGTERM");
  process.exit(1);
});
