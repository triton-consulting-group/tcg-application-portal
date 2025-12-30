const mongoose = require('mongoose');
const Application = require('../models/Application');
require('dotenv').config();

// Script to fix broken file links in existing applications
const fixBrokenFileLinks = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Find applications with broken file links
    const applications = await Application.find({
      $or: [
        { resume: { $regex: /^\/uploads\/.*\.(pdf|doc|docx)$/ } },
        { transcript: { $regex: /^\/uploads\/.*\.(pdf|doc|docx)$/ } },
        { image: { $regex: /^\/uploads\/.*\.(jpg|jpeg|png|gif)$/ } }
      ]
    });

    console.log(`\n🔧 Found ${applications.length} applications with broken file links`);

    let fixedCount = 0;

    for (const app of applications) {
      console.log(`\n🔄 Fixing application: ${app.fullName} (${app.email})`);
      
      let updated = false;

      // Fix resume link
      if (app.resume && app.resume.startsWith('/uploads/')) {
        app.resume = null; // Set to null for missing files
        updated = true;
        console.log(`  ❌ Resume file missing - set to null`);
      }

      // Fix transcript link
      if (app.transcript && app.transcript.startsWith('/uploads/')) {
        app.transcript = null; // Set to null for missing files
        updated = true;
        console.log(`  ❌ Transcript file missing - set to null`);
      }

      // Fix image link
      if (app.image && app.image.startsWith('/uploads/')) {
        app.image = null; // Set to null for missing files
        updated = true;
        console.log(`  ❌ Image file missing - set to null`);
      }

      if (updated) {
        await app.save();
        fixedCount++;
        console.log(`  ✅ Application updated`);
      }
    }

    console.log('\n📊 Fix Summary:');
    console.log(`✅ Applications fixed: ${fixedCount}`);
    console.log(`📁 Total applications processed: ${applications.length}`);

    console.log('\n💡 Note: Missing files have been set to null.');
    console.log('   Users can re-upload files when editing their applications.');

  } catch (error) {
    console.error('❌ Fix failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

console.log('🔧 Starting broken file link fix...');
fixBrokenFileLinks();
