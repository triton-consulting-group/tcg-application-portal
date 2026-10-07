// Runs one bottleneck scenario end to end against the local stack (start it first with `npm run stack`).
//   node run.js rush [--shared-ip]     applicant deadline rush
//   node run.js review [--legacy-refetch] [--shared-ip]  30 admins reviewing 700 applications
// Extra env: RATE, HOLD (rush), DURATION (review), REVIEW_STATUS_CHANGES (projection, default 6000)
const fs = require("fs");
const path = require("path");
const { execFileSync, spawn, fork } = require("child_process");
const cfg = require("./lib/config");
const makeFixtures = require("./fixtures");

const ATLAS_FREE = { opsPerSec: 100, gbPerWeekEachWay: 10 };
const GB = 1024 ** 3;
const MB = 1024 ** 2;

const [scenario, ...flags] = process.argv.slice(2);
const sharedIp = flags.includes("--shared-ip");
const legacyRefetch = flags.includes("--legacy-refetch");
if (!["rush", "review"].includes(scenario)) {
  console.error("usage: node run.js rush [--shared-ip] | review [--legacy-refetch] [--shared-ip]");
  process.exit(2);
}
const name = [scenario, sharedIp && "shared-ip", legacyRefetch && "legacy-refetch"].filter(Boolean).join("-");

const exitOf = (child) => new Promise((resolve) => child.on("exit", (code) => resolve(code)));
const node = (script, args = []) => execFileSync(process.execPath, [path.join(cfg.ROOT, script), ...args], { stdio: "inherit" });

const metric = (k6, key, stat) => k6.metrics[key]?.[stat];
const ms = (v) => (v === undefined ? "n/a" : `${Math.round(v)} ms`);
const pass = (ok) => (ok ? "PASS" : "FAIL");

(async () => {
  if (!fs.existsSync(cfg.STACK_FILE)) throw new Error("stack isn't running: start it with `npm run stack` in another tab");
  await fetch(`${cfg.BACKEND_URL}/health`).catch(() => { throw new Error("backend isn't answering /health; restart `npm run stack`"); });
  fs.mkdirSync(cfg.RESULTS_DIR, { recursive: true });

  makeFixtures();
  node("users.js");                                   // fresh 1-hour tokens every run
  node("seed.js", scenario === "rush" ? ["--empty"] : []);

  const monFile = path.join(cfg.RESULTS_DIR, `${name}-db.json`);
  const k6File = path.join(cfg.RESULTS_DIR, `${name}-k6.json`);
  const monitor = fork(path.join(cfg.ROOT, "monitor.js"), [monFile]);
  await new Promise((resolve, reject) => { monitor.once("message", resolve); monitor.once("exit", () => reject(new Error("monitor failed"))); });

  console.log(`\n[run] ${name}: starting k6...\n`);
  const script = path.join(cfg.ROOT, "k6", scenario === "rush" ? "applicant-rush.js" : "admin-review.js");
  const k6 = spawn("k6", ["run", "--summary-export", k6File, script], {
    stdio: "inherit",
    env: { ...process.env, BASE_URL: cfg.BACKEND_URL, SHARED_IP: sharedIp ? "1" : "0", LEGACY_REFETCH: legacyRefetch ? "1" : "0" },
  });
  const k6Code = await exitOf(k6);
  monitor.kill("SIGINT");
  await exitOf(monitor);

  const db = JSON.parse(fs.readFileSync(monFile, "utf8")).summary;
  const k = JSON.parse(fs.readFileSync(k6File, "utf8"));
  const failedRate = metric(k, "http_req_failed", "value") ?? 0;
  const lines = [`# Bottleneck test: ${name}`, "", `Run: ${new Date().toISOString()} | k6 exit code ${k6Code} (99 = a threshold failed)`, ""];

  const dbRows = [
    ["Peak DB operations / second (1 s)", db.peakOpsPerSec.toFixed(1), `limit ${ATLAS_FREE.opsPerSec}`, pass(db.peakOpsPerSec < 70)],
    ["Peak DB operations / second (10 s avg)", db.peak10sOpsPerSec.toFixed(1), `limit ${ATLAS_FREE.opsPerSec}`, pass(db.peak10sOpsPerSec < 70)],
    ["DB data out during test", `${(db.dbBytesOut / MB).toFixed(1)} MB`, "", ""],
    ["DB data in during test", `${(db.dbBytesIn / MB).toFixed(1)} MB`, "", ""],
    ["Backend peak CPU", `${db.peakBackendCpu.toFixed(0)} %`, "one core = 100 %", ""],
    ["Backend peak memory", `${db.peakBackendRssMb.toFixed(0)} MB`, "", ""],
  ];

  if (scenario === "rush") {
    const ok = metric(k, "submissions_ok", "count") ?? 0;
    const perSub = ok ? (db.dbBytesIn + db.dbBytesOut) / ok : 0;
    const total700 = (perSub * 700) / GB;
    lines.push("## Requests", "", "| Request | p95 | p99 | max | Target | Result |", "| --- | --- | --- | --- | --- | --- |");
    for (const [label, key, target] of [
      ["Submit (3 files)", "http_req_duration{name:submit}", 3000],
      ["All reads", "http_req_duration{kind:read}", 1000],
      ["Window status", "http_req_duration{name:window-status}", 1000],
      ["Register on sign-in", "http_req_duration{name:auth-register}", 1000],
      ["Look up own application", "http_req_duration{name:lookup-own-application}", 1000],
    ]) {
      const p95 = metric(k, key, "p(95)");
      lines.push(`| ${label} | ${ms(p95)} | ${ms(metric(k, key, "p(99)"))} | ${ms(metric(k, key, "max"))} | < ${target} ms | ${pass(p95 !== undefined && p95 < target)} |`);
    }
    lines.push("", `Submissions saved: **${ok}** | failed requests: **${(failedRate * 100).toFixed(2)}%** | rate-limited (429): **${metric(k, "rate_limited_429", "count") ?? 0}**`);
    dbRows.push(["DB data per submission", `${(perSub / 1024).toFixed(1)} KB`, "", ""]);
    dbRows.push(["Projected DB data for 700 applicants", `${total700.toFixed(3)} GB`, `limit ${ATLAS_FREE.gbPerWeekEachWay} GB/week each way`, pass(total700 < 5)]);
  } else {
    const changes = metric(k, "status_changes", "count") ?? 0;
    const planned = Number(process.env.REVIEW_STATUS_CHANGES || 6000);
    const perChange = changes ? db.dbBytesOut / changes : 0;
    const weekly = (perChange * planned) / GB;
    lines.push("## Requests", "", "| Request | p95 | p99 | max | Target | Result |", "| --- | --- | --- | --- | --- | --- |");
    for (const [label, key, target] of [
      ["Load dashboard (all applications)", "http_req_duration{name:dashboard-all}", 2000],
      ["Signed file link", "http_req_duration{name:file-url}", 1000],
      ["Status change", "http_req_duration{name:status-change}", 1000],
      ["Comment", "http_req_duration{name:comment}", 1000],
    ]) {
      const p95 = metric(k, key, "p(95)");
      lines.push(`| ${label} | ${ms(p95)} | ${ms(metric(k, key, "p(99)"))} | ${ms(metric(k, key, "max"))} | < ${target} ms | ${pass(p95 !== undefined && p95 < target)} |`);
    }
    lines.push("", `Status changes: **${changes}** | dashboard loads: **${metric(k, "dashboard_loads", "count") ?? 0}** | avg dashboard response: **${((metric(k, "dashboard_response_bytes", "avg") ?? 0) / MB).toFixed(2)} MB** | failed requests: **${(failedRate * 100).toFixed(2)}%** | rate-limited (429): **${metric(k, "rate_limited_429", "count") ?? 0}**`);
    dbRows.push(["DB data out per status change", `${(perChange / MB).toFixed(2)} MB`, legacyRefetch ? "legacy: full refetch after each change" : "current frontend: merges the one changed application", ""]);
    dbRows.push([`Projected DB data out for ${planned} status changes`, `${weekly.toFixed(2)} GB`, `limit ${ATLAS_FREE.gbPerWeekEachWay} GB/week`, pass(weekly < 5)]);
  }

  lines.push("", "## Database (Atlas free tier limits) and backend", "", "| Measure | Value | Limit / note | Result |", "| --- | --- | --- | --- |");
  for (const r of dbRows) lines.push(`| ${r.join(" | ")} |`);
  lines.push("", "Notes: measured on a local MongoDB against Atlas's published free-tier limits; the local backend runs on this laptop's Node, not Railway's.");

  const report = lines.join("\n");
  const reportFile = path.join(cfg.RESULTS_DIR, `${name}.md`);
  fs.writeFileSync(reportFile, report);
  console.log(`\n${report}\n\n[run] report saved to ${reportFile}`);
})().catch((err) => { console.error(`[run] ${err.message}`); process.exit(1); });
