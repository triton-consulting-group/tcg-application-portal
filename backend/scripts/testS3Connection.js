const { s3, S3_CONFIG, isS3Configured } = require('../config/s3Config');

// Test S3 connection and operations
const testS3Connection = async () => {
  try {
    console.log('🔍 Testing S3 Connection and Operations');
    console.log('=' .repeat(50));

    if (!isS3Configured()) {
      console.log('❌ S3 is not configured');
      return;
    }

    console.log(`📦 Testing connection to bucket: ${S3_CONFIG.bucketName}`);
    console.log(`🌍 Region: ${S3_CONFIG.region}`);

    // Test 1: List bucket contents
    console.log('\n1️⃣ Testing bucket access...');
    try {
      const listParams = {
        Bucket: S3_CONFIG.bucketName,
        MaxKeys: 5
      };
      
      const result = await s3.listObjectsV2(listParams).promise();
      console.log(`✅ Bucket access successful!`);
      console.log(`📁 Found ${result.Contents ? result.Contents.length : 0} objects in bucket`);
      
      if (result.Contents && result.Contents.length > 0) {
        console.log('📄 Sample files:');
        result.Contents.slice(0, 3).forEach((obj, index) => {
          console.log(`   ${index + 1}. ${obj.Key} (${(obj.Size / 1024).toFixed(1)} KB)`);
        });
      } else {
        console.log('📭 Bucket is empty (this is normal for a new bucket)');
      }
    } catch (error) {
      console.log(`❌ Bucket access failed: ${error.message}`);
      return;
    }

    // Test 2: Test file upload (small test file)
    console.log('\n2️⃣ Testing file upload...');
    try {
      const testContent = `Test file uploaded at ${new Date().toISOString()}`;
      const testKey = `test/connection-test-${Date.now()}.txt`;
      
      const uploadParams = {
        Bucket: S3_CONFIG.bucketName,
        Key: testKey,
        Body: testContent,
        ACL: 'public-read',
        ContentType: 'text/plain'
      };

      const uploadResult = await s3.upload(uploadParams).promise();
      console.log(`✅ Test file uploaded successfully!`);
      console.log(`🔗 File URL: ${uploadResult.Location}`);
      
      // Test 3: Test file download
      console.log('\n3️⃣ Testing file download...');
      const downloadParams = {
        Bucket: S3_CONFIG.bucketName,
        Key: testKey
      };
      
      const downloadResult = await s3.getObject(downloadParams).promise();
      const downloadedContent = downloadResult.Body.toString();
      console.log(`✅ Test file downloaded successfully!`);
      console.log(`📄 Content: ${downloadedContent.substring(0, 50)}...`);
      
      // Test 4: Clean up test file
      console.log('\n4️⃣ Cleaning up test file...');
      const deleteParams = {
        Bucket: S3_CONFIG.bucketName,
        Key: testKey
      };
      
      await s3.deleteObject(deleteParams).promise();
      console.log(`✅ Test file deleted successfully!`);

    } catch (error) {
      console.log(`❌ File operations failed: ${error.message}`);
      return;
    }

    // Test 5: Test bucket permissions
    console.log('\n5️⃣ Testing bucket permissions...');
    try {
      const headParams = {
        Bucket: S3_CONFIG.bucketName
      };
      
      await s3.headBucket(headParams).promise();
      console.log(`✅ Bucket permissions are correct!`);
    } catch (error) {
      console.log(`❌ Bucket permissions issue: ${error.message}`);
    }

    console.log('\n🎉 S3 Configuration Test Complete!');
    console.log('✅ Your S3 setup is working perfectly!');
    console.log('🚀 You can now deploy your application with S3 file storage.');

  } catch (error) {
    console.error('❌ S3 test failed:', error.message);
  }
};

testS3Connection();
