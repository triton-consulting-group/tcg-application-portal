const mongoose = require("mongoose");
const Application = require("../models/Application");
const CaseGroupAssignment = require("../models/CaseGroupAssignment");
const CASE_NIGHT_CONFIG = require("../config/caseNightConfig");
const path = require("path");

// Load environment variables - support production mode
const envFile = process.argv.includes('--production') ? 'production.env' : '.env';
require("dotenv").config({ path: path.join(__dirname, '..', envFile) });

const assignCaseGroups = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    // Clear existing assignments
    const deleteResult = await CaseGroupAssignment.deleteMany({});
    console.log(`🗑️  Cleared ${deleteResult.deletedCount} existing assignments`);

    // Get all applications with case night preferences
    const applications = await Application.find({
      caseNightPreferences: { $exists: true, $ne: [], $not: { $size: 0 } },
      candidateType: { $in: ["Tech", "Non-Tech"] }
    }).sort({ createdAt: 1 });

    console.log(`\n📊 Found ${applications.length} applications with case night preferences`);

    if (applications.length === 0) {
      console.log("No applications to assign");
      return;
    }

    // Separate by candidate type
    const techApplications = applications.filter(app => app.candidateType === "Tech");
    const nonTechApplications = applications.filter(app => app.candidateType === "Non-Tech");

    console.log(`- Tech candidates: ${techApplications.length}`);
    console.log(`- Non-Tech candidates: ${nonTechApplications.length}`);

    const assignments = [];

    // Function to assign applications to groups
    const assignToGroups = (applications, candidateType) => {
      const slotAssignments = { A: [], B: [], C: [] };
      
      // First pass: assign based on preferences
      applications.forEach(app => {
        let assigned = false;
        
        // Try to assign to preferred slots
        for (const preference of app.caseNightPreferences) {
          if (slotAssignments[preference]) {
            slotAssignments[preference].push(app);
            assigned = true;
            break;
          }
        }
        
        // If not assigned to preferred slots, assign to any available slot
        if (!assigned) {
          // Find slot with least people
          let minSlot = 'A';
          let minCount = slotAssignments['A'].length;
          
          if (slotAssignments['B'].length < minCount) {
            minSlot = 'B';
            minCount = slotAssignments['B'].length;
          }
          if (slotAssignments['C'].length < minCount) {
            minSlot = 'C';
          }
          
          slotAssignments[minSlot].push(app);
        }
      });
      
      // Now create proper groups of 4
      Object.entries(slotAssignments).forEach(([slot, slotApps]) => {
        // Group applications into groups of 4
        for (let i = 0; i < slotApps.length; i += CASE_NIGHT_CONFIG.groupSize) {
          const groupMembers = slotApps.slice(i, i + CASE_NIGHT_CONFIG.groupSize);
          const groupNumber = Math.floor(i / CASE_NIGHT_CONFIG.groupSize) + 1;
          
          groupMembers.forEach((application) => {
            const assignment = {
              applicationId: application._id,
              applicantName: application.fullName,
              applicantEmail: application.email,
              candidateType: candidateType,
              timeSlot: slot,
              timeSlotDisplay: CASE_NIGHT_CONFIG.slots[slot],
              groupNumber: groupNumber,
              groupId: `${slot}-${groupNumber}`,
              assignedBy: "system",
              status: "Assigned"
            };
            assignments.push(assignment);
          });
        }
      });
    };

    // Assign Tech candidates
    console.log(`\n🔧 Assigning Tech candidates...`);
    assignToGroups(techApplications, "Tech");
    
    // Assign Non-Tech candidates
    console.log(`🔧 Assigning Non-Tech candidates...`);
    assignToGroups(nonTechApplications, "Non-Tech");

    // Insert assignments into database
    if (assignments.length > 0) {
      const result = await CaseGroupAssignment.insertMany(assignments);
      console.log(`✅ Successfully created ${result.length} case group assignments`);
    }

    // Generate summary report
    console.log(`\n📈 Assignment Summary:`);
    
    const summary = await CaseGroupAssignment.aggregate([
      {
        $group: {
          _id: {
            candidateType: "$candidateType",
            timeSlot: "$timeSlot"
          },
          count: { $sum: 1 },
          groups: { $addToSet: "$groupNumber" }
        }
      },
      {
        $sort: { "_id.candidateType": 1, "_id.timeSlot": 1 }
      }
    ]);

    summary.forEach(stat => {
      const slotName = CASE_NIGHT_CONFIG.slots[stat._id.timeSlot];
      const groupCount = stat.groups.length;
      console.log(`- ${stat._id.candidateType} ${slotName}: ${stat.count} people in ${groupCount} groups`);
    });

    // Show group distribution
    console.log(`\n👥 Group Distribution:`);
    const groupStats = await CaseGroupAssignment.aggregate([
      {
        $group: {
          _id: {
            candidateType: "$candidateType",
            timeSlot: "$timeSlot",
            groupNumber: "$groupNumber"
          },
          members: { $push: "$applicantName" }
        }
      },
      {
        $sort: { "_id.candidateType": 1, "_id.timeSlot": 1, "_id.groupNumber": 1 }
      }
    ]);

    groupStats.forEach(group => {
      const slotName = CASE_NIGHT_CONFIG.slots[group._id.timeSlot];
      console.log(`- ${group._id.candidateType} ${slotName} Group ${group._id.groupNumber}: ${group.members.length} members`);
    });

    console.log(`\n✅ Case group assignment completed successfully!`);

  } catch (error) {
    console.error("❌ Error assigning case groups:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
};

// Run the script
assignCaseGroups();
