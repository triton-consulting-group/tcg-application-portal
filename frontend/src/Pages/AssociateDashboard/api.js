import axios from "axios";
import API_BASE_URL from "../../config/api";
import { getAdminAuthHeaders } from "../../config/adminAuth";

// Resolve the current user's token for each protected dashboard request.
const request = async (method, path, data, config = {}) => {
  const headers = await getAdminAuthHeaders();
  const url = `${API_BASE_URL}/api${path}`;
  const options = { ...config, headers };
  return method === "get" || method === "delete"
    ? axios[method](url, options)
    : axios[method](url, data, options);
};

const dashboardApi = {
  checkAdmin: (email) => request("post", "/admin/check", { email }),
  getApplications: () => request("get", "/applications/all"),
  // This configuration endpoint is public in the existing application.
  getCaseNightConfig: () => axios.get(`${API_BASE_URL}/api/applications/case-night-config`),
  updateApplication: (id, data) => request("put", `/applications/${id}`, data),
  addComment: (id, comment) => request("post", `/applications/${id}/comment`, { comment }),
  deleteComment: (id, commentId) => request("delete", `/applications/${id}/comments/${commentId}`),
  exportCaseGroups: () => request("get", "/case-groups/export", undefined, { responseType: "blob" }),
  exportPhase: (statuses) => request("get", "/applications/export-by-status", undefined, {
    params: { statuses }, responseType: "blob",
  }),
};

// Preserve the existing fallback when a signed file URL cannot be obtained.
export const getFileUrl = async (filePath) => {
  if (!filePath) return "";
  try {
    const response = await request("get", `/applications/file-url/${encodeURIComponent(filePath)}`);
    return response.data.url;
  } catch (error) {
    console.error("Error getting file URL:", error);
    return filePath;
  }
};

export default dashboardApi;
