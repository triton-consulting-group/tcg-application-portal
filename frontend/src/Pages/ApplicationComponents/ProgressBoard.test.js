import React from "react";
import { render, screen, fireEvent, waitFor, within, act } from "@testing-library/react";
import axios from "axios";
import ProgressBoard, { POLL_MS, roundForStatus } from "./ProgressBoard";

// CRA's Jest can't load axios's ES module build, so replace it entirely
jest.mock("axios", () => {
  const axios = jest.fn();
  axios.get = jest.fn();
  return { __esModule: true, default: axios };
});
jest.mock("../../config/adminAuth", () => ({ getAdminAuthHeaders: async () => ({ Authorization: "Bearer t" }) }));

const progress = (overrides = {}) => ({
  requiredGrades: 2,
  canSeeAll: false,
  rounds: {
    case_study: { total: 3, graded: 2, ungraded: 1, split: 1 },
    final_interview: { total: 1, graded: 0, ungraded: 1, split: 0 }
  },
  applicants: [
    // Graded by me, split
    { applicationId: "a", fullName: "Ada", candidateType: "Tech", round: "case_study", gradeCount: 2, ungraded: false, myDecision: "Yes", counts: { Yes: 1, No: 0, Maybe: 1 }, split: true },
    // Not graded by me: breakdown redacted by the server
    { applicationId: "b", fullName: "Bo", candidateType: "Non-Tech", round: "case_study", gradeCount: 2, ungraded: false, myDecision: null },
    // Ungraded
    { applicationId: "c", fullName: "Cy", candidateType: "Tech", round: "case_study", gradeCount: 1, ungraded: true, myDecision: null },
    { applicationId: "d", fullName: "Di", candidateType: "Tech", round: "final_interview", gradeCount: 0, ungraded: true, myDecision: null }
  ],
  ...overrides
});

const rowFor = (name) => screen.getByText(name).closest("tr");
const visibleNames = () => screen.queryAllByRole("row").slice(1).map((row) => within(row).getAllByRole("cell")[0].textContent);

beforeEach(() => {
  jest.clearAllMocks();
  axios.get.mockResolvedValue({ data: progress() });
});

afterEach(() => {
  jest.useRealTimers();
});

test("matches the backend's round mapping", () => {
  expect(roundForStatus("Case Night - Yes")).toBe("case_study");
  expect(roundForStatus("Final Interview - Yes")).toBe("final_interview");
  expect(roundForStatus("Final Interview - Maybe")).toBeNull();
  expect(roundForStatus("Under Review")).toBeNull();
});

test("loads progress with the admin's token and shows the Case Study round first", async () => {
  render(<ProgressBoard onOpenApplicant={jest.fn()} />);

  expect(await screen.findByText("Ada")).toBeInTheDocument();
  expect(axios.get).toHaveBeenCalledWith(expect.stringContaining("/api/grades/progress"), { headers: { Authorization: "Bearer t" } });
  expect(visibleNames()).toEqual(["Ada", "Bo", "Cy"]);
  expect(screen.getByText("2/3")).toBeInTheDocument();
});

test("flags ungraded and split applicants", async () => {
  render(<ProgressBoard onOpenApplicant={jest.fn()} />);
  await screen.findByText("Ada");

  expect(within(rowFor("Ada")).getByText("Split")).toBeInTheDocument();
  expect(within(rowFor("Ada")).queryByText("Ungraded")).toBeNull();
  expect(within(rowFor("Cy")).getByText("Ungraded")).toBeInTheDocument();
  expect(within(rowFor("Bo")).queryByText("Split")).toBeNull();
});

test("shows the breakdown only where the server sent it", async () => {
  render(<ProgressBoard onOpenApplicant={jest.fn()} />);
  await screen.findByText("Ada");

  expect(within(rowFor("Ada")).getByText("Yes 1 · No 0 · Maybe 1")).toBeInTheDocument();
  expect(within(rowFor("Bo")).getByText("Hidden until you grade")).toBeInTheDocument();
  expect(screen.getByText(/appear only after you grade an applicant/)).toBeInTheDocument();
});

test("super admins don't get the blind-grading note", async () => {
  axios.get.mockResolvedValue({ data: progress({ canSeeAll: true }) });
  render(<ProgressBoard onOpenApplicant={jest.fn()} />);
  await screen.findByText("Ada");

  expect(screen.queryByText(/appear only after you grade an applicant/)).toBeNull();
});

test.each([
  ["Ungraded", ["Cy"]],
  ["Split", ["Ada"]],
  ["Not graded by me", ["Bo", "Cy"]],
  ["All", ["Ada", "Bo", "Cy"]]
])("the %s filter", async (label, names) => {
  render(<ProgressBoard onOpenApplicant={jest.fn()} />);
  await screen.findByText("Ada");

  fireEvent.click(screen.getByRole("button", { name: label }));
  expect(visibleNames()).toEqual(names);
});

test("switches to the Final Interview round", async () => {
  render(<ProgressBoard onOpenApplicant={jest.fn()} />);
  await screen.findByText("Ada");

  fireEvent.click(screen.getByRole("button", { name: "Final Interview (1)" }));
  expect(visibleNames()).toEqual(["Di"]);
  expect(screen.getByText("0/1")).toBeInTheDocument();
});

test("opens the applicant when a row is clicked", async () => {
  const onOpenApplicant = jest.fn();
  render(<ProgressBoard onOpenApplicant={onOpenApplicant} />);
  await screen.findByText("Bo");

  fireEvent.click(rowFor("Bo"));
  expect(onOpenApplicant).toHaveBeenCalledWith("b");
});

test("refreshes on its own every poll interval", async () => {
  jest.useFakeTimers();
  render(<ProgressBoard onOpenApplicant={jest.fn()} />);
  await screen.findByText("Ada");
  expect(axios.get).toHaveBeenCalledTimes(1);

  act(() => { jest.advanceTimersByTime(POLL_MS); });
  await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2));
});

test("refreshes immediately when a grade is saved elsewhere", async () => {
  const { rerender } = render(<ProgressBoard onOpenApplicant={jest.fn()} reloadSignal={0} />);
  await screen.findByText("Ada");

  rerender(<ProgressBoard onOpenApplicant={jest.fn()} reloadSignal={1} />);
  await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2));
});

test("keeps showing the last data if a refresh fails", async () => {
  const { rerender } = render(<ProgressBoard onOpenApplicant={jest.fn()} reloadSignal={0} />);
  await screen.findByText("Ada");

  axios.get.mockRejectedValueOnce({ response: { data: { error: "Server down" } } });
  rerender(<ProgressBoard onOpenApplicant={jest.fn()} reloadSignal={1} />);

  expect(await screen.findByText(/Server down/)).toBeInTheDocument();
  expect(screen.getByText("Ada")).toBeInTheDocument();
});

test("shows the error when the first load fails", async () => {
  axios.get.mockRejectedValue({ response: { data: { error: "❌ Admin not found or inactive" } } });
  render(<ProgressBoard onOpenApplicant={jest.fn()} />);

  expect(await screen.findByText("❌ Admin not found or inactive")).toBeInTheDocument();
});
