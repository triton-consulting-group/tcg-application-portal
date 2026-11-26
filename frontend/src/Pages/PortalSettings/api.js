import axios from "axios";
import API_BASE_URL from "../../config/api";
import { getAdminAuthHeaders } from "../../config/adminAuth";

export const readSettings = async () => (await axios.get(`${API_BASE_URL}/api/settings`, { headers: await getAdminAuthHeaders() })).data;
export const saveSettings = async data => (await axios.put(`${API_BASE_URL}/api/settings`, data, { headers: await getAdminAuthHeaders() })).data;
export const readPublicSettings = async () => (await axios.get(`${API_BASE_URL}/api/settings/public`)).data;
