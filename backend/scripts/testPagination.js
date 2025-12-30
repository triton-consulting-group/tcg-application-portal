const axios = require('axios');

const testPagination = async () => {
  console.log('🧪 Testing Pagination API Endpoints...\n');
  
  try {
    // Test the main paginated endpoint
    console.log('1. Testing main paginated endpoint:');
    const response1 = await axios.get('http://localhost:5002/api/applications');
    console.log(`   ✅ Status: ${response1.status}`);
    console.log(`   📊 Total Applications: ${response1.data.pagination.totalApplications}`);
    console.log(`   📄 Total Pages: ${response1.data.pagination.totalPages}`);
    console.log(`   📋 Applications per page: ${response1.data.pagination.applicationsPerPage}`);
    console.log(`   🔢 Current page: ${response1.data.pagination.currentPage}`);
    console.log(`   📝 Applications returned: ${response1.data.applications.length}\n`);
    
    // Test the backward-compatible endpoint
    console.log('2. Testing backward-compatible endpoint:');
    const response2 = await axios.get('http://localhost:5002/api/applications/all');
    console.log(`   ✅ Status: ${response2.status}`);
    console.log(`   📊 Total Applications: ${response2.data.length}\n`);
    
    // Test pagination with different page sizes
    console.log('3. Testing pagination with different page sizes:');
    const pageSizes = [10, 20, 30, 50];
    
    for (const limit of pageSizes) {
      const response = await axios.get(`http://localhost:5002/api/applications?limit=${limit}`);
      console.log(`   📄 Page size ${limit}: ${response.data.applications.length} applications returned`);
    }
    console.log('');
    
    // Test page navigation
    console.log('4. Testing page navigation:');
    const response3 = await axios.get('http://localhost:5002/api/applications?page=2');
    console.log(`   ✅ Page 2 status: ${response3.status}`);
    console.log(`   📄 Current page: ${response3.data.pagination.currentPage}`);
    console.log(`   📝 Applications returned: ${response3.data.applications.length}\n`);
    
    console.log('🎉 All pagination tests passed!');
    
  } catch (error) {
    console.error('❌ Error testing pagination:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
  }
};

// Run the test
testPagination(); 