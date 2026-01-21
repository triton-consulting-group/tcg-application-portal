// Frontend environment configuration
// For hybrid deployment: Frontend on Vercel + Backend on Railway
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5002';

// Auto-add https:// if missing (for Railway domains)
const formattedURL = API_BASE_URL && !API_BASE_URL.startsWith('http') 
  ? `https://${API_BASE_URL}` 
  : API_BASE_URL;

export default formattedURL;
