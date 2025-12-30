const axios = require('axios');
require('dotenv').config();

// Test production API endpoints
const testProductionAPI = async () => {
  // You can update these URLs to match your production deployment
  const FRONTEND_URL = 'https://tcg-application-portal.vercel.app';
  const BACKEND_URL = process.env.BACKEND_URL || 'https://tcg-application-portal-production.up.railway.app';
  
  console.log('🔍 Testing Production API Connectivity');
  console.log('Frontend URL:', FRONTEND_URL);
  console.log('Backend URL:', BACKEND_URL);
  console.log('=' .repeat(60));
  
  const tests = [
    {
      name: 'Health Check',
      url: `${BACKEND_URL}/`,
      method: 'GET'
    },
    {
      name: 'Window Status',
      url: `${BACKEND_URL}/api/applications/window-status`,
      method: 'GET'
    },
    {
      name: 'Case Night Config',
      url: `${BACKEND_URL}/api/applications/case-night-config`,
      method: 'GET'
    },
    {
      name: 'Applications List (should fail without auth)',
      url: `${BACKEND_URL}/api/applications`,
      method: 'GET'
    }
  ];
  
  for (const test of tests) {
    try {
      console.log(`\n📡 Testing: ${test.name}`);
      const response = await axios({
        method: test.method,
        url: test.url,
        timeout: 10000,
        headers: {
          'Origin': FRONTEND_URL,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`✅ ${test.name}: SUCCESS (${response.status})`);
      if (response.data && typeof response.data === 'object') {
        const keys = Object.keys(response.data);
        console.log(`   Response keys: ${keys.slice(0, 5).join(', ')}${keys.length > 5 ? '...' : ''}`);
      }
    } catch (error) {
      if (error.response) {
        console.log(`❌ ${test.name}: HTTP ${error.response.status} - ${error.response.statusText}`);
        if (error.response.data?.error) {
          console.log(`   Error: ${error.response.data.error}`);
        }
      } else if (error.code === 'ECONNREFUSED') {
        console.log(`❌ ${test.name}: CONNECTION REFUSED - Backend not running`);
      } else if (error.code === 'ENOTFOUND') {
        console.log(`❌ ${test.name}: DNS ERROR - Invalid URL`);
      } else {
        console.log(`❌ ${test.name}: ${error.message}`);
      }
    }
  }
  
  console.log('\n🔧 Environment Variables Check:');
  console.log('MONGO_URI:', process.env.MONGO_URI ? 'SET' : 'NOT SET');
  console.log('AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID ? 'SET' : 'NOT SET');
  console.log('S3_BUCKET_NAME:', process.env.S3_BUCKET_NAME || 'NOT SET');
  console.log('NODE_ENV:', process.env.NODE_ENV || 'NOT SET');
};

testProductionAPI().catch(console.error);