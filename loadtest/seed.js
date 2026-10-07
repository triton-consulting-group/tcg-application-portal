// Fills the local test database with realistic applications.
//   node seed.js          -> 700 applications with status history + comments (admin review scenario)
//   node seed.js --empty  -> no applications, unique email index only (applicant rush scenario)
const fs = require("fs");
const cfg = require("./lib/config");
const mongoose = cfg.backendRequire("mongoose");

const WORDS = ("strategy client growth market analysis team leadership consulting impact data problem solving project " +
  "research student community campus case framework revenue customer insight presentation collaborate learn " +
  "experience challenge solution organization opportunity business develop passion goal recommendation").split(" ");
const STATUSES = ["Under Review", "Case Night - Yes", "Case Night - No", "Final Interview - Yes",
  "Final Interview - No", "Final Interview - Maybe", "Accepted", "Rejected"];
const MAJORS = ["Economics", "Computer Science", "Cognitive Science", "Mathematics-Computer Science", "Business Economics",
  "Data Science", "Political Science", "Bioengineering", "Psychology", "International Studies"];

let seed = 42;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648); // repeatable runs
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const int = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
const words = (n) => Array.from({ length: n }, () => pick(WORDS)).join(" ");
const s3Url = (folder, name) => `https://tcg-portal-files.s3.us-west-1.amazonaws.com/${folder}/${Date.now()}-${name}`;

const buildApplication = (i, admins) => {
  const created = new Date(Date.now() - int(1, 72) * 3600 * 1000);
  const history = Array.from({ length: int(1, 4) }, (_, h) => ({
    _id: new mongoose.Types.ObjectId(),
    status: pick(STATUSES), changedBy: pick(admins), notes: rand() < 0.3 ? words(int(5, 20)) : "",
    changedAt: new Date(created.getTime() + (h + 1) * 3600 * 1000),
  }));
  const comments = Array.from({ length: int(0, 6) }, (_, c) => {
    const by = pick(admins);
    return {
      _id: new mongoose.Types.ObjectId(),
      comment: words(int(20, 60)), commentedBy: by, adminName: by.split("@")[0],
      commentedAt: new Date(created.getTime() + (c + 1) * 1800 * 1000),
    };
  });
  return {
    email: `applicant${i}@loadtest.ucsd.edu`,
    fullName: `Applicant Number ${i}`,
    phoneNumber: `+1858555${String(i).padStart(4, "0")}`,
    studentYear: pick(["1st", "2nd", "3rd", "4th", "5th+"]),
    major: pick(MAJORS),
    appliedBefore: pick(["Yes", "No"]),
    candidateType: pick(["Tech", "Non-Tech"]),
    reason: words(int(130, 150)),          // form caps this at 150 words
    zombieAnswer: words(int(10, 15)),      // form caps this at 15 words
    additionalInfo: rand() < 0.6 ? words(int(20, 200)) : "",
    caseNightPreferences: ["A", "B", "C"].filter(() => rand() < 0.6),
    resume: s3Url("resumes", `Applicant_${i}_Resume.pdf`),
    transcript: s3Url("transcripts", `Applicant_${i}_Transcript.pdf`),
    image: s3Url("images", `applicant${i}.jpg`),
    status: history[history.length - 1].status,
    statusHistory: history,
    comments,
    createdAt: created,
    updatedAt: history[history.length - 1].changedAt,
    __v: 0,
  };
};

const main = async () => {
  const stack = JSON.parse(fs.readFileSync(cfg.STACK_FILE, "utf8"));
  await mongoose.connect(stack.mongoUri);
  const col = mongoose.connection.db.collection("applications");
  await col.drop().catch(() => {});
  await col.createIndex({ email: 1 }, { unique: true, name: "email_1" });
  await col.createIndex({ status: 1 }, { name: "status_1" });

  if (!process.argv.includes("--empty")) {
    const admins = Array.from({ length: cfg.ADMINS }, (_, i) => `admin${i}@loadtest.ucsd.edu`);
    const docs = Array.from({ length: cfg.APPLICANTS }, (_, i) => buildApplication(i, admins));
    await col.insertMany(docs);
    const stats = await mongoose.connection.db.command({ collStats: "applications" });
    console.log(`[seed] ${docs.length} applications, avg ${(stats.avgObjSize / 1024).toFixed(1)} KB each, ${(stats.size / 1024 / 1024).toFixed(2)} MB total`);
  } else {
    console.log("[seed] applications collection empty (unique email index in place)");
  }
  await mongoose.disconnect();
};

main().catch((err) => { console.error(`[seed] failed: ${err.message}`); process.exit(1); });
