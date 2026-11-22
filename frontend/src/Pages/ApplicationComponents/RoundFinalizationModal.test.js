import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import axios from "axios";
import RoundFinalizationModal from "./RoundFinalizationModal";

jest.mock("axios", () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));
jest.mock("../../config/adminAuth", () => ({ getAdminAuthHeaders: async () => ({ Authorization: "Bearer test" }) }));

const applicant = { applicationId: "app-1", name: "Ada", currentStatus: "Case Night - Yes", evaluations: [{ evaluator: "grader@ucsd.edu", result: "Pass", notes: "Clear reasoning" }] };
const round = { _id: "round-1", status: "draft", kind: "case-night", cycle: "2026-fall" };
const preview = { fingerprint: "fresh-grades", changes: [{ applicationId: "app-1", name: "Ada", from: "Case Night - Yes", to: "Final Interview - Yes" }], blockers: [] };
const choose = async () => {
  fireEvent.change(await screen.findByLabelText("Decision for Ada"), { target: { value: "Pass" } });
  fireEvent.click(screen.getByText("Preview status changes"));
  await screen.findByRole("region", { name: "Status change preview" });
};

beforeEach(() => {
  jest.resetAllMocks();
  axios.get.mockResolvedValue({ data: { round, applicants: [applicant] } });
  axios.post.mockResolvedValue({ data: preview });
});

test("requires explicit decisions and a preview before finalizing the selected cycle", async () => {
  const onFinalized = jest.fn();
  render(<RoundFinalizationModal cycle="2026-fall" onClose={jest.fn()} onFinalized={onFinalized} />);
  expect(await screen.findByText(/Clear reasoning/)).toBeInTheDocument();
  expect(screen.getByText("Preview status changes")).toBeDisabled();
  expect(screen.queryByText("Confirm and finalize")).not.toBeInTheDocument();
  await choose();
  expect(axios.post).toHaveBeenCalledWith(expect.stringMatching(/\/finalization\/preview$/), { decisions: [{ applicationId: "app-1", result: "Pass" }] }, { headers: { Authorization: "Bearer test" }, params: { cycle: "2026-fall", kind: "case-night" } });
  expect(screen.getByText("Ada: Case Night - Yes → Final Interview - Yes")).toBeInTheDocument();
  axios.post.mockResolvedValueOnce({ data: { finalized: true, updated: 1 } });
  fireEvent.click(screen.getByText("Confirm and finalize"));
  await waitFor(() => expect(onFinalized).toHaveBeenCalledTimes(1));
  expect(axios.post).toHaveBeenLastCalledWith(expect.stringMatching(/\/round\/finalize$/), { decisions: [{ applicationId: "app-1", result: "Pass" }], fingerprint: "fresh-grades" }, expect.anything());
  expect(screen.getByText(/Grades and decisions are locked/)).toBeInTheDocument();
  expect(screen.getByText("Current status: Final Interview - Yes")).toBeInTheDocument();
  expect(screen.queryByText("Current status: Case Night - Yes")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Decision for Ada")).not.toBeInTheDocument();
});

test("changing a decision removes the old preview", async () => {
  render(<RoundFinalizationModal cycle="2026-fall" onClose={jest.fn()} onFinalized={jest.fn()} />);
  await choose();
  fireEvent.change(screen.getByLabelText("Decision for Ada"), { target: { value: "Fail" } });
  expect(screen.queryByText("Confirm and finalize")).not.toBeInTheDocument();
});

test("selecting final interview resets decisions and uses its round for preview and commit", async () => {
  render(<RoundFinalizationModal cycle="2026-fall" onClose={jest.fn()} onFinalized={jest.fn()} />);
  await choose();
  fireEvent.change(screen.getByLabelText("Round"), { target: { value: "final-interview" } });
  await waitFor(() => expect(axios.get).toHaveBeenLastCalledWith(expect.stringMatching(/\/finalization$/), expect.objectContaining({ params: { cycle: "2026-fall", kind: "final-interview" } })));
  expect(await screen.findByLabelText("Decision for Ada")).toHaveValue("");
  expect(screen.queryByText("Confirm and finalize")).not.toBeInTheDocument();
  await choose();
  expect(axios.post).toHaveBeenLastCalledWith(expect.stringMatching(/\/preview$/), expect.anything(), expect.objectContaining({ params: { cycle: "2026-fall", kind: "final-interview" } }));
  axios.post.mockResolvedValueOnce({ data: { finalized: true, updated: 1 } });
  fireEvent.click(screen.getByText("Confirm and finalize"));
  await waitFor(() => expect(axios.post).toHaveBeenLastCalledWith(expect.stringMatching(/\/finalize$/), expect.anything(), expect.objectContaining({ params: { cycle: "2026-fall", kind: "final-interview" } })));
});

test("a stale preview reloads grades and requires new decisions", async () => {
  const onFinalized = jest.fn();
  render(<RoundFinalizationModal cycle="2026-fall" onClose={jest.fn()} onFinalized={onFinalized} />);
  await choose();
  axios.post.mockRejectedValueOnce({ response: { status: 409, data: { error: "Grades changed." } } });
  fireEvent.click(screen.getByText("Confirm and finalize"));
  expect(await screen.findByText(/The round changed after your preview/)).toBeInTheDocument();
  expect(screen.getByLabelText("Decision for Ada")).toHaveValue("");
  expect(screen.queryByText("Confirm and finalize")).not.toBeInTheDocument();
  expect(onFinalized).not.toHaveBeenCalled();
});

test("server blockers and missing grades prevent confirmation", async () => {
  axios.post.mockResolvedValueOnce({ data: { ...preview, blockers: ["Applicant status changed."] } });
  const view = render(<RoundFinalizationModal cycle="2026-fall" onClose={jest.fn()} onFinalized={jest.fn()} />);
  await choose();
  expect(screen.getByRole("alert")).toHaveTextContent("Applicant status changed.");
  expect(screen.getByText("Confirm and finalize")).toBeDisabled();
  axios.get.mockResolvedValue({ data: { round, applicants: [{ ...applicant, evaluations: [] }] } });
  view.rerender(<RoundFinalizationModal cycle="2027-winter" onClose={jest.fn()} onFinalized={jest.fn()} />);
  await screen.findByText(/No grades recorded/);
  fireEvent.change(screen.getByLabelText("Decision for Ada"), { target: { value: "Pass" } });
  expect(screen.getByText("Preview status changes")).toBeDisabled();
});

test("errors stay visible and a finalized round has no decision controls", async () => {
  axios.get.mockRejectedValueOnce({ response: { data: { error: "Access denied." } } });
  const view = render(<RoundFinalizationModal cycle="2026-fall" onClose={jest.fn()} onFinalized={jest.fn()} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Access denied.");
  axios.get.mockResolvedValue({ data: { round: { ...round, status: "finalized" }, applicants: [applicant] } });
  view.rerender(<RoundFinalizationModal cycle="2027-winter" onClose={jest.fn()} onFinalized={jest.fn()} />);
  expect(await screen.findByText(/Grades and decisions are locked/)).toBeInTheDocument();
  expect(screen.queryByText("Preview status changes")).not.toBeInTheDocument();
});


test("a late response from an earlier cycle cannot replace the selected cycle", async () => {
  let finishOldRequest;
  axios.get.mockImplementationOnce(() => new Promise((resolve) => { finishOldRequest = resolve; }));
  const view = render(<RoundFinalizationModal cycle="2026-fall" onClose={jest.fn()} onFinalized={jest.fn()} />);
  await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(1));
  axios.get.mockResolvedValueOnce({ data: { round: { ...round, cycle: "2027-winter" }, applicants: [{ ...applicant, name: "Bea", applicationId: "app-2" }] } });
  view.rerender(<RoundFinalizationModal cycle="2027-winter" onClose={jest.fn()} onFinalized={jest.fn()} />);
  await screen.findByLabelText("Decision for Bea");
  await act(async () => finishOldRequest({ data: { round, applicants: [applicant] } }));
  expect(screen.queryByLabelText("Decision for Ada")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Decision for Bea")).toBeInTheDocument();
});
