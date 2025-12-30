// Frontend environment configuration
// For hybrid deployment: Frontend on Vercel + Backend on Railway
let API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5002';

// Auto-add https:// if missing (for Railway domains)
if (API_BASE_URL && !API_BASE_URL.startsWith('http')) {
  API_BASE_URL = `https://${API_BASE_URL}`;
}

export default API_BASE_URL;
