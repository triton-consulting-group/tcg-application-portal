const mongoose = require("mongoose");
const Application = require("../models/Application");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const exportAllApplicants = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    // Get all applications
    const applications = await Application.find()
      .sort({ createdAt: -1 }); // Most recent first

    console.log(`\n📊 Found ${applications.length} applications in database`);

    if (applications.length === 0) {
      console.log("No applications to export");
      return;
    }

    // Create CSV content
    const csvHeaders = [
      'Name',
      'Email',
      'Major',
      'Student Year',
      'Candidate Type',
      'Case Night Preferences',
      'Status',
      'Applied Before',
      'Created Date',
      'Updated Date'
    ];

    const csvRows = [csvHeaders.join(',')];

    applications.forEach(app => {
      const row = [
        `"${app.fullName || ''}"`, // Wrap in quotes to handle commas in names
        app.email || '',
        `"${app.major || ''}"`,
        app.studentYear || '',
        app.candidateType || '',
        `"${(app.caseNightPreferences || []).join(',')}"`,
        app.status || '',
        app.appliedBefore || '',
        new Date(app.createdAt).toLocaleString(),
        new Date(app.updatedAt).toLocaleString()
      ];
      csvRows.push(row.join(','));
    });

    // Create exports directory if it doesn't exist
    const exportsDir = path.join(__dirname, '../exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const filename = `all-applicants-${timestamp}.csv`;
    const filepath = path.join(exportsDir, filename);

    // Write CSV file
    fs.writeFileSync(filepath, csvRows.join('\n'));
    console.log(`\n✅ Exported to: ${filepath}`);

    // Generate summary
    console.log(`\n📈 Export Summary:`);
    
    const statusSummary = await Application.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    console.log("\n📊 Applications by Status:");
    statusSummary.forEach(stat => {
      console.log(`- ${stat._id || 'No Status'}: ${stat.count} applications`);
    });

    const candidateTypeSummary = await Application.aggregate([
      {
        $group: {
          _id: "$candidateType",
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    console.log("\n👥 Applications by Candidate Type:");
    candidateTypeSummary.forEach(stat => {
      console.log(`- ${stat._id || 'No Type'}: ${stat.count} applications`);
    });

    // Show file size
    const stats = fs.statSync(filepath);
    const fileSizeInKB = (stats.size / 1024).toFixed(2);
    console.log(`\n📁 File size: ${fileSizeInKB} KB`);

    console.log(`\n💡 You can now open this file in Excel, Google Sheets, or any spreadsheet application!`);

  } catch (error) {
    console.error("❌ Error exporting applications:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
};

// Run the script
exportAllApplicants();
