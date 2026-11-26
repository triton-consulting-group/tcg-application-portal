import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import PortalSettingsPage from "./PortalSettingsPage";
import { readSettings, saveSettings } from "./api";
import { signInWithPopup } from "firebase/auth";
let mockAuth;
jest.mock("firebase/auth", () => ({ signInWithPopup: jest.fn(), onAuthStateChanged: (auth, callback) => { mockAuth = callback; callback({ email: "super@local.test" }); return jest.fn(); } }));
jest.mock("../Home/firebaseConfig", () => ({ auth: {}, provider: {}, getSignInErrorMessage: error => error.message }));
jest.mock("react-router-dom", () => ({ Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a> }), { virtual: true });
jest.mock("./api", () => ({ readSettings: jest.fn(), saveSettings: jest.fn() }));
const values = {
  cycleName: "Fall 2026", window: { isActive: true, applicationStart: "2026-10-08T23:59:00-07:00", applicationDeadline: "2026-10-10T23:59:00-07:00", preStartMessage: "Not open", message: "Closed" },
  caseNight: { date: "October 15", groupSize: 4, slots: { A: "6–7 PM" }, maxGroupsPerSlot: { A: 50 } },
  wording: { reason: "Why join?" }
};
beforeEach(() => {
  jest.clearAllMocks(); readSettings.mockResolvedValue({ revision: 3, values });
  window.confirm = jest.fn(() => true);
});
test("loads saved values and previews wording as plain text", async () => {
  render(<PortalSettingsPage />);
  const input = await screen.findByLabelText("Cycle display name");
  fireEvent.change(input, { target: { value: "<script>example</script>" } });
  fireEvent.click(screen.getByText("Show wording preview"));
  expect(screen.getByRole("heading", { name: "APPLICATION - <script>example</script>" })).toBeInTheDocument();
});
test("saves with the loaded revision and updates saved state", async () => {
  saveSettings.mockResolvedValue({ revision: 4, values: { ...values, cycleName: "Winter" } });
  render(<PortalSettingsPage />);
  fireEvent.change(await screen.findByLabelText("Cycle display name"), { target: { value: "Winter" } });
  fireEvent.click(screen.getByText("Save and publish"));
  await screen.findByText("Settings published.");
  expect(saveSettings).toHaveBeenCalledWith({ revision: 3, values: { ...values, cycleName: "Winter" } });
  expect(screen.getByText("Save and publish")).toBeDisabled();
});
test("stale-save conflict preserves edits for review", async () => {
  saveSettings.mockRejectedValue({ response: { status: 409, data: { error: "Settings changed. Reload." } } });
  render(<PortalSettingsPage />);
  fireEvent.change(await screen.findByLabelText("Cycle display name"), { target: { value: "Winter" } });
  fireEvent.click(screen.getByText("Save and publish"));
  expect(await screen.findByRole("alert")).toHaveTextContent("Settings changed. Reload.");
  expect(screen.getByLabelText("Cycle display name")).toHaveValue("Winter");
});
test("cancel restores values without writing", async () => {
  render(<PortalSettingsPage />);
  fireEvent.change(await screen.findByLabelText("Cycle display name"), { target: { value: "Winter" } });
  fireEvent.click(screen.getByText("Cancel changes"));
  expect(screen.getByLabelText("Cycle display name")).toHaveValue("Fall 2026");
  expect(saveSettings).not.toHaveBeenCalled();
});

test("slot capacity can be cleared and retyped, but cannot be saved blank", async () => {
  render(<PortalSettingsPage />);
  const input = await screen.findByLabelText("Maximum groups for slot A");
  fireEvent.change(input, { target: { value: "" } });
  expect(input).toHaveValue(null);
  expect(input).toBeInvalid();
  fireEvent.click(screen.getByText("Save and publish"));
  expect(saveSettings).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: "25" } });
  expect(input).toHaveValue(25);
  expect(input).toBeValid();
  const updated = { ...values, caseNight: { ...values.caseNight, maxGroupsPerSlot: { A: 25 } } };
  saveSettings.mockResolvedValue({ revision: 4, values: updated });
  fireEvent.click(screen.getByText("Save and publish"));
  await screen.findByText("Settings published.");
  expect(saveSettings).toHaveBeenCalledWith({ revision: 3, values: updated });
});
test("denied access exposes no editable form", async () => {
  readSettings.mockRejectedValue({ response: { data: { error: "Only super admins can manage portal settings." } } });
  render(<PortalSettingsPage />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Only super admins");
  expect(screen.queryByText("Save and publish")).not.toBeInTheDocument();
});
test("sign-out invalidates a pending settings response", async () => {
  let resolve; readSettings.mockReturnValue(new Promise(done => { resolve = done; }));
  render(<PortalSettingsPage />);
  act(() => mockAuth(null));
  await act(async () => resolve({ revision: 3, values }));
  await waitFor(() => expect(screen.getByText("Sign in with Google")).toBeInTheDocument());
  expect(screen.queryByLabelText("Cycle display name")).not.toBeInTheDocument();
});

test("sign-in button opens Google authentication and displays failures", async () => {
  signInWithPopup.mockRejectedValue(new Error("Popup blocked"));
  render(<PortalSettingsPage />);
  await screen.findByLabelText("Cycle display name");
  act(() => mockAuth(null));
  fireEvent.click(screen.getByRole("button", { name: "Sign in with Google" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Popup blocked");
  expect(signInWithPopup).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: "Sign in with Google" })).toBeEnabled();
});
