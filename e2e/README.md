# End-to-end test

A Playwright test that drives a real browser through the whole app. **Nothing here touches production**: it runs against the load test's local stack (throwaway MongoDB, Firebase Auth emulator, real backend) and the real frontend, all on this machine.

What it checks, in one run:

1. An applicant signs in with Google from the home page, fills in the application, attaches a resume, transcript and photo, and submits.
2. They see the confirmation page, then open their application and see their details.
3. An admin signs in on `/admin-login`, finds the applicant on `/associate`, changes their status to "Case Night - Yes", and the change survives a reload.
4. The applicant sees "Application Status: Case Night - Yes".

"Google" sign-in is the Auth emulator's account picker, so no real accounts are used.

## Setup (once)

```bash
cd backend && npm ci
cd ../frontend && npm ci
cd ../loadtest && npm ci
cd ../e2e && npm ci && npx playwright install chromium
```

## Running

```bash
cd e2e && npm test
```

Playwright starts the stack and the frontend itself and stops them afterwards; the first run takes about a minute longer while MongoDB downloads. Ports 3000, 5055, 9099 and 27018 must be free, so stop your local frontend (`npm start`) and any load test stack first.

If it fails, `npm run report` opens screenshots, a video and a step-by-step trace. On pull requests the same test runs in CI, and the report is attached to the run.
