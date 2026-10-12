import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import axios from "axios";
import CaseGroupsModal from "./CaseGroupsModal";

// CRA's Jest can't load axios's ES module build, so replace it entirely
jest.mock("axios", () => {
  const axios = jest.fn();
  axios.get = jest.fn();
  axios.post = jest.fn();
  return { __esModule: true, default: axios };
});
jest.mock("../../config/adminAuth", () => ({ getAdminAuthHeaders: async () => ({ Authorization: "Bearer t" }) }));

const config = { slots: { A: "6:00 PM – 7:00 PM", B: "7:00 PM – 8:00 PM" } };
const assignment = (id, name, track, slot, groupNumber, prefs = ["A", "B"]) => ({
  _id: id,
  applicantName: name,
  candidateType: track,
  timeSlot: slot,
  groupNumber,
  groupId: `${track}-${slot}-${groupNumber}`,
  emailSent: false,
  applicationId: { _id: `app-${id}`, candidateType: track, caseNightPreferences: prefs }
});
const assignments = [
  assignment("as1", "Bo", "Tech", "A", 1),
  assignment("as2", "Cy", "Tech", "A", 1),
  assignment("as3", "Di", "Tech", "A", 1),
  assignment("as4", "Eve", "Tech", "B", 1, ["A"]),
  assignment("as5", "Nora", "Non-Tech", "A", 1)
];
const waiting = [{ _id: "app-ada", fullName: "Ada", candidateType: "Tech", caseNightPreferences: ["B"] }];

const mockLoad = () =>
  axios.get.mockImplementation(async (url) => ({ data: url.endsWith("/assignments") ? assignments : waiting }));

const renderModal = async () => {
  render(<CaseGroupsModal caseNightConfig={config} onClose={jest.fn()} />);
  fireEvent.click(await screen.findByRole("tab", { name: /^Tech/ }));
};
const group = (name) => screen.getByRole("button", { name });
const lastRequest = () => axios.mock.calls[axios.mock.calls.length - 1][0];

beforeEach(() => {
  jest.resetAllMocks();
  mockLoad();
  axios.mockResolvedValue({ data: {} });
});

test("shows tabs with counts, a column per slot, group sizes and the unassigned tray", async () => {
  await renderModal();
  expect(screen.getByRole("tab", { name: "Tech · 5" })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "Non-Tech · 1" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: /6:00 PM – 7:00 PM/ })).toBeInTheDocument();
  expect(within(group("Group 1 at 6:00 PM – 7:00 PM, 3 people")).getByText("Bo")).toBeInTheDocument();
  expect(within(screen.getByRole("region", { name: "Unassigned" })).getByText("Ada")).toBeInTheDocument();
});

test("flags someone placed in a slot they didn't pick", async () => {
  await renderModal();
  expect(screen.getByText("Eve")).toHaveAttribute("title", expect.stringContaining("Didn't pick 7:00 PM – 8:00 PM"));
});

test("click a person, then a group, moves them", async () => {
  await renderModal();
  fireEvent.click(screen.getByText("Bo"));
  expect(screen.getByText(/Moving Bo/)).toBeInTheDocument();
  fireEvent.click(group("Group 1 at 7:00 PM – 8:00 PM, 1 person"));
  await waitFor(() =>
    expect(lastRequest()).toMatchObject({
      method: "patch",
      url: expect.stringMatching(/\/assignments\/as1$/),
      data: { track: "Tech", slot: "B", groupNumber: 1 }
    })
  );
});

test("an unassigned person can be added to a new group", async () => {
  await renderModal();
  fireEvent.click(screen.getByText("Ada"));
  fireEvent.click(group("New group at 7:00 PM – 8:00 PM"));
  await waitFor(() =>
    expect(lastRequest()).toMatchObject({
      method: "post",
      data: { applicationId: "app-ada", track: "Tech", slot: "B", groupNumber: "new" }
    })
  );
});

test("warnings appear in a bar; Move anyway resends with confirmWarnings", async () => {
  axios.mockRejectedValueOnce({
    response: { status: 409, data: { warnings: [{ code: "small-group", message: "This leaves Tech-A-1 with 2 members." }] } }
  });
  await renderModal();
  fireEvent.click(screen.getByText("Bo"));
  fireEvent.click(group("Group 1 at 7:00 PM – 8:00 PM, 1 person"));

  const bar = await screen.findByRole("alert");
  expect(bar).toHaveTextContent("This leaves Tech-A-1 with 2 members.");
  fireEvent.click(within(bar).getByText("Move anyway"));
  await waitFor(() => expect(lastRequest().data).toEqual({ track: "Tech", slot: "B", groupNumber: 1, confirmWarnings: true }));
});

test("Cancel on the warning bar sends nothing more", async () => {
  axios.mockRejectedValueOnce({ response: { status: 409, data: { warnings: [{ code: "x", message: "careful" }] } } });
  await renderModal();
  fireEvent.click(screen.getByText("Bo"));
  fireEvent.click(group("Group 1 at 7:00 PM – 8:00 PM, 1 person"));
  fireEvent.click(within(await screen.findByRole("alert")).getByText("Cancel"));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(axios).toHaveBeenCalledTimes(1);
});

test("dragging a person onto the tray takes them out of their group", async () => {
  await renderModal();
  fireEvent.dragStart(screen.getByText("Cy"), { dataTransfer: { setData: jest.fn() } });
  fireEvent.drop(screen.getByRole("region", { name: "Unassigned" }));
  await waitFor(() => expect(lastRequest()).toMatchObject({ method: "delete", url: expect.stringMatching(/\/assignments\/as2$/) }));
});

test("Esc cancels moving", async () => {
  await renderModal();
  fireEvent.click(screen.getByText("Bo"));
  expect(screen.getByRole("button", { name: "New group at 7:00 PM – 8:00 PM" })).toBeInTheDocument();
  fireEvent.keyDown(window, { key: "Escape" });
  expect(screen.queryByRole("button", { name: "New group at 7:00 PM – 8:00 PM" })).not.toBeInTheDocument();
});

test("search switches to the right track and counts matches", async () => {
  await renderModal();
  fireEvent.change(screen.getByLabelText("Search by name"), { target: { value: "nor" } });
  expect(screen.getByText("1 match")).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: /^Non-Tech/ })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByText("Nora")).toHaveAttribute("data-match", "true");
});

test("a server error is shown", async () => {
  axios.mockRejectedValueOnce({ response: { status: 409, data: { error: "Ada is already in Tech-B-2." } } });
  await renderModal();
  fireEvent.click(screen.getByText("Ada"));
  fireEvent.click(group("Group 1 at 7:00 PM – 8:00 PM, 1 person"));
  expect(await screen.findByText("Ada is already in Tech-B-2.")).toBeInTheDocument();
});

test("while searching you can still switch tabs yourself", async () => {
  await renderModal();
  fireEvent.change(screen.getByLabelText("Search by name"), { target: { value: "nor" } });
  fireEvent.click(screen.getByRole("tab", { name: /^Tech/ }));
  expect(screen.getByRole("tab", { name: /^Tech/ })).toHaveAttribute("aria-selected", "true");
});
