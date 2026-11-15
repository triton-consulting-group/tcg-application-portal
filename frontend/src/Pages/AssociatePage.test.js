import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import axios from "axios";
import { onAuthStateChanged, signInWithPopup } from "firebase/auth";
import { auth, provider } from "./Home/firebaseConfig";
import AssociatePage from "./AssociatePage";

jest.mock("axios", () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));
jest.mock("firebase/auth", () => ({ onAuthStateChanged: jest.fn(), signInWithPopup: jest.fn() }));
jest.mock("./Home/firebaseConfig", () => ({ auth: {}, provider: {}, getSignInErrorMessage: (error) => error.message }));
jest.mock("../config/adminAuth", () => ({ getAdminAuthHeaders: async () => ({ Authorization: "Bearer test-token" }) }));

beforeEach(() => {
  jest.resetAllMocks();
  axios.get.mockImplementation(async (url) => ({ data: url.endsWith("/case-night-config") ? { slots: {} } : [] }));
});

function renderAs(user) {
  onAuthStateChanged.mockImplementation((_auth, callback) => {
    callback(user);
    return jest.fn();
  });
  render(<AssociatePage />);
}

async function expectAccessPage() {
  expect(await screen.findByRole("heading", { name: "Associate Login" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Sign in with Google" })).toBeEnabled();
  expect(screen.getByRole("link", { name: "Return to home" })).toHaveAttribute("href", "/");
  expect(axios.get.mock.calls.some(([url]) => url.endsWith("/applications/all"))).toBe(false);
}

test("signed-out visitors get an access page with a Google sign-in button", async () => {
  renderAs(null);
  await expectAccessPage();
  expect(axios.post).not.toHaveBeenCalled();
});

test("a non-admin response shows the access page", async () => {
  axios.post.mockResolvedValue({ data: { isAdmin: false } });
  renderAs({ email: "applicant@local.test" });
  await expectAccessPage();
});

test("the backend's non-admin rejection also shows the access page", async () => {
  const log = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    axios.post.mockRejectedValue({ response: { status: 404 } });
    renderAs({ email: "applicant@local.test" });
    await expectAccessPage();
  } finally { log.mockRestore(); }
});

test("authorized admins still reach the dashboard", async () => {
  axios.post.mockResolvedValue({ data: { isAdmin: true, admin: { name: "Test Admin", role: "admin", permissions: {} } } });
  renderAs({ email: "admin@local.test" });
  expect(await screen.findByRole("heading", { name: "Triton Consulting Group - Associate Portal" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Associate Login" })).not.toBeInTheDocument();
  expect(axios.get).toHaveBeenCalledWith(expect.stringMatching(/\/applications\/all$/), { headers: { Authorization: "Bearer test-token" } });
});

test("an authorized admin's data-loading error remains visible", async () => {
  const log = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    axios.post.mockResolvedValue({ data: { isAdmin: true, admin: { role: "admin", permissions: {} } } });
    axios.get.mockImplementation(async (url) => {
      if (url.endsWith("/applications/all")) throw new Error("Backend unavailable");
      return { data: { slots: {} } };
    });
    renderAs({ email: "admin@local.test" });
    expect(await screen.findByText("Failed to fetch applications.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign in with Google" })).not.toBeInTheDocument();
  } finally { log.mockRestore(); }
});

test("opens Google sign-in directly and prevents repeat clicks while pending", async () => {
  let finish;
  signInWithPopup.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
  renderAs(null);
  fireEvent.click(await screen.findByRole("button", { name: "Sign in with Google" }));
  expect(signInWithPopup).toHaveBeenCalledWith(auth, provider);
  const pending = screen.getByRole("button", { name: "Signing in..." });
  expect(pending).toBeDisabled();
  fireEvent.click(pending);
  expect(signInWithPopup).toHaveBeenCalledTimes(1);
  await act(async () => finish({}));
});

test("a failed popup shows an error and allows retry", async () => {
  signInWithPopup.mockRejectedValue(new Error("Popup blocked"));
  renderAs(null);
  fireEvent.click(await screen.findByRole("button", { name: "Sign in with Google" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Popup blocked");
  expect(screen.getByRole("button", { name: "Sign in with Google" })).toBeEnabled();
  expect(axios.post).not.toHaveBeenCalled();
});

test("switching from a denied account to an authorized account clears the old error", async () => {
  axios.post.mockResolvedValueOnce({ data: { isAdmin: false } });
  renderAs({ email: "applicant@local.test" });
  await expectAccessPage();
  axios.post.mockResolvedValueOnce({ data: { isAdmin: true, admin: { name: "Test Admin", role: "admin", permissions: {} } } });
  signInWithPopup.mockImplementation(async () => {
    const user = { email: "admin@local.test" };
    onAuthStateChanged.mock.calls[0][1](user);
    return { user };
  });
  fireEvent.click(screen.getByRole("button", { name: "Sign in with Google" }));
  expect(await screen.findByRole("heading", { name: "Triton Consulting Group - Associate Portal" })).toBeInTheDocument();
  expect(axios.post).toHaveBeenLastCalledWith(expect.stringMatching(/\/admin\/check$/), { email: "admin@local.test" }, { headers: { Authorization: "Bearer test-token" } });
});
