const mongoose = require("mongoose");
const Application = require("../models/Application");
require("dotenv").config();

const addStatusHistory = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    // Find applications without statusHistory
    const applications = await Application.find({ statusHistory: { $exists: false } });
    
    if (applications.length === 0) {
      console.log("All applications already have status history!");
      return;
    }

    console.log(`Found ${applications.length} applications without status history`);

    for (const app of applications) {
      // Create initial status history entry
      const statusHistoryEntry = {
        status: app.status,
        changedBy: "System Migration",
        changedAt: app.createdAt || new Date(),
        notes: "Initial status from system migration"
      };

      // Update the application
      await Application.findByIdAndUpdate(app._id, {
        $set: { statusHistory: [statusHistoryEntry] }
      });

      console.log(`✅ Added status history to application: ${app.email}`);
    }

    console.log("✅ Status history migration completed successfully!");

  } catch (error) {
    console.error("❌ Error adding status history:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
};

// Run the script
addStatusHistory(); 