// Frontend environment configuration
// For hybrid deployment: Frontend on Vercel + Backend on Railway
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5002';

export default API_BASE_URL;
