import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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

const config = { slots: { A: "6:00 PM – 7:00 PM" } };
const assignment = { _id: "as1", candidateType: "Tech", timeSlot: "A", groupNumber: 1, groupId: "Tech-A-1", applicantName: "Bo" };
const waiting = { _id: "app1", fullName: "Ada", candidateType: "Tech", caseNightPreferences: ["B"] };

const mockLoad = () =>
  axios.get.mockImplementation(async (url) => ({ data: url.endsWith("/assignments") ? [assignment] : [waiting] }));

beforeEach(() => {
  jest.resetAllMocks();
  mockLoad();
});

test("shows groups and unassigned applicants", async () => {
  render(<CaseGroupsModal caseNightConfig={config} onClose={jest.fn()} />);
  expect(await screen.findByText("Tech-A-1 (1 person)", { selector: "strong" })).toBeInTheDocument();
  expect(screen.getByText(/Ada \(Tech; available: B\)/)).toBeInTheDocument();
});

test("adding asks about warnings, then resends with confirmWarnings", async () => {
  window.confirm = jest.fn(() => true);
  axios.mockRejectedValueOnce({
    response: { status: 409, data: { warnings: [{ code: "slot-unavailable", message: "Ada didn't mark 6:00 PM – 7:00 PM as available." }] } }
  }).mockResolvedValueOnce({ data: { groupId: "Tech-A-1" } });

  render(<CaseGroupsModal caseNightConfig={config} onClose={jest.fn()} />);
  fireEvent.change(await screen.findByLabelText("Group for Ada"), { target: { value: "Tech|A|1" } });
  fireEvent.click(screen.getByText("Add"));

  await waitFor(() => expect(axios).toHaveBeenCalledTimes(2));
  expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("didn't mark 6:00 PM – 7:00 PM"));
  expect(axios.mock.calls[1][0]).toMatchObject({
    method: "post",
    data: { applicationId: "app1", track: "Tech", slot: "A", groupNumber: 1, confirmWarnings: true }
  });
});

test("declining the warning sends nothing more", async () => {
  window.confirm = jest.fn(() => false);
  axios.mockRejectedValueOnce({ response: { status: 409, data: { warnings: [{ code: "x", message: "careful" }] } } });
  render(<CaseGroupsModal caseNightConfig={config} onClose={jest.fn()} />);
  fireEvent.change(await screen.findByLabelText("Group for Ada"), { target: { value: "Tech|A|new" } });
  fireEvent.click(screen.getByText("Add"));
  await waitFor(() => expect(window.confirm).toHaveBeenCalled());
  expect(axios).toHaveBeenCalledTimes(1);
});

test("moving picks the chosen group; removing asks first", async () => {
  window.confirm = jest.fn(() => true);
  axios.mockResolvedValue({ data: {} });
  render(<CaseGroupsModal caseNightConfig={config} onClose={jest.fn()} />);

  fireEvent.change(await screen.findByLabelText("Move Bo"), { target: { value: "Tech|A|new" } });
  await waitFor(() =>
    expect(axios).toHaveBeenCalledWith(expect.objectContaining({ method: "patch", data: { track: "Tech", slot: "A", groupNumber: "new" } }))
  );

  fireEvent.click(await screen.findByText("Remove"));
  await waitFor(() => expect(axios).toHaveBeenCalledWith(expect.objectContaining({ method: "delete" })));
  expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("Take Bo out of Tech-A-1?"));
});

test("a server error is shown", async () => {
  axios.mockRejectedValueOnce({ response: { status: 409, data: { error: "Ada is already in Tech-B-2." } } });
  render(<CaseGroupsModal caseNightConfig={config} onClose={jest.fn()} />);
  fireEvent.change(await screen.findByLabelText("Group for Ada"), { target: { value: "Tech|A|1" } });
  fireEvent.click(screen.getByText("Add"));
  expect(await screen.findByText("Ada is already in Tech-B-2.")).toBeInTheDocument();
});
