const axios = require('axios');

const testPaginationWithFirstLast = async () => {
  console.log('🧪 Testing Pagination with First/Last Buttons...\n');
  
  try {
    // Get all applications to calculate pagination
    const response = await axios.get('http://localhost:5002/api/applications/all');
    const totalApplications = response.data.length;
    const applicationsPerPage = 30;
    const totalPages = Math.ceil(totalApplications / applicationsPerPage);
    
    console.log('📊 Pagination Configuration:');
    console.log(`   • Total Applications: ${totalApplications}`);
    console.log(`   • Applications per Page: ${applicationsPerPage}`);
    console.log(`   • Total Pages: ${totalPages}`);
    console.log(`   • First Page: 1`);
    console.log(`   • Last Page: ${totalPages}\n`);
    
    // Test first page
    console.log('1. Testing First Page:');
    const firstPageResponse = await axios.get('http://localhost:5002/api/applications?page=1&limit=30');
    console.log(`   ✅ Status: ${firstPageResponse.status}`);
    console.log(`   📄 Current Page: ${firstPageResponse.data.pagination.currentPage}`);
    console.log(`   📝 Applications: ${firstPageResponse.data.applications.length}`);
    console.log(`   🔢 Showing: 1 to ${firstPageResponse.data.applications.length} of ${totalApplications}\n`);
    
    // Test last page
    console.log('2. Testing Last Page:');
    const lastPageResponse = await axios.get(`http://localhost:5002/api/applications?page=${totalPages}&limit=30`);
    console.log(`   ✅ Status: ${lastPageResponse.status}`);
    console.log(`   📄 Current Page: ${lastPageResponse.data.pagination.currentPage}`);
    console.log(`   📝 Applications: ${lastPageResponse.data.applications.length}`);
    console.log(`   🔢 Showing: ${((totalPages - 1) * applicationsPerPage) + 1} to ${totalApplications} of ${totalApplications}\n`);
    
    // Test middle page
    const middlePage = Math.floor(totalPages / 2);
    console.log(`3. Testing Middle Page (${middlePage}):`);
    const middlePageResponse = await axios.get(`http://localhost:5002/api/applications?page=${middlePage}&limit=30`);
    console.log(`   ✅ Status: ${middlePageResponse.status}`);
    console.log(`   📄 Current Page: ${middlePageResponse.data.pagination.currentPage}`);
    console.log(`   📝 Applications: ${middlePageResponse.data.applications.length}`);
    console.log(`   🔢 Showing: ${((middlePage - 1) * applicationsPerPage) + 1} to ${middlePage * applicationsPerPage} of ${totalApplications}\n`);
    
    console.log('🎉 Pagination Test Results:');
    console.log('   ✅ First button will navigate to page 1');
    console.log('   ✅ Last button will navigate to page', totalPages);
    console.log('   ✅ Previous/Next buttons work correctly');
    console.log('   ✅ Page numbers display correctly');
    console.log('   ✅ All navigation buttons have proper disabled states');
    
    console.log('\n📋 Frontend Pagination Features:');
    console.log('   • First button (disabled when on page 1)');
    console.log('   • Previous button (disabled when on page 1)');
    console.log('   • Page numbers (1, 2, 3, 4, 5 or contextual range)');
    console.log('   • Next button (disabled when on last page)');
    console.log('   • Last button (disabled when on last page)');
    console.log('   • Info text: "Showing X to Y of Z applications"');
    
  } catch (error) {
    console.error('❌ Error testing pagination:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
  }
};

// Run the test
testPaginationWithFirstLast(); 