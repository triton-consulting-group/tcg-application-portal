import React from "react";
import { render, screen, fireEvent, waitFor, within, act } from "@testing-library/react";
import { onAuthStateChanged } from "firebase/auth";
import adminApi from "./AdminManagement/api";
import AdminManagementPage from "./AdminManagementPage";

jest.mock("firebase/auth", () => ({ onAuthStateChanged: jest.fn() }));
jest.mock("./Home/firebaseConfig", () => ({ auth: {} }));
jest.mock("react-router-dom", () => ({ Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a> }), { virtual: true });
jest.mock("./AdminManagement/api", () => ({ __esModule: true, default: {
  list: jest.fn(), create: jest.fn(), update: jest.fn(), deactivate: jest.fn(),
} }));

const superAdmin = { email: "super@local.test", name: "Super User", role: "super_admin", isActive: true, permissions: {} };
const regular = { email: "regular@local.test", name: "Regular User", role: "admin", isActive: true,
  permissions: { canChangeStatus: true, canAddComments: true, canDeleteComments: true, canManageAdmins: false, canDragDrop: false } };
const inactive = { ...regular, email: "inactive@local.test", name: "Inactive User", isActive: false };
let authCallback;
let accounts;

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
beforeEach(() => {
  jest.resetAllMocks();
  accounts = [superAdmin, regular, inactive];
  adminApi.list.mockImplementation(async () => accounts);
  adminApi.create.mockResolvedValue({});
  adminApi.update.mockResolvedValue({});
  adminApi.deactivate.mockResolvedValue({});
  onAuthStateChanged.mockImplementation((_auth, callback) => {
    authCallback = callback;
    callback({ email: superAdmin.email });
    return jest.fn();
  });
});

async function openPage() {
  render(<AdminManagementPage />);
  await screen.findByRole("heading", { name: "Admin directory" });
}

test("signed-out visitors see a sign-in link and make no directory request", async () => {
  onAuthStateChanged.mockImplementation((_auth, callback) => { callback(null); return jest.fn(); });
  render(<AdminManagementPage />);
  expect(await screen.findByRole("link", { name: "Sign in with Google" })).toHaveAttribute("href", "/admin-login");
  expect(adminApi.list).not.toHaveBeenCalled();
});

test("search, role/status filters and clearing filters update the directory", async () => {
  await openPage();
  fireEvent.change(screen.getByLabelText("Search admins"), { target: { value: "REGULAR@" } });
  expect(screen.getByRole("button", { name: "Edit regular@local.test" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Edit inactive@local.test" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  fireEvent.change(screen.getByLabelText("Filter by status"), { target: { value: "inactive" } });
  expect(screen.getByRole("button", { name: "Reactivate inactive@local.test" })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Filter by role"), { target: { value: "super_admin" } });
  expect(screen.getByText("No admins match these filters.")).toBeInTheDocument();
});

test("pagination and sorting work without changing the source directory", async () => {
  accounts = [superAdmin, ...Array.from({ length: 11 }, (_, i) => ({ ...regular, email: `person${i}@local.test`, name: `Person ${String(i).padStart(2, '0')}` }))];
  await openPage();
  expect(screen.getAllByRole("row")).toHaveLength(11);
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(screen.getByText("Showing 11–12 of 12 admins")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Sort by"), { target: { value: "email" } });
  expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
  expect(accounts[0]).toBe(superAdmin);
});

test("creating an admin normalizes email, trims name, and prevents repeat submissions", async () => {
  let finish;
  adminApi.create.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  await openPage();
  fireEvent.click(screen.getByRole("button", { name: "Add admin" }));
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: " New User " } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "NEW@LOCAL.TEST" } });
  const form = screen.getByRole("button", { name: "Create admin" }).closest("form");
  fireEvent.submit(form);
  fireEvent.submit(form);
  expect(adminApi.create).toHaveBeenCalledTimes(1);
  expect(adminApi.create).toHaveBeenCalledWith(expect.objectContaining({ email: "new@local.test", name: "New User", role: "admin" }));
  expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  await act(async () => finish({}));
  expect(await screen.findByText("Admin created.")).toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("invalid names and server duplicate errors keep the form open", async () => {
  adminApi.create.mockRejectedValue({ response: { data: { error: "Admin with this email already exists" } } });
  await openPage();
  fireEvent.click(screen.getByRole("button", { name: "Add admin" }));
  const form = screen.getByRole("button", { name: "Create admin" }).closest("form");
  fireEvent.submit(form);
  expect(screen.getByRole("alert")).toHaveTextContent("Name is required");
  expect(adminApi.create).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "New" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "new@local.test" } });
  fireEvent.submit(form);
  expect(await screen.findByText("Admin with this email already exists")).toBeInTheDocument();
  expect(screen.getByLabelText("Name")).toHaveValue("New");
  expect(screen.getByRole("button", { name: "Create admin" })).toBeEnabled();
});

test("editing preserves email and legacy flags and sends only changed permissions", async () => {
  await openPage();
  fireEvent.click(screen.getByRole("button", { name: "Edit regular@local.test" }));
  expect(screen.getByLabelText("Email")).toHaveAttribute("readonly");
  fireEvent.click(screen.getByRole("checkbox", { name: /^Add comments/ }));
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await waitFor(() => expect(adminApi.update).toHaveBeenCalledWith(regular.email, { name: regular.name, permissions: { canAddComments: false } }));
});

test("status changes require confirmation and support reactivation", async () => {
  await openPage();
  fireEvent.click(screen.getByRole("button", { name: "Deactivate regular@local.test" }));
  expect(adminApi.deactivate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(adminApi.deactivate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Reactivate inactive@local.test" }));
  fireEvent.click(screen.getByRole("button", { name: "Reactivate admin" }));
  await waitFor(() => expect(adminApi.update).toHaveBeenCalledWith(inactive.email, { isActive: true }));
  await screen.findByText("inactive@local.test reactivated.");
  fireEvent.click(screen.getByRole("button", { name: "Deactivate regular@local.test" }));
  fireEvent.click(screen.getByRole("button", { name: "Deactivate admin" }));
  await waitFor(() => expect(adminApi.deactivate).toHaveBeenCalledWith(regular.email));
});

test("self-deactivation and self-demotion are unavailable", async () => {
  await openPage();
  expect(screen.queryByRole("button", { name: "Deactivate super@local.test" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Edit super@local.test" }));
  expect(screen.getByLabelText("Role")).toBeDisabled();
});

test("delegated managers cannot edit super admins or grant elevated access", async () => {
  const manager = { ...regular, permissions: { ...regular.permissions, canManageAdmins: true } };
  accounts = [superAdmin, manager, inactive];
  onAuthStateChanged.mockImplementation((_auth, callback) => { callback({ email: manager.email }); return jest.fn(); });
  await openPage();
  expect(screen.queryByRole("button", { name: "Edit super@local.test" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Deactivate super@local.test" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Add admin" }));
  expect(screen.getByLabelText("Role")).toBeDisabled();
  expect(screen.getByRole("checkbox", { name: /^Manage admins/ })).toBeDisabled();
});

test("details are read-only and show existing settings without changing them", async () => {
  await openPage();
  fireEvent.click(screen.getByRole("button", { name: "View regular@local.test" }));
  const dialog = screen.getByRole("dialog", { name: "Admin details" });
  expect(within(dialog).getByLabelText("Name")).toHaveAttribute("readonly");
  expect(within(dialog).queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
  expect(within(dialog).getByText("Existing permission settings")).toBeInTheDocument();
});

test("failed refresh clears sensitive directory data and retry recovers", async () => {
  await openPage();
  adminApi.list.mockRejectedValueOnce({ response: { status: 403, data: { error: "Insufficient permissions" } } });
  fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Insufficient permissions");
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByRole("table")).toBeInTheDocument();
});

test("a late directory response cannot reveal data after sign-out", async () => {
  let finish;
  adminApi.list.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  render(<AdminManagementPage />);
  act(() => authCallback(null));
  await act(async () => finish(accounts));
  expect(screen.getByRole("link", { name: "Sign in with Google" })).toBeInTheDocument();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
});

test("ordinary admins do not see management actions even with an unexpected successful list response", async () => {
  onAuthStateChanged.mockImplementation((_auth, callback) => { callback({ email: regular.email }); return jest.fn(); });
  render(<AdminManagementPage />);
  expect(await screen.findByRole("heading", { name: "Management access required" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Add admin" })).not.toBeInTheDocument();
});
