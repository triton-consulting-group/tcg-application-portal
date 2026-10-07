// Admin review: ADMINS concurrent admins working the dashboard the way AssociatePage.js does.
// Each loop: open an application (3 signed file links), read, change its status (PUT; the dashboard merges
// the returned application), sometimes comment, read again.
// LEGACY_REFETCH=1 re-downloads every application after each status change (the pre-fix frontend).
// SHARED_IP=1 puts every admin behind one IP (the whole board reviewing on one network).
import http from "k6/http";
import { check, sleep } from "k6";
import { SharedArray } from "k6/data";
import { Counter, Trend } from "k6/metrics";

const BASE = `${__ENV.BASE_URL || "http://127.0.0.1:5055"}/api`;
const DURATION = __ENV.DURATION || "10m";
const LEGACY_REFETCH = __ENV.LEGACY_REFETCH === "1";
const SHARED_IP = __ENV.SHARED_IP === "1";
const STATUSES = ["Under Review", "Case Night - Yes", "Case Night - No", "Final Interview - Yes",
  "Final Interview - No", "Final Interview - Maybe", "Accepted", "Rejected"];

const admins = new SharedArray("admins", () => JSON.parse(open("../.tmp/tokens.json")).admins);

const statusChanges = new Counter("status_changes");
const dashboardLoads = new Counter("dashboard_loads");
const dashboardBytes = new Trend("dashboard_response_bytes");
const dashboardBytesTotal = new Counter("dashboard_bytes_total");
const rateLimited = new Counter("rate_limited_429");

export const options = {
  scenarios: {
    review: { executor: "constant-vus", vus: admins.length, duration: DURATION },
  },
  thresholds: {
    "http_req_duration{name:dashboard-all}": ["p(95)<2000"],
    "http_req_duration{name:file-url}": ["p(95)<1000"],
    "http_req_duration{name:status-change}": ["p(95)<1000"],
    "http_req_duration{name:comment}": ["p(95)<1000"],
    "http_req_duration{name:admin-check}": ["p(95)<1000"],
    http_req_failed: ["rate<0.01"],
  },
  summaryTrendStats: ["avg", "med", "p(95)", "p(99)", "max"],
};

let apps = null; // per-admin copy of the dashboard list, like React state

export default function () {
  const a = admins[(__VU - 1) % admins.length];
  const params = (name, json = false) => ({
    headers: { Authorization: `Bearer ${a.token}`, "X-Forwarded-For": SHARED_IP ? "10.9.9.9" : a.ip, ...(json ? { "Content-Type": "application/json" } : {}) },
    tags: { name },
  });
  const loadDashboard = () => {
    const res = http.get(`${BASE}/applications/all`, params("dashboard-all"));
    if (check(res, { "dashboard loaded": (r) => r.status === 200 })) {
      dashboardLoads.add(1);
      dashboardBytes.add(res.body.length);
      dashboardBytesTotal.add(res.body.length);
      apps = res.json().map((x) => ({ _id: x._id, resume: x.resume, transcript: x.transcript, image: x.image }));
    }
  };

  if (!apps) {
    http.post(`${BASE}/admin/check`, "{}", params("admin-check", true));
    loadDashboard();
    if (!apps || apps.length === 0) { sleep(5); return; }
  }

  // Open an application: the detail modal signs links for its files
  const app = apps[Math.floor(Math.random() * apps.length)];
  for (const f of ["resume", "transcript", "image"]) {
    if (!app[f]) continue;
    const r = http.get(`${BASE}/applications/file-url/${encodeURIComponent(app[f])}`, params("file-url"));
    if (r.status === 429) rateLimited.add(1);
  }
  sleep(8 + Math.random() * 4);

  // Change its status the way updateStatus() does: PUT (plus a full refetch in legacy mode)
  const res = http.put(`${BASE}/applications/${app._id}`,
    JSON.stringify({ status: STATUSES[Math.floor(Math.random() * STATUSES.length)], notes: "" }), params("status-change", true));
  if (check(res, { "status changed": (r) => r.status === 200 })) statusChanges.add(1);
  if (LEGACY_REFETCH) loadDashboard();

  if (Math.random() < 0.2) {
    http.post(`${BASE}/applications/${app._id}/comment`,
      JSON.stringify({ comment: "Strong case answer; would like to see them at final interviews." }), params("comment", true));
  }
  sleep(8 + Math.random() * 4);
}
