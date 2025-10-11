const { S3Client } = require('@aws-sdk/client-s3');
const { getSignedUrl: getSignedUrlV3 } = require('@aws-sdk/s3-request-presigner');
const { GetObjectCommand, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
require('dotenv').config();

// Validate AWS configuration
const validateAwsConfig = () => {
  const requiredVars = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'S3_BUCKET_NAME'];
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.log(`⚠️  Missing AWS environment variables: ${missing.join(', ')}`);
    console.log('📁 Falling back to local file storage');
    return false;
  }
  
  // Validate region explicitly
  const region = process.env.AWS_REGION || 'us-west-1';
  console.log('✅ AWS S3 configuration found');
  console.log(`📍 Using region: ${region}`);
  console.log(`🪣 Using bucket: ${process.env.S3_BUCKET_NAME}`);
  return true;
};

const isS3Configured = validateAwsConfig();

// Configure AWS SDK v3 only if properly configured
let s3Client = null;
let s3 = null; // Legacy S3 for multer-s3 compatibility

if (isS3Configured) {
  try {
    const region = process.env.AWS_REGION || 'us-west-1';
    
    // Create S3 client with AWS SDK v3 (more reliable region handling)
    s3Client = new S3Client({
      region: region || 'us-west-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
    
    // Also create legacy S3 instance for multer-s3 compatibility
    const AWS = require('aws-sdk');
    AWS.config.update({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: region || 'us-west-1',
      signatureVersion: 'v4'
    });
    
    s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: region || 'us-west-1',
      signatureVersion: 'v4',
      s3ForcePathStyle: false,
      useAccelerateEndpoint: false
    });
    
    console.log(`✅ S3 clients created successfully`);
    console.log(`🔐 Using signature version: v4`);
    
    // Test the configuration with AWS SDK v3
    const { HeadBucketCommand } = require('@aws-sdk/client-s3');
    s3Client.send(new HeadBucketCommand({ Bucket: process.env.S3_BUCKET_NAME }))
      .then(() => {
        console.log(`✅ S3 bucket test successful with AWS SDK v3`);
      })
      .catch((err) => {
        console.error('❌ S3 bucket test failed:', err.message);
      });
    
  } catch (error) {
    console.error('❌ Error configuring S3:', error.message);
    s3Client = null;
    s3 = null;
  }
}

// S3 bucket configuration
const S3_CONFIG = {
  bucketName: process.env.S3_BUCKET_NAME || 'tcg-application-portal-files',
  region: process.env.AWS_REGION || 'us-west-1',
  
  // File upload settings
  uploadSettings: {
    // Maximum file size (10MB)
    maxFileSize: 10 * 1024 * 1024,
    
    // Allowed file types
    allowedMimeTypes: [
      'application/pdf',
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ],
    
    // File path structure in S3
    paths: {
      resumes: 'resumes/',
      transcripts: 'transcripts/',
      images: 'images/',
      other: 'other/'
    }
  },
  
  // URL settings
  urlSettings: {
    // Use CloudFront CDN if configured
    useCloudFront: process.env.CLOUDFRONT_DOMAIN ? true : false,
    cloudFrontDomain: process.env.CLOUDFRONT_DOMAIN,
    
    // S3 direct URL expiration (for signed URLs)
    signedUrlExpiration: 3600, // 1 hour
  }
};

// Helper function to determine file type and S3 path
const getFileTypeAndPath = (fieldname, mimetype) => {
  let fileType, s3Path;
  
  switch (fieldname) {
    case 'resume':
      fileType = 'resume';
      s3Path = S3_CONFIG.uploadSettings.paths.resumes;
      break;
    case 'transcript':
      fileType = 'transcript';
      s3Path = S3_CONFIG.uploadSettings.paths.transcripts;
      break;
    case 'image':
      fileType = 'image';
      s3Path = S3_CONFIG.uploadSettings.paths.images;
      break;
    default:
      fileType = 'other';
      s3Path = S3_CONFIG.uploadSettings.paths.other;
  }
  
  return { fileType, s3Path };
};

// Helper function to generate S3 file URL
const getFileUrl = (s3Key) => {
  if (S3_CONFIG.urlSettings.useCloudFront && S3_CONFIG.urlSettings.cloudFrontDomain) {
    // Use CloudFront CDN URL
    return `https://${S3_CONFIG.urlSettings.cloudFrontDomain}/${s3Key}`;
  } else {
    // Use direct S3 URL
    return `https://${S3_CONFIG.bucketName}.s3.${S3_CONFIG.region}.amazonaws.com/${s3Key}`;
  }
};

// Helper function to generate signed URL for private files
const getSignedUrl = (s3Key, expiration = S3_CONFIG.urlSettings.signedUrlExpiration) => {
  return s3.getSignedUrl('getObject', {
    Bucket: S3_CONFIG.bucketName,
    Key: s3Key,
    Expires: expiration
  });
};

// Helper function to delete file from S3
const deleteFile = async (s3Key) => {
  try {
    await s3.deleteObject({
      Bucket: S3_CONFIG.bucketName,
      Key: s3Key
    }).promise();
    return true;
  } catch (error) {
    console.error('Error deleting file from S3:', error);
    return false;
  }
};

// Export the validation result
const isS3Available = () => isS3Configured;

module.exports = {
  s3, // Legacy S3 for multer-s3
  s3Client, // New S3 client for better region handling
  S3_CONFIG,
  getFileTypeAndPath,
  getFileUrl,
  getSignedUrl,
  deleteFile,
  isS3Configured: isS3Available
};
