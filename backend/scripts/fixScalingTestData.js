const mongoose = require("mongoose");
const Application = require("../models/Application");
const CASE_NIGHT_CONFIG = require("../config/caseNightConfig");
require("dotenv").config();

// Mapping for incorrect candidateType values to correct ones
const CANDIDATE_TYPE_MAPPING = {
  "Full-time": "Tech",
  "Part-time": "Non-Tech", 
  "Intern": "Tech",
  "Contractor": "Non-Tech"
};

// Case night time slots
const CASE_NIGHT_SLOTS = Object.keys(CASE_NIGHT_CONFIG.slots); // ["A", "B", "C"]

const fixScalingTestData = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    // Find applications that need fixing (applications with incorrect candidateType values)
    const scalingTestApplications = await Application.find({
      candidateType: { $in: ["Full-time", "Part-time", "Intern", "Contractor"] }
    });

    console.log(`\n🔍 Found ${scalingTestApplications.length} scaling test applications to fix`);

    if (scalingTestApplications.length === 0) {
      console.log("✅ No scaling test applications found to fix");
      return;
    }

    let fixedCount = 0;
    let skippedCount = 0;
    const changes = [];

    for (const application of scalingTestApplications) {
      let needsUpdate = false;
      const updates = {};

      // Fix candidateType if it's incorrect
      if (CANDIDATE_TYPE_MAPPING[application.candidateType]) {
        const oldType = application.candidateType;
        const newType = CANDIDATE_TYPE_MAPPING[application.candidateType];
        updates.candidateType = newType;
        changes.push(`- ${application.email}: candidateType "${oldType}" → "${newType}"`);
        needsUpdate = true;
      }

      // Add case night preferences if missing
      if (!application.caseNightPreferences || application.caseNightPreferences.length === 0) {
        // Randomly select 1-3 slots
        const numSlots = Math.floor(Math.random() * 3) + 1; // 1, 2, or 3
        const shuffledSlots = [...CASE_NIGHT_SLOTS].sort(() => Math.random() - 0.5);
        const selectedSlots = shuffledSlots.slice(0, numSlots).sort();
        
        updates.caseNightPreferences = selectedSlots;
        changes.push(`- ${application.email}: Added case night preferences: [${selectedSlots.join(', ')}]`);
        needsUpdate = true;
      }

      if (needsUpdate) {
        await Application.findByIdAndUpdate(application._id, updates);
        fixedCount++;
      } else {
        skippedCount++;
      }
    }

    // Show summary
    console.log(`\n📊 Migration Summary:`);
    console.log(`- Applications processed: ${scalingTestApplications.length}`);
    console.log(`- Applications fixed: ${fixedCount}`);
    console.log(`- Applications skipped (already correct): ${skippedCount}`);

    if (changes.length > 0) {
      console.log(`\n🔧 Changes Made:`);
      changes.forEach(change => console.log(change));
    }

    // Verify the fixes
    console.log(`\n🔍 Verification:`);
    const verificationResults = await Application.aggregate([
      {
        $match: {
          candidateType: { $in: ["Tech", "Non-Tech"] }
        }
      },
      {
        $group: {
          _id: "$candidateType",
          count: { $sum: 1 },
          withCaseNightPrefs: {
            $sum: {
              $cond: [
                { $and: [
                  { $isArray: "$caseNightPreferences" },
                  { $gt: [{ $size: "$caseNightPreferences" }, 0] }
                ]},
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    console.log(`\n📈 Current Distribution:`);
    verificationResults.forEach(result => {
      console.log(`- ${result._id}: ${result.count} applications (${result.withCaseNightPrefs} with case night preferences)`);
    });

    // Show case night preference distribution
    const caseNightStats = await Application.aggregate([
      {
        $match: {
          candidateType: { $in: ["Tech", "Non-Tech"] },
          caseNightPreferences: { $exists: true, $ne: [] }
        }
      },
      {
        $unwind: "$caseNightPreferences"
      },
      {
        $group: {
          _id: "$caseNightPreferences",
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    if (caseNightStats.length > 0) {
      console.log(`\n🎯 Case Night Preference Distribution:`);
      caseNightStats.forEach(stat => {
        const slotName = CASE_NIGHT_CONFIG.slots[stat._id];
        console.log(`- ${stat._id} (${slotName}): ${stat.count} preferences`);
      });
    }

    console.log(`\n✅ Migration completed successfully!`);

  } catch (error) {
    console.error("❌ Error during migration:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
};

// Run the script
fixScalingTestData();
