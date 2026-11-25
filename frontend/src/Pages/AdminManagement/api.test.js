import axios from "axios";
import { getAdminAuthHeaders } from "../../config/adminAuth";
import adminApi from "./api";

jest.mock("axios", () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() } }));
jest.mock("../../config/adminAuth", () => ({ getAdminAuthHeaders: jest.fn() }));
beforeEach(() => {
  jest.resetAllMocks();
  getAdminAuthHeaders.mockResolvedValue({ Authorization: "Bearer current-user" });
  for (const method of ["get", "post", "put", "delete"]) axios[method].mockResolvedValue({ data: { success: true } });
});

test("all management operations use Firebase headers and preserve payloads", async () => {
  const headers = { Authorization: "Bearer current-user" };
  const data = { email: "new@local.test", name: "New", role: "admin" };
  await adminApi.list();
  await adminApi.create(data);
  await adminApi.update("name+alias@local.test", { isActive: true });
  await adminApi.deactivate("name+alias@local.test");
  expect(axios.get).toHaveBeenCalledWith(expect.stringMatching(/\/api\/admin$/), { headers });
  expect(axios.post).toHaveBeenCalledWith(expect.stringMatching(/\/api\/admin$/), data, { headers });
  expect(axios.put).toHaveBeenCalledWith(expect.stringMatching(/\/name%2Balias%40local.test$/), { isActive: true }, { headers });
  expect(axios.delete).toHaveBeenCalledWith(expect.stringMatching(/\/name%2Balias%40local.test$/), { headers });
  expect(getAdminAuthHeaders).toHaveBeenCalledTimes(4);
});

test("the next operation uses the next current-user token", async () => {
  getAdminAuthHeaders.mockResolvedValueOnce({ Authorization: "Bearer first" }).mockResolvedValueOnce({ Authorization: "Bearer second" });
  await adminApi.list();
  await adminApi.list();
  expect(axios.get.mock.calls[1][1].headers.Authorization).toBe("Bearer second");
});

test("a missing session prevents requests", async () => {
  getAdminAuthHeaders.mockRejectedValue(new Error("Not signed in"));
  await expect(adminApi.create({})).rejects.toThrow("Not signed in");
  expect(axios.post).not.toHaveBeenCalled();
});

test("server errors reach the form unchanged", async () => {
  const failure = { response: { status: 409, data: { error: "Already exists" } } };
  axios.post.mockRejectedValue(failure);
  await expect(adminApi.create({})).rejects.toBe(failure);
});
