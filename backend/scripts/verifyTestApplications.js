const mongoose = require('mongoose');
const Application = require('../models/Application');
require('dotenv').config();

// Script to verify and display test applications
const verifyTestApplications = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    // Get total count
    const totalCount = await Application.countDocuments();
    console.log(`\n📊 Total Applications in Database: ${totalCount}`);

    // Get recent applications (last 10)
    const recentApplications = await Application.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    console.log("\n🔍 Recent Applications Sample:");
    console.log("=" .repeat(80));

    recentApplications.forEach((app, index) => {
      console.log(`\n${index + 1}. ${app.fullName} (${app.email})`);
      console.log(`   Status: ${app.status}`);
      console.log(`   Major: ${app.major} | Year: ${app.studentYear} | Type: ${app.candidateType}`);
      console.log(`   Case Night Slots: ${app.caseNightPreferences.join(', ')}`);
      console.log(`   Applied Before: ${app.appliedBefore}`);
      console.log(`   Created: ${new Date(app.createdAt).toLocaleDateString()}`);
    });

    // Status distribution
    const statusPipeline = [
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ];
    const statusDistribution = await Application.aggregate(statusPipeline);

    console.log("\n📈 Status Distribution:");
    console.log("-" .repeat(40));
    statusDistribution.forEach(item => {
      console.log(`  ${item._id}: ${item.count}`);
    });

    // Candidate type distribution
    const typePipeline = [
      { $group: { _id: "$candidateType", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ];
    const typeDistribution = await Application.aggregate(typePipeline);

    console.log("\n👥 Candidate Type Distribution:");
    console.log("-" .repeat(40));
    typeDistribution.forEach(item => {
      console.log(`  ${item._id}: ${item.count}`);
    });

    // Student year distribution
    const yearPipeline = [
      { $group: { _id: "$studentYear", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ];
    const yearDistribution = await Application.aggregate(yearPipeline);

    console.log("\n🎓 Student Year Distribution:");
    console.log("-" .repeat(40));
    yearDistribution.forEach(item => {
      console.log(`  ${item._id}: ${item.count}`);
    });

    // Case night preferences
    const caseNightPipeline = [
      { $unwind: "$caseNightPreferences" },
      { $group: { _id: "$caseNightPreferences", count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ];
    const caseNightDistribution = await Application.aggregate(caseNightPipeline);

    console.log("\n🎯 Case Night Preferences:");
    console.log("-" .repeat(40));
    caseNightDistribution.forEach(item => {
      console.log(`  Slot ${item._id}: ${item.count} applications`);
    });

    // Applications with comments
    const applicationsWithComments = await Application.countDocuments({
      'comments.0': { $exists: true }
    });
    console.log(`\n💬 Applications with Comments: ${applicationsWithComments}`);

    // Applications with status history
    const applicationsWithStatusHistory = await Application.countDocuments({
      'statusHistory.0': { $exists: true }
    });
    console.log(`📝 Applications with Status History: ${applicationsWithStatusHistory}`);

    console.log("\n✅ Verification completed successfully!");

  } catch (error) {
    console.error("❌ Error verifying applications:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
};

// Run the verification script
console.log("🔍 Starting application verification...");
verifyTestApplications();
