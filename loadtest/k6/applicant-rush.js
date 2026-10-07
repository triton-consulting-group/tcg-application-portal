// Applicant deadline rush: each iteration is one applicant going through the real request sequence
// (window check -> register/role -> lookup -> submit with 3 files -> view), at RATE submissions/minute.
import http from "k6/http";
import { check } from "k6";
import { SharedArray } from "k6/data";
import exec from "k6/execution";
import { Counter, Rate } from "k6/metrics";

const BASE = `${__ENV.BASE_URL || "http://127.0.0.1:5055"}/api`;
const RATE = Number(__ENV.RATE || 120);         // peak submissions per minute (2x the assumed real peak of 60)
const HOLD = __ENV.HOLD || "4m";
const SHARED_IP = __ENV.SHARED_IP === "1";      // everyone behind one IP, like a shared campus network

const applicants = new SharedArray("applicants", () => JSON.parse(open("../.tmp/tokens.json")).applicants);
const resume = open("../.tmp/fixtures/resume.pdf", "b");
const transcript = open("../.tmp/fixtures/transcript.pdf", "b");
const image = open("../.tmp/fixtures/image.jpg", "b");

const submitted = new Counter("submissions_ok");
const submitSuccess = new Rate("submit_success");
const rateLimited = new Counter("rate_limited_429");

const WORDS = "strategy client growth market analysis team leadership consulting impact data problem solving".split(" ");
const text = (n) => Array.from({ length: n }, (_, i) => WORDS[i % WORDS.length]).join(" ");

export const options = {
  scenarios: {
    rush: {
      executor: "ramping-arrival-rate",
      timeUnit: "1m",
      startRate: 10,
      preAllocatedVUs: 60,
      maxVUs: 400,
      stages: [
        { target: RATE, duration: "1m" },
        { target: RATE, duration: HOLD },
        { target: 0, duration: "30s" },
      ],
    },
  },
  thresholds: {
    "http_req_duration{name:submit}": ["p(95)<3000"],
    "http_req_duration{kind:read}": ["p(95)<1000"],
    "http_req_duration{name:window-status}": ["p(95)<1000"],
    "http_req_duration{name:auth-register}": ["p(95)<1000"],
    "http_req_duration{name:lookup-own-application}": ["p(95)<1000"],
    http_req_failed: ["rate<0.01"],
    submit_success: ["rate>0.99"],
  },
  summaryTrendStats: ["avg", "med", "p(95)", "p(99)", "max"],
};

export default function () {
  const idx = exec.scenario.iterationInTest;
  if (idx >= applicants.length) return; // ran out of distinct applicants
  const u = applicants[idx];
  const ip = SHARED_IP ? "10.9.9.9" : u.ip;
  const params = (name, kind, extra = {}) => ({
    headers: { Authorization: `Bearer ${u.token}`, "X-Forwarded-For": ip, ...(extra.headers || {}) },
    tags: { name, kind },
    ...(extra.responseCallback ? { responseCallback: extra.responseCallback } : {}),
  });
  const track = (res) => { if (res.status === 429) rateLimited.add(1); return res; };
  const email = encodeURIComponent(u.email);

  // Landing page + sign-in (Navbar) + application page loads
  track(http.get(`${BASE}/applications/window-status`, params("window-status", "read")));
  track(http.post(`${BASE}/auth/register`, JSON.stringify({ name: `Load Test ${idx}` }),
    params("auth-register", "write", { headers: { "Content-Type": "application/json" } })));
  track(http.get(`${BASE}/auth/role/${email}`, params("auth-role", "read", { responseCallback: http.expectedStatuses(200, 404) })));
  track(http.get(`${BASE}/applications/case-night-config`, params("case-night-config", "read")));
  track(http.get(`${BASE}/applications/deadline-status`, params("deadline-status", "read")));
  track(http.get(`${BASE}/applications/email/${email}`,
    params("lookup-own-application", "read", { responseCallback: http.expectedStatuses(200, 404) })));

  // Submit (multipart, 3 files) the way ApplicationPage does
  const res = track(http.post(`${BASE}/applications`, {
    email: u.email,
    fullName: `Load Test Applicant ${idx}`,
    phoneNumber: `(858) 555-${String(idx).padStart(4, "0")}`,
    studentYear: ["1st", "2nd", "3rd", "4th"][idx % 4],
    major: "Economics",
    appliedBefore: idx % 3 === 0 ? "Yes" : "No",
    candidateType: idx % 2 ? "Tech" : "Non-Tech",
    reason: text(150),
    zombieAnswer: text(15),
    additionalInfo: text(100),
    caseNightPreferences: JSON.stringify(["A", "B"]),
    resume: http.file(resume, "resume.pdf", "application/pdf"),
    transcript: http.file(transcript, "transcript.pdf", "application/pdf"),
    image: http.file(image, "image.jpg", "image/jpeg"),
  }, params("submit", "write")));
  const ok = check(res, { "submitted (201)": (r) => r.status === 201 });
  submitSuccess.add(ok);
  if (ok) submitted.add(1);

  // Confirmation page -> "View My Application"
  track(http.get(`${BASE}/applications/email/${email}`, params("view-own-application", "read")));
}
