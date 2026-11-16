import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import axios from "axios";
import ApplicationViewEdit from "./ApplicationViewEdit";

// CRA's Jest can't load axios's ES module build, so replace it entirely
jest.mock("axios", () => {
  const axios = jest.fn();
  axios.get = jest.fn();
  axios.put = jest.fn();
  return { __esModule: true, default: axios };
});

// CRA's Jest can't resolve react-router v7's package exports, and the page only needs three hooks
const mockNavigate = jest.fn();
jest.mock(
  "react-router-dom",
  () => ({
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams()],
    useParams: () => ({})
  }),
  { virtual: true }
);

// CRA's Jest can't load Chakra v3 (the same error breaks App.test.js on main); the page only uses Box
jest.mock("@chakra-ui/react", () => ({
  Box: ({ children }) => require("react").createElement("div", null, children)
}));

// Signed in as the applicant whose application is shown
const mockUser = { email: "applicant@ucsd.edu", getIdToken: async () => "t" };
const mockAuth = {};
jest.mock("firebase/auth", () => ({
  getAuth: () => mockAuth,
  onAuthStateChanged: (auth, callback) => {
    callback(mockUser);
    return () => {};
  }
}));

const application = {
  _id: "app1",
  email: "applicant@ucsd.edu",
  fullName: "Ada Applicant",
  phoneNumber: "+18585550123",
  studentYear: "2nd",
  major: "Data Science",
  appliedBefore: "No",
  candidateType: "Tech",
  reason: "Because",
  caseNightPreferences: ["A"],
  status: "Under Review"
};

// axios rejects like this when the server answers with an error status
const serverError = (status, error) =>
  Object.assign(new Error(`Request failed with status code ${status}`), { response: { status, data: { error } } });

const mockLoad = (applicationResult) =>
  axios.get.mockImplementation(async (url) => {
    if (url.endsWith("/case-night-config")) return { data: { slots: { A: "6:00 PM – 7:00 PM" } } };
    return applicationResult();
  });

const renderPage = () => render(<ApplicationViewEdit />);

// Opens the edit form and submits it
const submitEdit = async () => {
  fireEvent.click(await screen.findByRole("button", { name: "Edit Application" }));
  fireEvent.submit(document.querySelector("form"));
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(window, "alert").mockImplementation(() => {});
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

test("a rejected save shows the server's reason", async () => {
  mockLoad(async () => ({ data: application }));
  axios.put.mockRejectedValue(serverError(400, "❌ Please enter a valid phone number."));
  renderPage();
  await submitEdit();

  await waitFor(() =>
    expect(window.alert).toHaveBeenCalledWith("Error updating application: ❌ Please enter a valid phone number.")
  );
});

test("a save that fails without a server reason still shows axios's message", async () => {
  mockLoad(async () => ({ data: application }));
  axios.put.mockRejectedValue(new Error("Network Error"));
  renderPage();
  await submitEdit();

  await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Error updating application: Network Error"));
});

test("a failed page load shows the server's reason", async () => {
  mockLoad(async () => {
    throw serverError(403, "❌ You can only access your own application.");
  });
  renderPage();

  // The error box adds its own "❌ " in front of the message
  expect(await screen.findByText(/You can only access your own application\./)).toBeInTheDocument();
});
