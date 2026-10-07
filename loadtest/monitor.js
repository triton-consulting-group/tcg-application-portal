// Samples the test database and backend once per second until SIGINT, then writes a summary.
//   node monitor.js <output.json>
// Database ops and bytes are what Atlas's free tier limits (100 ops/s, 10 GB in + 10 GB out per 7 days).
const fs = require("fs");
const { execFileSync } = require("child_process");
const cfg = require("./lib/config");
const { MongoClient } = cfg.backendRequire("mongoose").mongo;

const OUT = process.argv[2];
const OP_FIELDS = ["insert", "query", "update", "delete", "getmore", "command"];
// Leave the bulky sections out so the monitor's own traffic stays small
const STATUS_CMD = {
  serverStatus: 1, wiredTiger: 0, metrics: 0, locks: 0, tcmalloc: 0, transactions: 0, logicalSessionRecordCache: 0,
  flowControl: 0, storageEngine: 0, globalLock: 0, extra_info: 0, asserts: 0, opLatencies: 0, repl: 0, oplog: 0,
  catalogStats: 0, electionMetrics: 0, freeMonitoring: 0, indexBulkBuilder: 0, mirroredReads: 0, queryAnalyzers: 0,
  readConcernCounters: 0, readPreferenceCounters: 0, security: 0, shardingStatistics: 0, storageEngineStats: 0,
  tenantMigrations: 0, twoPhaseCommitCoordinator: 0, trafficRecording: 0, transportSecurity: 0, watchdog: 0,
  queues: 0, admission: 0, collectionCatalog: 0, defaultRWConcern: 0, health: 0, featureCompatibilityVersion: 0,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sample = async (db) => {
  const s = await db.command(STATUS_CMD);
  return {
    t: Date.now(),
    ops: OP_FIELDS.reduce((sum, f) => sum + (s.opcounters[f] || 0), 0),
    bytesIn: s.network.bytesIn,
    bytesOut: s.network.bytesOut,
  };
};
const backendUsage = (pid) => {
  try {
    const [cpu, rssKb] = execFileSync("ps", ["-o", "%cpu=,rss=", "-p", String(pid)]).toString().trim().split(/\s+/).map(Number);
    return { cpu, rssMb: rssKb / 1024 };
  } catch {
    return { cpu: 0, rssMb: 0 };
  }
};

(async () => {
  const stack = JSON.parse(fs.readFileSync(cfg.STACK_FILE, "utf8"));
  const client = await MongoClient.connect(stack.mongoUri);
  const db = client.db("admin");

  // Calibrate the monitor's own overhead with the system idle
  const idle = [await sample(db)];
  for (let i = 0; i < 5; i++) { await sleep(1000); idle.push(await sample(db)); }
  const per = (k) => (idle[idle.length - 1][k] - idle[0][k]) / (idle.length - 1);
  const overhead = { ops: per("ops"), bytesIn: per("bytesIn"), bytesOut: per("bytesOut") };
  if (process.send) process.send("ready");

  const rows = [];
  let prev = await sample(db);
  let stopping = false;
  process.on("SIGINT", () => { stopping = true; });
  process.on("SIGTERM", () => { stopping = true; });

  while (!stopping) {
    await sleep(1000);
    const cur = await sample(db);
    const secs = (cur.t - prev.t) / 1000;
    const usage = backendUsage(stack.backendPid);
    rows.push({
      t: cur.t,
      opsPerSec: Math.max(0, (cur.ops - prev.ops) / secs - overhead.ops),
      bytesIn: Math.max(0, cur.bytesIn - prev.bytesIn - overhead.bytesIn * secs),
      bytesOut: Math.max(0, cur.bytesOut - prev.bytesOut - overhead.bytesOut * secs),
      cpu: usage.cpu,
      rssMb: usage.rssMb,
    });
    prev = cur;
  }

  const active = rows.filter((r) => r.opsPerSec > 0.5);
  const windowPeak = (n) => rows.reduce((best, _, i) => {
    if (i + n > rows.length) return best;
    return Math.max(best, rows.slice(i, i + n).reduce((s, r) => s + r.opsPerSec, 0) / n);
  }, 0);
  const sum = (k) => rows.reduce((s, r) => s + r[k], 0);
  const summary = {
    seconds: rows.length,
    peakOpsPerSec: Math.max(0, ...rows.map((r) => r.opsPerSec)),
    peak10sOpsPerSec: windowPeak(10),
    avgActiveOpsPerSec: active.length ? active.reduce((s, r) => s + r.opsPerSec, 0) / active.length : 0,
    dbBytesIn: sum("bytesIn"),
    dbBytesOut: sum("bytesOut"),
    peakBackendCpu: Math.max(0, ...rows.map((r) => r.cpu)),
    peakBackendRssMb: Math.max(0, ...rows.map((r) => r.rssMb)),
  };
  fs.writeFileSync(OUT, JSON.stringify({ summary, rows }, null, 2));
  await client.close();
  process.exit(0);
})().catch((err) => { console.error(`[monitor] failed: ${err.message}`); process.exit(1); });
