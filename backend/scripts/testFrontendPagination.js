const axios = require('axios');

const testFrontendPagination = async () => {
  console.log('🧪 Testing Frontend Pagination Integration...\n');
  
  try {
    // Test the endpoint that the frontend now uses
    console.log('1. Testing /api/applications/all endpoint (frontend now uses this):');
    const response1 = await axios.get('http://localhost:5002/api/applications/all');
    console.log(`   ✅ Status: ${response1.status}`);
    console.log(`   📊 Total Applications: ${response1.data.length}`);
    console.log(`   📝 Response type: ${Array.isArray(response1.data) ? 'Array' : 'Object'}`);
    console.log(`   🔍 First application: ${response1.data[0]?.fullName || 'N/A'}\n`);
    
    // Test that the paginated endpoint still works (for comparison)
    console.log('2. Testing /api/applications endpoint (paginated):');
    const response2 = await axios.get('http://localhost:5002/api/applications');
    console.log(`   ✅ Status: ${response2.status}`);
    console.log(`   📊 Total Applications: ${response2.data.pagination.totalApplications}`);
    console.log(`   📄 Applications returned: ${response2.data.applications.length}`);
    console.log(`   📝 Response type: ${Array.isArray(response2.data) ? 'Array' : 'Object'}\n`);
    
    // Verify both endpoints return the same total count
    if (response1.data.length === response2.data.pagination.totalApplications) {
      console.log('✅ SUCCESS: Both endpoints return the same total application count!');
    } else {
      console.log('❌ ERROR: Endpoints return different counts!');
      console.log(`   /all endpoint: ${response1.data.length}`);
      console.log(`   /applications endpoint: ${response2.data.pagination.totalApplications}`);
    }
    
    console.log('\n🎉 Frontend pagination integration test completed!');
    console.log('\n📋 Summary:');
    console.log(`   • Frontend now uses /api/applications/all (returns ${response1.data.length} applications)`);
    console.log(`   • Backend pagination still available at /api/applications`);
    console.log(`   • Frontend will handle pagination client-side with 30 applications per page`);
    console.log(`   • Total pages: ${Math.ceil(response1.data.length / 30)}`);
    
  } catch (error) {
    console.error('❌ Error testing frontend pagination:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
  }
};

// Run the test
testFrontendPagination(); 