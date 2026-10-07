# Bottleneck tests

Local load tests for the application portal. **Nothing here touches production**: the tests run the real backend code against a throwaway local MongoDB, the Firebase Auth emulator, and local disk instead of S3. Database usage is measured and compared with MongoDB Atlas's free-tier limits (100 operations/second, 10 GB in + 10 GB out per 7 days), which is what production runs on.

## One-time setup

```bash
brew install k6
npm install -g firebase-tools
cd backend && npm ci && cd ../loadtest && npm install
```

Java must be installed for the Firebase emulator. The first `npm run stack` downloads a MongoDB server binary (about a minute).

## Running

Terminal 1 (leave it running):

```bash
cd loadtest && npm run stack
```

Terminal 2:

| Command | What it simulates |
| --- | --- |
| `npm run rush` | Applicant deadline rush: ramps to 120 submissions/minute (2x the assumed real peak) with 3 files each, plus every read an applicant makes |
| `npm run rush:shared-ip` | The same rush with every applicant behind one IP (shared campus network) |
| `npm run review` | 30 admins working through 700 seeded applications, exactly like the dashboard does |
| `node run.js review --shared-ip` | The same with every admin behind one IP (the board reviewing together on one network) |
| `node run.js review --legacy-refetch` | The pre-fix dashboard, which re-downloaded every application after each status change |

Each run creates fresh test users (tokens last 1 hour) and fresh data, then prints a report and saves it to `.tmp/results/`. Tunables: `RATE` and `HOLD` (rush), `DURATION` (review), `APPLICANTS`, `ADMINS`, `RESUME_KB` / `TRANSCRIPT_KB` / `IMAGE_KB`, `REVIEW_STATUS_CHANGES` (weekly projection, default 6000).

`npm run clean` deletes `.tmp/` (test data, uploaded fixture files, results).

## How it works

| File | Role |
| --- | --- |
| `stack.js` | Starts MongoDB (`mongodb-memory-server`, port 27018), the Auth emulator (9099) and the backend (5055) |
| `backend-entry.js` | Runs `backend/server.js` with test-only settings: local DB only, no AWS, emulator sign-ins, window forced open, no `.env` |
| `users.js` | Creates applicant and admin accounts in the emulator and their Admin records |
| `seed.js` | 700 realistic applications (full-length answers, status history, comments), or an empty collection for the rush |
| `monitor.js` | Samples DB operations/second, DB bytes in/out, backend CPU and memory every second |
| `k6/applicant-rush.js`, `k6/admin-review.js` | The traffic, mirroring the frontend's real request sequence |
| `run.js` | Runs a scenario end to end and writes the report |

## Limits of the method

- The backend runs on this laptop's CPU and Node version, not Railway's; latency between Railway and Atlas isn't included.
- Uploads go to local disk, so S3 upload time isn't included in submit times.
- Operation counts come from MongoDB's own counters; Atlas counts similarly but not identically, so treat the ops/second figures as close estimates.
