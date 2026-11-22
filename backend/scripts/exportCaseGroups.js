const mongoose = require("mongoose");
const { listAssignments } = require("../services/caseGroupStore");
const { getActiveCycle } = require("../config/cycleConfig");
const Application = require("../models/Application");
const fs = require("fs");
const path = require("path");

// Load environment variables - support production mode
const envFile = process.argv.includes('--production') ? 'production.env' : '.env';
require("dotenv").config({ path: path.join(__dirname, '..', envFile) });

const exportCaseGroups = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    // Get all case group assignments
    const assignments = await listAssignments(getActiveCycle());

    console.log(`\n📊 Found ${assignments.length} case group assignments`);

    if (assignments.length === 0) {
      console.log("No assignments to export");
      return;
    }

    // Create CSV content
    const csvHeaders = [
      'Candidate Type',
      'Time Slot',
      'Group Number',
      'Group ID',
      'Applicant Name',
      'Email',
      'Major',
      'Student Year',
      'Applied Before',
      'Status',
      'Assigned At'
    ];

    const csvRows = [csvHeaders.join(',')];

    assignments.forEach(assignment => {
      const row = [
        assignment.candidateType,
        assignment.timeSlotDisplay,
        assignment.groupNumber,
        assignment.groupId,
        `"${assignment.applicantName}"`, // Wrap in quotes to handle commas in names
        assignment.applicantEmail,
        `"${assignment.applicationId?.major || ''}"`,
        assignment.applicationId?.studentYear || '',
        assignment.applicationId?.appliedBefore || '',
        assignment.status,
        new Date(assignment.assignedAt).toLocaleString()
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
    const filename = `case-group-assignments-${timestamp}.csv`;
    const filepath = path.join(exportsDir, filename);

    // Write CSV file
    fs.writeFileSync(filepath, csvRows.join('\n'));
    console.log(`\n✅ Exported to: ${filepath}`);

    // Generate summary
    console.log(`\n📈 Export Summary:`);
    
    console.log(`Cycle: ${getActiveCycle()}`);

    // Show file size
    const stats = fs.statSync(filepath);
    const fileSizeInKB = (stats.size / 1024).toFixed(2);
    console.log(`\n📁 File size: ${fileSizeInKB} KB`);

    console.log(`\n💡 You can now open this file in Excel, Google Sheets, or any spreadsheet application!`);

  } catch (error) {
    console.error("❌ Error exporting case groups:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
};

// Run the script
exportCaseGroups();
