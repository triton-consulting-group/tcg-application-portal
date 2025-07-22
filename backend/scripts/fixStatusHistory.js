const mongoose = require("mongoose");
const Application = require("../models/Application");
require("dotenv").config();

const fixStatusHistory = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    const applications = await Application.find({});
    
    for (const app of applications) {
      console.log(`Processing application: ${app.email}`);
      console.log(`Current status: ${app.status}`);
      console.log(`Status history count: ${app.statusHistory ? app.statusHistory.length : 0}`);
      
      // If no status history exists, create initial entry
      if (!app.statusHistory || app.statusHistory.length === 0) {
        const statusHistoryEntry = {
          status: app.status,
          changedBy: "System Migration",
          changedAt: app.createdAt || new Date(),
          notes: "Initial status from system migration"
        };

        await Application.findByIdAndUpdate(app._id, {
          $set: { statusHistory: [statusHistoryEntry] }
        });

        console.log(`✅ Added initial status history for: ${app.email}`);
      } 
      // If status history exists but doesn't match current status, add current status
      else {
        const lastEntry = app.statusHistory[app.statusHistory.length - 1];
        if (lastEntry.status !== app.status) {
          const newEntry = {
            status: app.status,
            changedBy: "System Migration",
            changedAt: new Date(),
            notes: `Status updated to ${app.status} during system migration`
          };

          await Application.findByIdAndUpdate(app._id, {
            $push: { statusHistory: newEntry }
          });

          console.log(`✅ Added current status to history for: ${app.email}`);
        } else {
          console.log(`✅ Status history is up to date for: ${app.email}`);
        }
      }
    }

    console.log("✅ Status history fix completed successfully!");

  } catch (error) {
    console.error("❌ Error fixing status history:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
};

// Run the script
fixStatusHistory(); 