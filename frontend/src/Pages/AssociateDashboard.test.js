import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import axios from "axios";
import { onAuthStateChanged } from "firebase/auth";
import AssociatePage from "./AssociatePage";

jest.mock("axios", () => ({ __esModule: true, default: {
  get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn(),
} }));
jest.mock("firebase/auth", () => ({ onAuthStateChanged: jest.fn() }));
jest.mock("./Home/firebaseConfig", () => ({ auth: {} }));
jest.mock("../config/adminAuth", () => ({ getAdminAuthHeaders: async () => ({ Authorization: "Bearer test-token" }) }));

const headers = { Authorization: "Bearer test-token" };
const applicant = (id, overrides = {}) => ({
  _id: String(id), fullName: `Applicant ${id}`, email: `applicant${id}@local.test`,
  studentYear: "Sophomore", major: "Economics", appliedBefore: "No",
  candidateType: "Tech", reason: "Interested in consulting", status: "Under Review",
  comments: [], ...overrides,
});
let applications;
let admin;

beforeEach(() => {
  jest.resetAllMocks();
  applications = [applicant(1), applicant(2, { candidateType: "Non-Tech" })];
  admin = { name: "Reviewer", role: "admin", permissions: {
    canChangeStatus: true, canAddComments: true, canDeleteComments: true,
  } };
  onAuthStateChanged.mockImplementation((_auth, callback) => {
    callback({ email: "reviewer@local.test" });
    return jest.fn();
  });
  axios.get.mockImplementation(async (url) => {
    if (url.endsWith("/applications/all")) return { data: applications };
    if (url.includes("/file-url/")) return { data: { url: "https://example.test/signed-file" } };
    if (url.includes("export")) return { data: "name,status\nApplicant,Under Review" };
    return { data: { slots: { "1": "Friday evening" } } };
  });
  axios.post.mockImplementation(async (url) => {
    if (url.endsWith("/admin/check")) return { data: { isAdmin: true, admin } };
    return { data: { comment: { _id: "comment-1", comment: "Strong candidate", adminName: "Reviewer", commentedAt: "2026-01-01" } } };
  });
  axios.put.mockImplementation(async (_url, data) => ({ data: { ...applications[0], ...data } }));
  axios.delete.mockResolvedValue({ data: {} });
  jest.spyOn(window, "alert").mockImplementation(() => {});
  jest.spyOn(window, "confirm").mockReturnValue(true);
  jest.spyOn(window, "open").mockImplementation(() => {});
  jest.spyOn(window, "scrollTo").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
  window.URL.createObjectURL = jest.fn(() => "blob:test-export");
  window.URL.revokeObjectURL = jest.fn();
  jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

async function openDashboard() {
  render(<AssociatePage />);
  await screen.findByRole("heading", { name: "Triton Consulting Group - Associate Portal" });
}

function phaseColumn(name) {
  return screen.getByRole("heading", { name }).closest("[data-phase-color]");
}

test("authentication still gates the dashboard and protects application requests", async () => {
  onAuthStateChanged.mockImplementation((_auth, callback) => { callback(null); return jest.fn(); });
  render(<AssociatePage />);
  expect(await screen.findByText("Access denied. Admin privileges required.")).toBeInTheDocument();
  expect(axios.post).not.toHaveBeenCalled();
  expect(axios.get.mock.calls.some(([url]) => url.endsWith("/applications/all"))).toBe(false);
});

test("table pagination and search retain their results and reset to page one", async () => {
  applications = Array.from({ length: 31 }, (_, i) => applicant(i + 1));
  await openDashboard();
  expect(screen.getAllByRole("row")).toHaveLength(31);
  fireEvent.click(screen.getByRole("button", { name: "Next", exact: true }));
  expect(screen.getByText("Applicant 31")).toBeInTheDocument();
  expect(screen.queryByText("Applicant 1")).not.toBeInTheDocument();
  fireEvent.change(screen.getByPlaceholderText("Search by name, major, or email..."), { target: { value: "applicant1@" } });
  expect(screen.getByText("Applicant 1")).toBeInTheDocument();
  expect(screen.getByText("Showing 1 to 1 of 1 applications")).toBeInTheDocument();
  expect(axios.get).toHaveBeenCalledWith(expect.stringMatching(/\/applications\/all$/), { headers });
});

test("details open and close, use slot labels, and update status through the parent", async () => {
  applications = [applicant(1, { caseNightPreferences: ["1"] })];
  await openDashboard();
  fireEvent.click(screen.getByRole("button", { name: "View Application" }));
  expect(screen.getByRole("heading", { name: "Applicant 1's Application" })).toBeInTheDocument();
  expect(screen.getByText("Friday evening")).toBeInTheDocument();
  const modal = screen.getByRole("heading", { name: "Applicant 1's Application" }).closest(".modal-content");
  fireEvent.change(within(modal).getByRole("combobox"), { target: { value: "Accepted" } });
  await waitFor(() => expect(axios.put).toHaveBeenCalledWith(expect.stringMatching(/\/applications\/1$/), { status: "Accepted", notes: "" }, { headers }));
  await waitFor(() => expect(screen.getAllByRole("combobox")[0]).toHaveValue("Accepted"));
  fireEvent.click(within(modal).getByRole("button", { name: "×" }));
  expect(screen.queryByRole("heading", { name: "Applicant 1's Application" })).not.toBeInTheDocument();
});

test("table file links request a signed URL without opening details", async () => {
  applications = [applicant(1, { resume: "resumes/example file.pdf" })];
  await openDashboard();
  fireEvent.click(screen.getByRole("button", { name: "View Resume" }));
  await waitFor(() => expect(window.open).toHaveBeenCalledWith("https://example.test/signed-file", "_blank"));
  expect(axios.get).toHaveBeenCalledWith(expect.stringContaining("/file-url/resumes%2Fexample%20file.pdf"), { headers });
  expect(screen.queryByRole("heading", { name: "Applicant 1's Application" })).not.toBeInTheDocument();
});

test("adding and deleting comments keeps the phase badge and details in sync", async () => {
  applications = [applicant(1)];
  await openDashboard();
  fireEvent.click(screen.getByRole("button", { name: "Application Phases" }));
  fireEvent.click(screen.getByRole("button", { name: "View", exact: true }));
  fireEvent.change(screen.getByPlaceholderText("Add a comment about this applicant..."), { target: { value: "Strong candidate" } });
  fireEvent.click(screen.getByRole("button", { name: "Add Comment" }));
  expect(await screen.findByText("Strong candidate")).toBeInTheDocument();
  expect(await screen.findByLabelText("Has 1 admin comment(s)")).toBeInTheDocument();
  expect(axios.post).toHaveBeenCalledWith(expect.stringMatching(/\/applications\/1\/comment$/), { comment: "Strong candidate" }, { headers });
  fireEvent.click(screen.getByRole("button", { name: "Delete comment by Reviewer" }));
  await waitFor(() => expect(screen.queryByText("Strong candidate")).not.toBeInTheDocument());
  await waitFor(() => expect(screen.queryByLabelText("Has 1 admin comment(s)")).not.toBeInTheDocument());
  expect(axios.delete).toHaveBeenCalledWith(expect.stringMatching(/\/applications\/1\/comments\/comment-1$/), { headers });
});

test("phase filtering and switching category groups retain the existing columns", async () => {
  await openDashboard();
  fireEvent.click(screen.getByRole("button", { name: "Application Phases" }));
  expect(screen.getByRole("heading", { name: "Under Review (2)" })).toBeInTheDocument();
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "tech" } });
  expect(screen.getByText("Applicant 1")).toBeInTheDocument();
  expect(screen.queryByText("Applicant 2")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Next View/ }));
  expect(screen.getByRole("heading", { name: "Accepted (0)" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Back to First View/ }));
  expect(screen.getByRole("heading", { name: "Under Review (1)" })).toBeInTheDocument();
});

test("phase pagination displays the next ten-applicant page", async () => {
  applications = Array.from({ length: 11 }, (_, i) => applicant(i + 1));
  await openDashboard();
  fireEvent.click(screen.getByRole("button", { name: "Application Phases" }));
  expect(screen.queryByText("Applicant 11")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Next →" }));
  expect(screen.getByText("Applicant 11")).toBeInTheDocument();
  expect(screen.queryByText("Applicant 1")).not.toBeInTheDocument();
});

test("dragging to a phase updates the API and the table's shared application state", async () => {
  applications = [applicant(1)];
  await openDashboard();
  fireEvent.click(screen.getByRole("button", { name: "Application Phases" }));
  const dataTransfer = { getData: (key) => key === "applicationId" ? "1" : "Under Review" };
  fireEvent.drop(phaseColumn("Case Night-Yes (0)"), { dataTransfer });
  await screen.findByRole("heading", { name: "Case Night-Yes (1)" });
  expect(axios.put).toHaveBeenCalledWith(expect.stringMatching(/\/applications\/1$/), {
    status: "Case Night - Yes", notes: "Moved from Under Review to Case Night - Yes via drag and drop",
  }, { headers });
  fireEvent.click(screen.getByRole("button", { name: "All Applications" }));
  expect(screen.getByRole("combobox")).toHaveValue("Case Night - Yes");
});

test("exports retain CSV request options and release download URLs", async () => {
  await openDashboard();
  fireEvent.click(screen.getByRole("button", { name: "Export Case Groups" }));
  await waitFor(() => expect(window.URL.revokeObjectURL).toHaveBeenCalledTimes(1));
  expect(axios.get).toHaveBeenCalledWith(expect.stringMatching(/\/case-groups\/export$/), { responseType: "blob", headers });
  fireEvent.click(screen.getByRole("button", { name: "Application Phases" }));
  fireEvent.click(within(phaseColumn("Under Review (2)")).getByRole("button", { name: "Export" }));
  await waitFor(() => expect(window.URL.revokeObjectURL).toHaveBeenCalledTimes(2));
  expect(axios.get).toHaveBeenCalledWith(expect.stringMatching(/\/applications\/export-by-status$/), { params: { statuses: "Under Review" }, responseType: "blob", headers });
});

test("read-only reviewers cannot edit statuses, add/delete comments, or drag cards", async () => {
  admin.permissions = {};
  applications = [applicant(1, { comments: [{ _id: "c1", comment: "Existing", adminName: "Reviewer", commentedAt: "2026-01-01" }] })];
  await openDashboard();
  expect(screen.getByRole("combobox")).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "View Application" }));
  expect(screen.getByRole("button", { name: "No Permission" })).toBeDisabled();
  expect(screen.queryByRole("button", { name: /Delete comment/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "×" }));
  fireEvent.click(screen.getByRole("button", { name: "Application Phases" }));
  expect(document.querySelector('[draggable="true"]')).not.toBeInTheDocument();
  fireEvent.drop(phaseColumn("Case Night-Yes (0)"), { dataTransfer: { getData: () => "1" } });
  expect(axios.put).not.toHaveBeenCalled();
});

test("failed status changes preserve the table and show the server error", async () => {
  applications = [applicant(1)];
  axios.put.mockRejectedValue({ response: { data: { error: "Status update denied" } } });
  await openDashboard();
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "Accepted" } });
  await waitFor(() => expect(window.alert).toHaveBeenCalledWith("❌ Failed to update status: Status update denied"));
  expect(screen.getByRole("combobox")).toHaveValue("Under Review");
});
