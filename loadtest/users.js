// Creates test applicants + admins in the Firebase Auth emulator and writes their ID tokens to .tmp/tokens.json.
// Also (re)creates the matching Admin records in the local test database.
const fs = require("fs");
const cfg = require("./lib/config");

process.env.FIREBASE_AUTH_EMULATOR_HOST = cfg.AUTH_EMULATOR_HOST;
const admin = cfg.backendRequire("firebase-admin");
const mongoose = cfg.backendRequire("mongoose");

const PASSWORD = "loadtest-password";
const EMULATOR = `http://${cfg.AUTH_EMULATOR_HOST}`;

const pool = async (items, limit, fn) => {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: limit }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }));
  return results;
};

const createAndSignIn = async (auth, email) => {
  await auth.createUser({ email, password: PASSWORD, emailVerified: true });
  const res = await fetch(`${EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }),
  });
  if (!res.ok) throw new Error(`sign-in failed for ${email}: ${res.status} ${await res.text()}`);
  return (await res.json()).idToken;
};

const main = async () => {
  const stack = JSON.parse(fs.readFileSync(cfg.STACK_FILE, "utf8"));
  const started = Date.now();

  // Start from a clean emulator
  await fetch(`${EMULATOR}/emulator/v1/projects/${cfg.PROJECT_ID}/accounts`, { method: "DELETE" });
  const app = admin.initializeApp({ projectId: cfg.PROJECT_ID }, `loadtest-${Date.now()}`);
  const auth = admin.auth(app);

  const applicants = Array.from({ length: cfg.APPLICANTS }, (_, i) => ({
    email: `applicant${i}@loadtest.ucsd.edu`,
    ip: `10.0.${Math.floor(i / 250)}.${(i % 250) + 1}`, // distinct simulated client IP per applicant
  }));
  const admins = Array.from({ length: cfg.ADMINS }, (_, i) => ({
    email: `admin${i}@loadtest.ucsd.edu`,
    name: `Load Test Admin ${i}`,
    ip: `10.1.0.${i + 1}`,
  }));

  await pool([...applicants, ...admins], 25, async (u) => { u.token = await createAndSignIn(auth, u.email); });

  // Admin records the backend looks up after verifying the token
  await mongoose.connect(stack.mongoUri);
  const col = mongoose.connection.db.collection("admins");
  await col.deleteMany({ email: /@loadtest\.ucsd\.edu$/ });
  const now = new Date();
  await col.insertMany(admins.map((a) => ({
    email: a.email, name: a.name, role: "admin", isActive: true, createdBy: "loadtest",
    permissions: {
      canViewApplications: true, canEditApplications: true, canDeleteApplications: false, canManageAdmins: false,
      canViewAnalytics: true, canChangeStatus: true, canAddComments: true, canDragDrop: true,
    },
    createdAt: now, updatedAt: now, __v: 0,
  })));
  await mongoose.disconnect();

  fs.writeFileSync(cfg.TOKENS_FILE, JSON.stringify({ createdAt: now.toISOString(), applicants, admins }));
  console.log(`[users] ${applicants.length} applicants + ${admins.length} admins ready (${((Date.now() - started) / 1000).toFixed(1)}s). Tokens are valid for 1 hour.`);
};

main().catch((err) => { console.error(`[users] failed: ${err.message}`); process.exit(1); });
