const { s3, S3_CONFIG, isS3Configured } = require('../config/s3Config');

// Test S3 connection without ListBucket permission
const testS3Basic = async () => {
  try {
    console.log('🔍 Testing S3 Basic Operations');
    console.log('=' .repeat(40));

    if (!isS3Configured()) {
      console.log('❌ S3 is not configured');
      return;
    }

    console.log(`📦 Bucket: ${S3_CONFIG.bucketName}`);
    console.log(`🌍 Region: ${S3_CONFIG.region}`);

    // Test 1: Test file upload
    console.log('\n1️⃣ Testing file upload...');
    try {
      const testContent = `Test file uploaded at ${new Date().toISOString()}`;
      const testKey = `test/connection-test-${Date.now()}.txt`;
      
      const uploadParams = {
        Bucket: S3_CONFIG.bucketName,
        Key: testKey,
        Body: testContent,
        ContentType: 'text/plain'
      };

      const uploadResult = await s3.upload(uploadParams).promise();
      console.log(`✅ Test file uploaded successfully!`);
      console.log(`🔗 File URL: ${uploadResult.Location}`);
      
      // Test 2: Test file download
      console.log('\n2️⃣ Testing file download...');
      const downloadParams = {
        Bucket: S3_CONFIG.bucketName,
        Key: testKey
      };
      
      const downloadResult = await s3.getObject(downloadParams).promise();
      const downloadedContent = downloadResult.Body.toString();
      console.log(`✅ Test file downloaded successfully!`);
      console.log(`📄 Content: ${downloadedContent.substring(0, 50)}...`);
      
      // Test 3: Clean up test file
      console.log('\n3️⃣ Cleaning up test file...');
      const deleteParams = {
        Bucket: S3_CONFIG.bucketName,
        Key: testKey
      };
      
      await s3.deleteObject(deleteParams).promise();
      console.log(`✅ Test file deleted successfully!`);

      console.log('\n🎉 S3 Basic Operations Test Complete!');
      console.log('✅ Your S3 setup is working for file uploads/downloads!');
      console.log('📝 Note: ListBucket permission is missing but not required for file operations');

    } catch (error) {
      console.log(`❌ File operations failed: ${error.message}`);
      
      if (error.message.includes('AccessDenied')) {
        console.log('\n💡 This might be a permissions issue. Check:');
        console.log('1. IAM user has s3:PutObject, s3:GetObject, s3:DeleteObject permissions');
        console.log('2. Bucket policy allows public read access');
        console.log('3. Bucket name matches exactly in your .env file');
      }
    }

  } catch (error) {
    console.error('❌ S3 test failed:', error.message);
  }
};

testS3Basic();
