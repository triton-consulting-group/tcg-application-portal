const mongoose = require("mongoose");
const Application = require("../models/Application");
require("dotenv").config();

const checkApplications = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    // Get all applications
    const applications = await Application.find();
    
    console.log(`\n📊 Found ${applications.length} applications in database:\n`);
    
    applications.forEach((app, index) => {
      console.log(`--- Application ${index + 1} ---`);
      console.log(`Email: ${app.email}`);
      console.log(`Name: ${app.fullName}`);
      console.log(`Case Night Preferences: ${JSON.stringify(app.caseNightPreferences)}`);
      console.log(`Status: ${app.status}`);
      console.log(`Created: ${app.createdAt}`);
      console.log(""); // Empty line for readability
    });

  } catch (error) {
    console.error("❌ Error checking applications:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
};

// Run the script
checkApplications(); 