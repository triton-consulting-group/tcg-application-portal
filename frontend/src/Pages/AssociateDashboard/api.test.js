import axios from "axios";
import { getAdminAuthHeaders } from "../../config/adminAuth";
import dashboardApi, { getFileUrl } from "./api";

jest.mock("axios", () => ({ __esModule: true, default: {
  get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn(),
} }));
jest.mock("../../config/adminAuth", () => ({ getAdminAuthHeaders: jest.fn() }));

beforeEach(() => {
  jest.resetAllMocks();
  getAdminAuthHeaders.mockResolvedValue({ Authorization: "Bearer current-token" });
});

test("protected calls obtain a fresh current-user token for every request", async () => {
  getAdminAuthHeaders.mockResolvedValueOnce({ Authorization: "Bearer first-user" })
    .mockResolvedValueOnce({ Authorization: "Bearer second-user" });
  await dashboardApi.getApplications();
  await dashboardApi.checkAdmin("second@local.test");
  expect(axios.get).toHaveBeenCalledWith(expect.stringMatching(/\/api\/applications\/all$/), {
    headers: { Authorization: "Bearer first-user" },
  });
  expect(axios.post).toHaveBeenCalledWith(expect.stringMatching(/\/api\/admin\/check$/), {
    email: "second@local.test",
  }, { headers: { Authorization: "Bearer second-user" } });
  expect(getAdminAuthHeaders).toHaveBeenCalledTimes(2);
});

test("missing authentication rejects before any protected HTTP request", async () => {
  const error = new Error("Not signed in");
  getAdminAuthHeaders.mockRejectedValue(error);
  await expect(dashboardApi.updateApplication("123", { status: "Accepted" })).rejects.toBe(error);
  expect(axios.put).not.toHaveBeenCalled();
});

test("case-night configuration remains public", async () => {
  const response = { data: { slots: { "1": "Friday" } } };
  axios.get.mockResolvedValue(response);
  await expect(dashboardApi.getCaseNightConfig()).resolves.toBe(response);
  expect(axios.get).toHaveBeenCalledWith(expect.stringMatching(/\/api\/applications\/case-night-config$/));
  expect(getAdminAuthHeaders).not.toHaveBeenCalled();
});

test("server errors remain intact for existing UI error handling", async () => {
  const error = { response: { status: 403, data: { error: "Forbidden" } } };
  axios.delete.mockRejectedValue(error);
  await expect(dashboardApi.deleteComment("123", "456")).rejects.toBe(error);
});

test("file paths are encoded and successful responses return the signed URL", async () => {
  axios.get.mockResolvedValue({ data: { url: "https://example.test/signed" } });
  await expect(getFileUrl("uploads/résumé #1.pdf")).resolves.toBe("https://example.test/signed");
  expect(axios.get).toHaveBeenCalledWith(expect.stringContaining("/file-url/uploads%2Fr%C3%A9sum%C3%A9%20%231.pdf"), {
    headers: { Authorization: "Bearer current-token" },
  });
});

test("empty file paths avoid requests and failed lookups retain the original fallback", async () => {
  await expect(getFileUrl(null)).resolves.toBe("");
  expect(axios.get).not.toHaveBeenCalled();
  const log = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    axios.get.mockRejectedValue(new Error("Unavailable"));
    await expect(getFileUrl("original.pdf")).resolves.toBe("original.pdf");
  } finally {
    log.mockRestore();
  }
});
