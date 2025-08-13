const mongoose = require("mongoose");
const Application = require("../models/Application");
require("dotenv").config();

const testApplications = [
  // Tech candidates with various case night preferences
  {
    email: "tech1@test.com",
    fullName: "Alex Chen",
    studentYear: "3rd",
    major: "Computer Science",
    appliedBefore: "No",
    candidateType: "Tech",
    reason: "Interested in consulting and problem-solving",
    caseNightPreferences: ["A", "B"],
    status: "Under Review"
  },
  {
    email: "tech2@test.com",
    fullName: "Sarah Kim",
    studentYear: "2nd",
    major: "Data Science",
    appliedBefore: "Yes",
    candidateType: "Tech",
    reason: "Want to develop analytical skills",
    caseNightPreferences: ["B", "C"],
    status: "Under Review"
  },
  {
    email: "tech3@test.com",
    fullName: "Mike Johnson",
    studentYear: "4th",
    major: "Computer Engineering",
    appliedBefore: "No",
    candidateType: "Tech",
    reason: "Looking for real-world project experience",
    caseNightPreferences: ["A"],
    status: "Under Review"
  },
  {
    email: "tech4@test.com",
    fullName: "Emily Davis",
    studentYear: "3rd",
    major: "Information Systems",
    appliedBefore: "Yes",
    candidateType: "Tech",
    reason: "Passionate about technology consulting",
    caseNightPreferences: ["A", "B", "C"],
    status: "Under Review"
  },
  {
    email: "tech5@test.com",
    fullName: "David Wang",
    studentYear: "2nd",
    major: "Computer Science",
    appliedBefore: "No",
    candidateType: "Tech",
    reason: "Want to work on challenging problems",
    caseNightPreferences: ["C"],
    status: "Under Review"
  },
  {
    email: "tech6@test.com",
    fullName: "Lisa Rodriguez",
    studentYear: "4th",
    major: "Data Science",
    appliedBefore: "Yes",
    candidateType: "Tech",
    reason: "Interested in business analytics",
    caseNightPreferences: ["B"],
    status: "Under Review"
  },
  {
    email: "tech7@test.com",
    fullName: "James Wilson",
    studentYear: "3rd",
    major: "Computer Engineering",
    appliedBefore: "No",
    candidateType: "Tech",
    reason: "Want to apply technical skills to business problems",
    caseNightPreferences: ["A", "C"],
    status: "Under Review"
  },
  {
    email: "tech8@test.com",
    fullName: "Rachel Green",
    studentYear: "2nd",
    major: "Information Systems",
    appliedBefore: "Yes",
    candidateType: "Tech",
    reason: "Looking for consulting experience",
    caseNightPreferences: ["B", "C"],
    status: "Under Review"
  },
  {
    email: "tech9@test.com",
    fullName: "Tom Brown",
    studentYear: "4th",
    major: "Computer Science",
    appliedBefore: "No",
    candidateType: "Tech",
    reason: "Interested in problem-solving and teamwork",
    caseNightPreferences: ["A", "B"],
    status: "Under Review"
  },
  {
    email: "tech10@test.com",
    fullName: "Amanda Lee",
    studentYear: "3rd",
    major: "Data Science",
    appliedBefore: "Yes",
    candidateType: "Tech",
    reason: "Want to develop analytical and communication skills",
    caseNightPreferences: ["C"],
    status: "Under Review"
  },
  {
    email: "tech11@test.com",
    fullName: "Chris Martinez",
    studentYear: "2nd",
    major: "Computer Engineering",
    appliedBefore: "No",
    candidateType: "Tech",
    reason: "Looking for real-world application of technical skills",
    caseNightPreferences: ["A", "B", "C"],
    status: "Under Review"
  },
  {
    email: "tech12@test.com",
    fullName: "Jessica Taylor",
    studentYear: "4th",
    major: "Information Systems",
    appliedBefore: "Yes",
    candidateType: "Tech",
    reason: "Interested in technology consulting",
    caseNightPreferences: ["B"],
    status: "Under Review"
  },

  // Non-Tech candidates with various case night preferences
  {
    email: "nontech1@test.com",
    fullName: "Maria Garcia",
    studentYear: "3rd",
    major: "Business Administration",
    appliedBefore: "No",
    candidateType: "Non-Tech",
    reason: "Interested in business strategy and consulting",
    caseNightPreferences: ["A", "B"],
    status: "Under Review"
  },
  {
    email: "nontech2@test.com",
    fullName: "Ryan Thompson",
    studentYear: "2nd",
    major: "Economics",
    appliedBefore: "Yes",
    candidateType: "Non-Tech",
    reason: "Want to develop analytical and problem-solving skills",
    caseNightPreferences: ["B", "C"],
    status: "Under Review"
  },
  {
    email: "nontech3@test.com",
    fullName: "Sophie Anderson",
    studentYear: "4th",
    major: "Psychology",
    appliedBefore: "No",
    candidateType: "Non-Tech",
    reason: "Interested in understanding human behavior in business",
    caseNightPreferences: ["A"],
    status: "Under Review"
  },
  {
    email: "nontech4@test.com",
    fullName: "Kevin Zhang",
    studentYear: "3rd",
    major: "Finance",
    appliedBefore: "Yes",
    candidateType: "Non-Tech",
    reason: "Looking for consulting experience in financial analysis",
    caseNightPreferences: ["A", "B", "C"],
    status: "Under Review"
  },
  {
    email: "nontech5@test.com",
    fullName: "Natalie White",
    studentYear: "2nd",
    major: "Marketing",
    appliedBefore: "No",
    candidateType: "Non-Tech",
    reason: "Want to develop strategic thinking skills",
    caseNightPreferences: ["C"],
    status: "Under Review"
  },
  {
    email: "nontech6@test.com",
    fullName: "Daniel Clark",
    studentYear: "4th",
    major: "International Relations",
    appliedBefore: "Yes",
    candidateType: "Non-Tech",
    reason: "Interested in global business consulting",
    caseNightPreferences: ["B"],
    status: "Under Review"
  },
  {
    email: "nontech7@test.com",
    fullName: "Olivia Miller",
    studentYear: "3rd",
    major: "Communications",
    appliedBefore: "No",
    candidateType: "Non-Tech",
    reason: "Want to develop communication and analysis skills",
    caseNightPreferences: ["A", "C"],
    status: "Under Review"
  },
  {
    email: "nontech8@test.com",
    fullName: "Brandon Lewis",
    studentYear: "2nd",
    major: "Political Science",
    appliedBefore: "Yes",
    candidateType: "Non-Tech",
    reason: "Interested in policy consulting and analysis",
    caseNightPreferences: ["B", "C"],
    status: "Under Review"
  },
  {
    email: "nontech9@test.com",
    fullName: "Hannah Wright",
    studentYear: "4th",
    major: "Sociology",
    appliedBefore: "No",
    candidateType: "Non-Tech",
    reason: "Want to apply social research to business problems",
    caseNightPreferences: ["A", "B"],
    status: "Under Review"
  },
  {
    email: "nontech10@test.com",
    fullName: "Jordan Hall",
    studentYear: "3rd",
    major: "Business Economics",
    appliedBefore: "Yes",
    candidateType: "Non-Tech",
    reason: "Looking for consulting experience in economic analysis",
    caseNightPreferences: ["C"],
    status: "Under Review"
  },
  {
    email: "nontech11@test.com",
    fullName: "Avery Scott",
    studentYear: "2nd",
    major: "Public Policy",
    appliedBefore: "No",
    candidateType: "Non-Tech",
    reason: "Interested in policy analysis and consulting",
    caseNightPreferences: ["A", "B", "C"],
    status: "Under Review"
  },
  {
    email: "nontech12@test.com",
    fullName: "Logan Young",
    studentYear: "4th",
    major: "Business Administration",
    appliedBefore: "Yes",
    candidateType: "Non-Tech",
    reason: "Want to develop strategic consulting skills",
    caseNightPreferences: ["B"],
    status: "Under Review"
  }
];

const populateTestData = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    // Clear existing test applications (optional - comment out if you want to keep existing)
    const deleteResult = await Application.deleteMany({
      email: { $regex: /@test\.com$/ }
    });
    console.log(`🗑️  Deleted ${deleteResult.deletedCount} existing test applications`);

    // Insert test applications
    const result = await Application.insertMany(testApplications);
    console.log(`✅ Successfully inserted ${result.length} test applications`);

    // Show summary
    const techCount = result.filter(app => app.candidateType === "Tech").length;
    const nonTechCount = result.filter(app => app.candidateType === "Non-Tech").length;
    
    console.log(`\n📊 Summary:`);
    console.log(`- Tech candidates: ${techCount}`);
    console.log(`- Non-Tech candidates: ${nonTechCount}`);
    console.log(`- Total applications: ${result.length}`);

    // Show case night preference distribution
    const preferenceStats = {};
    result.forEach(app => {
      const key = app.caseNightPreferences.sort().join(',');
      preferenceStats[key] = (preferenceStats[key] || 0) + 1;
    });

    console.log(`\n🎯 Case Night Preference Distribution:`);
    Object.entries(preferenceStats).forEach(([prefs, count]) => {
      const slotNames = prefs.split(',').map(slot => {
        const config = require("../config/caseNightConfig");
        return config.slots[slot];
      }).join(', ');
      console.log(`- ${slotNames}: ${count} applicants`);
    });

  } catch (error) {
    console.error("❌ Error populating test data:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
};

// Run the script
populateTestData(); 