const { isS3Configured, S3_CONFIG } = require('../config/s3Config');

console.log('🔍 S3 Configuration Test');
console.log('=' .repeat(40));

console.log('\n📋 Configuration Status:');
console.log(`S3 Configured: ${isS3Configured() ? '✅ Yes' : '❌ No'}`);

if (isS3Configured()) {
  console.log('\n☁️ S3 Settings:');
  console.log(`Bucket Name: ${S3_CONFIG.bucketName}`);
  console.log(`Region: ${S3_CONFIG.region}`);
  console.log(`Max File Size: ${S3_CONFIG.uploadSettings.maxFileSize / (1024 * 1024)}MB`);
  console.log(`CloudFront Enabled: ${S3_CONFIG.urlSettings.useCloudFront ? 'Yes' : 'No'}`);
  
  console.log('\n📁 File Paths:');
  console.log(`Resumes: ${S3_CONFIG.uploadSettings.paths.resumes}`);
  console.log(`Transcripts: ${S3_CONFIG.uploadSettings.paths.transcripts}`);
  console.log(`Images: ${S3_CONFIG.uploadSettings.paths.images}`);
  console.log(`Other: ${S3_CONFIG.uploadSettings.paths.other}`);
  
  console.log('\n✅ Allowed File Types:');
  S3_CONFIG.uploadSettings.allowedMimeTypes.forEach(type => {
    console.log(`  - ${type}`);
  });
} else {
  console.log('\n⚠️ S3 Not Configured - Using Local Storage');
  console.log('To enable S3 storage, add these environment variables:');
  console.log('  AWS_ACCESS_KEY_ID=your_access_key');
  console.log('  AWS_SECRET_ACCESS_KEY=your_secret_key');
  console.log('  S3_BUCKET_NAME=your_bucket_name');
  console.log('  AWS_REGION=us-west-2');
}

console.log('\n📖 For detailed setup instructions, see: backend/docs/S3_CONFIGURATION.md');
