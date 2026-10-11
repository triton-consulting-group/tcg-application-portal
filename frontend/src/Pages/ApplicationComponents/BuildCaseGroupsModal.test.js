import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import axios from "axios";
import BuildCaseGroupsModal from "./BuildCaseGroupsModal";

// CRA's Jest can't load axios's ES module build, so replace it entirely
jest.mock("axios", () => {
  const axios = jest.fn();
  axios.get = jest.fn();
  axios.post = jest.fn();
  return { __esModule: true, default: axios };
});
jest.mock("../../config/adminAuth", () => ({ getAdminAuthHeaders: async () => ({ Authorization: "Bearer t" }) }));

const slots = (count) => ({
  A: {
    label: "6:00 PM – 7:00 PM",
    count,
    groups: count ? [{ groupNumber: 1, groupId: "Tech-A-1", members: [{ applicationId: "1", fullName: "Ada" }] }] : []
  }
});
const preview = (fingerprint, existing = { count: 0, emailsSent: 0, handEditsSinceBuild: 0 }) => ({
  data: {
    fingerprint,
    existing,
    plan: {
      summary: { eligible: 5, placed: 4, excluded: 1 },
      excluded: [{ applicationId: "9", fullName: "Zed", email: "z@ucsd.edu", reason: "No track" }],
      tracks: {
        "Non-Tech": { placed: 0, groupsOf4: 0, groupsOf3: 0, slots: slots(0) },
        Tech: { placed: 4, groupsOf4: 1, groupsOf3: 0, slots: slots(4) }
      }
    }
  }
});

beforeEach(() => jest.resetAllMocks());

test("shows the preview, existing-assignment warning and who wasn't placed", async () => {
  axios.post.mockResolvedValueOnce(preview("fp1", { count: 12, emailsSent: 3, handEditsSinceBuild: 2 }));
  render(<BuildCaseGroupsModal onClose={jest.fn()} onBuilt={jest.fn()} />);
  expect(await screen.findByText(/4 placed/)).toBeInTheDocument();
  expect(screen.getByText(/replaces the 12 current assignments/)).toBeInTheDocument();
  expect(screen.getByText(/3 of them were already emailed/)).toBeInTheDocument();
  expect(screen.getByText(/2 hand edits since the last build/)).toBeInTheDocument();
  expect(screen.getByText(/Zed \(z@ucsd.edu\): No track/)).toBeInTheDocument();
});

test("confirm builds with the preview's fingerprint", async () => {
  const onBuilt = jest.fn();
  axios.post.mockResolvedValueOnce(preview("fp1")).mockResolvedValueOnce({ data: { created: 4 } });
  render(<BuildCaseGroupsModal onClose={jest.fn()} onBuilt={onBuilt} />);
  await screen.findByText(/4 placed/); // wait for the preview; the button is disabled until then
  fireEvent.click(screen.getByText("Confirm and build"));
  await waitFor(() => expect(onBuilt).toHaveBeenCalledWith(4));
  expect(axios.post).toHaveBeenLastCalledWith(expect.stringMatching(/\/api\/case-groups\/build$/), { fingerprint: "fp1" }, expect.anything());
});

test("a stale preview is reloaded instead of built", async () => {
  const onBuilt = jest.fn();
  axios.post
    .mockResolvedValueOnce(preview("fp1"))
    .mockRejectedValueOnce({ response: { status: 409, data: { error: "changed" } } })
    .mockResolvedValueOnce(preview("fp2"));
  render(<BuildCaseGroupsModal onClose={jest.fn()} onBuilt={onBuilt} />);
  await screen.findByText(/4 placed/); // wait for the preview; the button is disabled until then
  fireEvent.click(screen.getByText("Confirm and build"));
  expect(await screen.findByText(/Applicants changed since this preview/)).toBeInTheDocument();
  expect(axios.post).toHaveBeenCalledTimes(3);
  expect(onBuilt).not.toHaveBeenCalled();
});
