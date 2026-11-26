// One applicant and one admin, through the real frontend and backend:
// apply -> confirmation -> view my application -> admin changes the status -> applicant sees it.
const { test, expect } = require("@playwright/test");
const cfg = require("../../loadtest/lib/config");

const mongoose = cfg.backendRequire("mongoose");

const APPLICANT = { email: "e2e-applicant@ucsd.edu", name: "E2E Applicant" };
const ADMIN = { email: "e2e-admin@ucsd.edu", name: "E2E Admin" };
const NEW_STATUS = "Case Night - Yes";

// The admin must already have an active Admin record, like a real reviewer
test.beforeAll(async () => {
  await mongoose.connect(`mongodb://127.0.0.1:${cfg.MONGO_PORT}/test`);
  const now = new Date();
  await mongoose.connection.db.collection("admins").insertOne({
    email: ADMIN.email, name: ADMIN.name, role: "admin", isActive: true, createdBy: "e2e",
    permissions: {
      canViewApplications: true, canEditApplications: true, canDeleteApplications: false, canManageAdmins: false,
      canViewAnalytics: true, canChangeStatus: true, canAddComments: true, canDeleteComments: true, canDragDrop: true,
    },
    createdAt: now, updatedAt: now, __v: 0,
  });
});

test.afterAll(async () => {
  await mongoose.disconnect();
});

// Clicks a Google sign-in button and completes the Auth emulator's account picker popup
const signInWithGoogle = async (page, button, user) => {
  const popupPromise = page.waitForEvent("popup");
  await button.click();
  const popup = await popupPromise;
  // The emulator page shows its buttons before its script (behind a CDN download) wires them up
  await popup.waitForLoadState("load");
  await popup.getByRole("button", { name: /add new account/i }).click();
  await popup.getByLabel("Email").fill(user.email);
  await popup.getByLabel("Display name").fill(user.name);
  // The popup hands the sign-in to a hidden frame in the app, which loads Google's script first; if that
  // frame isn't ready yet the hand-off is dropped and the popup stays open, so submit again until it
  // closes (Firebase ignores a repeat of an already handled sign-in)
  const submit = popup.getByRole("button", { name: /sign in with google\.com/i });
  await expect(async () => {
    if (!popup.isClosed()) await submit.click({ timeout: 2000 });
    await expect.poll(() => popup.isClosed(), { timeout: 3000 }).toBe(true);
  }).toPass({ timeout: 60 * 1000 });
};

// The form's questions are <p> labels followed by their input
const field = (page, question) =>
  page.getByText(question, { exact: true })
    .locator("xpath=following-sibling::*[self::input or self::select or self::textarea][1]");

const file = (name, mimeType, body) => ({ name, mimeType, buffer: Buffer.from(body) });

// Applicant and admin each get their own browser, like two different people
test("applicant applies, admin moves them to case night, applicant sees the new status", async ({ page, browser }) => {
  await test.step("applicant signs in from the home page", async () => {
    await page.goto("/");
    await page.getByRole("button", { name: "Apply Now" }).click();
    await signInWithGoogle(page, page.getByRole("button", { name: "Sign in with Google" }), APPLICANT);
    await expect(page.getByText("APPLICATION - TCG FALL 2026 RECRUITMENT")).toBeVisible();
  });

  await test.step("applicant fills in and submits the application", async () => {
    await field(page, "Full Name *").fill(APPLICANT.name);
    await field(page, "Phone Number *").fill("(858) 555-0142");
    await field(page, "What year are you? *").selectOption("3rd");
    await field(page, "What is your major? *").fill("Economics");
    await field(page, "Have you applied to TCG before? *").selectOption("No");
    await field(page, "Are you applying as a tech candidate or non-tech candidate?*").selectOption("Tech");
    await field(page, "Please submit your resume *").setInputFiles(file("resume.pdf", "application/pdf", "%PDF-1.4\n%%EOF\n"));
    await field(page, "Please submit your most recent college transcript. *")
      .setInputFiles(file("transcript.pdf", "application/pdf", "%PDF-1.4\n%%EOF\n"));
    await field(page, "Please upload a profile picture (must be professional) (JPG/PNG) *")
      .setInputFiles(file("photo.jpg", "image/jpeg", [0xff, 0xd8, 0xff, 0xe0, 0xff, 0xd9]));
    await field(page, "Why do you want to join TCG? (150 words max) *").fill("I want to solve real problems for real clients with a great team.");
    await field(page, "How are you surviving the zombie apocalypse? (15 words) *").fill("Spreadsheets, a bike, and a very good plan.");
    await page.getByRole("checkbox").first().check();

    await page.getByRole("button", { name: "Submit Application" }).click();
    await expect(page.getByText("Application Submitted Successfully!")).toBeVisible();
  });

  await test.step("applicant views their application", async () => {
    await page.getByRole("button", { name: "Return to Home" }).click();
    await page.getByRole("button", { name: "Apply Now" }).click();
    await expect(page.getByText("Application Status: Under Review")).toBeVisible();
    await page.getByRole("button", { name: "View & Edit My Application" }).click();
    await expect(page.getByText(`Email: ${APPLICANT.email}`)).toBeVisible();
    await expect(page.getByText(APPLICANT.name, { exact: true })).toBeVisible();
  });

  await test.step("admin signs in and changes the applicant's status", async () => {
    const adminContext = await browser.newContext({ baseURL: "http://localhost:3000" });
    const admin = await adminContext.newPage();
    await admin.goto("/admin-login");
    await signInWithGoogle(admin, admin.getByRole("button", { name: "Sign in with Google" }), ADMIN);
    await expect(admin).toHaveURL(/\/associate/);

    const statusFor = () => admin.getByRole("row").filter({ hasText: APPLICANT.name }).getByRole("combobox");
    await expect(statusFor()).toHaveValue("Under Review");
    const saved = admin.waitForResponse((r) => r.request().method() === "PUT" && r.url().includes("/api/applications/"));
    await statusFor().selectOption(NEW_STATUS);
    expect((await saved).status()).toBe(200);

    await admin.reload();
    await expect(statusFor()).toHaveValue(NEW_STATUS);
    await adminContext.close();
  });

  await test.step("applicant sees the new status", async () => {
    await page.goto("/");
    await page.getByRole("button", { name: "Apply Now" }).click();
    await expect(page.getByText(`Application Status: ${NEW_STATUS}`)).toBeVisible();
  });
});
