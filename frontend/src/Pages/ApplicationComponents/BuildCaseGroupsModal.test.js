import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
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
    groups: count ? [{ groupNumber: 1, groupId: "Tech-A-1", members: [{ applicationId: "1", fullName: "Ada", studentYear: "3rd" }] }] : []
  }
});
const preview = (fingerprint, existing = { count: 0, emailsSent: 0, handEditsSinceBuild: 0 }) => ({
  data: {
    fingerprint,
    existing,
    plan: {
      summary: { eligible: 5, placed: 4, excluded: 1, mixedYearGroups: 1 },
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
  const tray = screen.getByRole("region", { name: "Not placed" });
  expect(within(tray).getByText("Zed")).toBeInTheDocument();
  expect(within(tray).getByText("No track")).toBeInTheDocument();
});

test("the preview shows the proposed groups on the same board, read-only, opening the busiest track", async () => {
  axios.post.mockResolvedValueOnce(preview("fp1"));
  render(<BuildCaseGroupsModal onClose={jest.fn()} onBuilt={jest.fn()} />);
  const card = await screen.findByRole("group", { name: "Group 1 at 6:00 PM – 7:00 PM, 1 person" });
  expect(within(card).getByText("Ada")).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "Tech · 2" })).toHaveAttribute("aria-selected", "true");
  fireEvent.click(screen.getByText("Ada"));
  expect(screen.queryByText(/Moving Ada/)).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /New group/ })).not.toBeInTheDocument();
});

test("confirm builds with the preview's fingerprint", async () => {
  const onBuilt = jest.fn();
  axios.post.mockResolvedValueOnce(preview("fp1")).mockResolvedValueOnce({ data: { created: 4 } });
  render(<BuildCaseGroupsModal onClose={jest.fn()} onBuilt={onBuilt} />);
  await screen.findByText(/4 placed/); // wait for the preview; the button is disabled until then
  fireEvent.click(screen.getByText("Confirm and build"));
  await waitFor(() => expect(onBuilt).toHaveBeenCalledWith(4));
  expect(axios.post).toHaveBeenLastCalledWith(expect.stringMatching(/\/api\/case-groups\/build$/), { fingerprint: "fp1", groupByYear: true }, expect.anything());
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

describe("keep years together", () => {
  const box = () => screen.getByRole("checkbox", { name: "Keep years together in each time slot" });

  test("is on by default, is sent with the preview, and the summary counts mixed groups", async () => {
    axios.post.mockResolvedValueOnce(preview("fp1"));
    render(<BuildCaseGroupsModal onClose={jest.fn()} onBuilt={jest.fn()} />);
    await screen.findByText(/4 placed/);
    expect(box()).toBeChecked();
    expect(axios.post.mock.calls[0][1]).toEqual({ groupByYear: true });
    expect(screen.getByText(/1 group mixes years/)).toBeInTheDocument();
    expect(within(screen.getByText("Ada").closest("[data-person-id]")).getByText("3rd")).toBeInTheDocument();
  });

  test("turning it off refreshes the preview, and Confirm builds what was previewed", async () => {
    const onBuilt = jest.fn();
    axios.post
      .mockResolvedValueOnce(preview("fp-on"))
      .mockResolvedValueOnce(preview("fp-off"))
      .mockResolvedValueOnce({ data: { created: 4 } });
    render(<BuildCaseGroupsModal onClose={jest.fn()} onBuilt={onBuilt} />);
    await screen.findByText(/4 placed/);
    fireEvent.click(box());
    await waitFor(() => expect(axios.post.mock.calls[1][1]).toEqual({ groupByYear: false }));
    await waitFor(() => expect(screen.getByText("Confirm and build")).not.toBeDisabled());
    fireEvent.click(screen.getByText("Confirm and build"));
    await waitFor(() => expect(onBuilt).toHaveBeenCalledWith(4));
    expect(axios.post.mock.calls[2][1]).toEqual({ fingerprint: "fp-off", groupByYear: false });
  });
});
