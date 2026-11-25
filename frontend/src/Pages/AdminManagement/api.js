import axios from "axios";
import API_BASE_URL from "../../config/api";
import { getAdminAuthHeaders } from "../../config/adminAuth";

const request = async (method, email, body) => {
  const headers = await getAdminAuthHeaders();
  const url = `${API_BASE_URL}/api/admin${email ? `/${encodeURIComponent(email)}` : ""}`;
  const response = method === "get" || method === "delete"
    ? await axios[method](url, { headers })
    : await axios[method](url, body, { headers });
  return response.data;
};

const adminApi = {
  list: () => request("get"),
  create: (data) => request("post", null, data),
  update: (email, data) => request("put", email, data),
  deactivate: (email) => request("delete", email),
};

export default adminApi;
