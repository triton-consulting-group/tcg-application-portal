const mongoose = require('mongoose');
const Application = require('../models/Application');
require('dotenv').config();

const deleteApplication = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    // Get command line arguments
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
      console.log("Usage: node deleteApplication.js <email>");
      console.log("Example: node deleteApplication.js test@example.com");
      return;
    }

    const email = args[0];
    
    // Find application by email
    const application = await Application.findOne({ email: email });
    
    if (!application) {
      console.log(`❌ No application found for email: ${email}`);
      return;
    }

    console.log(`📋 Found application for: ${application.fullName} (${application.email})`);
    console.log(`📅 Submitted: ${application.createdAt}`);
    console.log(`📊 Status: ${application.status}`);
    
    // Delete the application
    await Application.findByIdAndDelete(application._id);
    
    console.log(`✅ Application deleted successfully for: ${email}`);
    
  } catch (error) {
    console.error("❌ Error deleting application:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
};

// Run the script
deleteApplication();


