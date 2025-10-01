const AWS = require('aws-sdk');
require('dotenv').config();

// Configure AWS SDK
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-west-2'
});

// Create S3 instance
const s3 = new AWS.S3();

// S3 bucket configuration
const S3_CONFIG = {
  bucketName: process.env.S3_BUCKET_NAME || 'tcg-application-portal-files',
  region: process.env.AWS_REGION || 'us-west-2',
  
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

// Helper function to check if S3 is properly configured
const isS3Configured = () => {
  return !!(
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.S3_BUCKET_NAME
  );
};

module.exports = {
  s3,
  S3_CONFIG,
  getFileTypeAndPath,
  getFileUrl,
  getSignedUrl,
  deleteFile,
  isS3Configured
};
