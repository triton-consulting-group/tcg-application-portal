const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const AWS = require('aws-sdk');
const Application = require('../models/Application');
const { s3, S3_CONFIG, isS3Configured } = require('../config/s3Config');
require('dotenv').config();

// Script to migrate existing local files to S3
const migrateFilesToS3 = async () => {
  try {
    // Check if S3 is configured
    if (!isS3Configured()) {
      console.log('❌ S3 is not configured. Please configure AWS credentials first.');
      console.log('See backend/docs/S3_CONFIGURATION.md for setup instructions.');
      return;
    }

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Get all applications with file paths
    const applications = await Application.find({
      $or: [
        { resume: { $exists: true, $ne: null } },
        { transcript: { $exists: true, $ne: null } },
        { image: { $exists: true, $ne: null } }
      ]
    });

    console.log(`\n📁 Found ${applications.length} applications with files to migrate`);

    let migratedCount = 0;
    let errorCount = 0;

    for (const app of applications) {
      console.log(`\n🔄 Processing application: ${app.fullName} (${app.email})`);

      // Process resume
      if (app.resume && app.resume.startsWith('/uploads/')) {
        const result = await migrateFile(app.resume, 'resume', app.email);
        if (result.success) {
          app.resume = result.s3Url;
          migratedCount++;
        } else {
          errorCount++;
        }
      }

      // Process transcript
      if (app.transcript && app.transcript.startsWith('/uploads/')) {
        const result = await migrateFile(app.transcript, 'transcript', app.email);
        if (result.success) {
          app.transcript = result.s3Url;
          migratedCount++;
        } else {
          errorCount++;
        }
      }

      // Process image
      if (app.image && app.image.startsWith('/uploads/')) {
        const result = await migrateFile(app.image, 'image', app.email);
        if (result.success) {
          app.image = result.s3Url;
          migratedCount++;
        } else {
          errorCount++;
        }
      }

      // Save updated application
      await app.save();
      console.log(`✅ Updated application: ${app.email}`);
    }

    console.log('\n📊 Migration Summary:');
    console.log(`✅ Files migrated successfully: ${migratedCount}`);
    console.log(`❌ Files with errors: ${errorCount}`);
    console.log(`📁 Applications processed: ${applications.length}`);

  } catch (error) {
    console.error('❌ Migration error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

// Helper function to migrate a single file
const migrateFile = async (filePath, fileType, userEmail) => {
  try {
    const localFilePath = path.join(__dirname, '..', filePath);
    
    // Check if local file exists
    if (!fs.existsSync(localFilePath)) {
      console.log(`⚠️ Local file not found: ${filePath}`);
      return { success: false, error: 'File not found' };
    }

    // Read file
    const fileContent = fs.readFileSync(localFilePath);
    const fileName = path.basename(filePath);
    
    // Determine S3 path based on file type
    let s3Path;
    switch (fileType) {
      case 'resume':
        s3Path = S3_CONFIG.uploadSettings.paths.resumes;
        break;
      case 'transcript':
        s3Path = S3_CONFIG.uploadSettings.paths.transcripts;
        break;
      case 'image':
        s3Path = S3_CONFIG.uploadSettings.paths.images;
        break;
      default:
        s3Path = S3_CONFIG.uploadSettings.paths.other;
    }

    // Generate S3 key
    const timestamp = Date.now();
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const s3Key = `${s3Path}migrated-${timestamp}-${sanitizedName}`;

    // Upload to S3
    const uploadParams = {
      Bucket: S3_CONFIG.bucketName,
      Key: s3Key,
      Body: fileContent,
      ContentType: getContentType(fileName)
    };

    await s3.upload(uploadParams).promise();
    
    // Generate S3 URL
    const s3Url = `https://${S3_CONFIG.bucketName}.s3.${S3_CONFIG.region}.amazonaws.com/${s3Key}`;
    
    console.log(`✅ Migrated ${fileType}: ${fileName} -> ${s3Key}`);
    
    return { success: true, s3Url: s3Url };

  } catch (error) {
    console.error(`❌ Error migrating ${fileType}:`, error.message);
    return { success: false, error: error.message };
  }
};

// Helper function to determine content type
const getContentType = (fileName) => {
  const ext = path.extname(fileName).toLowerCase();
  const contentTypes = {
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  };
  return contentTypes[ext] || 'application/octet-stream';
};

// Run migration
console.log('🚀 Starting file migration to S3...');
migrateFilesToS3();
