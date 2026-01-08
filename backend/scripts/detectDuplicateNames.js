const mongoose = require('mongoose');
const Application = require('../models/Application');
require('dotenv').config();

const detectDuplicateNames = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    // Get command line arguments
    const args = process.argv.slice(2);
    const showDetails = args.includes('--details') || args.includes('-d');
    const exportCsv = args.includes('--export') || args.includes('-e');
    const caseSensitive = args.includes('--case-sensitive') || args.includes('-c');
    
    console.log(`\n🔍 Starting duplicate name detection...`);
    console.log(`Case sensitive: ${caseSensitive ? 'YES' : 'NO (default)'}`);
    console.log(`Show details: ${showDetails ? 'YES' : 'NO'}`);
    console.log(`Export CSV: ${exportCsv ? 'YES' : 'NO'}\n`);

    // Get all applications
    const applications = await Application.find().sort({ fullName: 1, createdAt: 1 });
    
    // Group applications by full name (case insensitive by default)
    const nameGroups = {};
    applications.forEach(app => {
      const nameKey = caseSensitive ? app.fullName : app.fullName.toLowerCase();
      if (!nameGroups[nameKey]) {
        nameGroups[nameKey] = [];
      }
      nameGroups[nameKey].push(app);
    });

    // Find duplicates (names with more than one application)
    const duplicates = {};
    Object.keys(nameGroups).forEach(nameKey => {
      if (nameGroups[nameKey].length > 1) {
        duplicates[nameKey] = nameGroups[nameKey];
      }
    });

    const duplicateNames = Object.keys(duplicates);
    
    if (duplicateNames.length === 0) {
      console.log("✅ No duplicate names found! All full names are unique.");
      return;
    }

    console.log(`📊 Found ${duplicateNames.length} duplicate names:\n`);

    // Display duplicates summary
    let totalDuplicates = 0;
    let csvData = [];
    
    duplicateNames.forEach(nameKey => {
      const apps = duplicates[nameKey];
      totalDuplicates += apps.length - 1; // -1 because we count duplicates, not total
      
      console.log(`👤 "${caseSensitive ? nameKey : apps[0].fullName}": ${apps.length} applications`);
      
      apps.forEach((app, index) => {
        const details = `${index + 1}. ${app.email} - ${app.status} (${app.createdAt.toISOString().split('T')[0]})`;
        console.log(`   ${details}`);
        
        // Prepare CSV data
        csvData.push({
          fullName: app.fullName,
          email: app.email,
          status: app.status,
          createdAt: app.createdAt.toISOString().split('T')[0],
          studentYear: app.studentYear,
          major: app.major,
          candidateType: app.candidateType,
          duplicateCount: apps.length
        });
      });
      console.log('');
    });

    console.log(`📈 Summary:`);
    console.log(`   - Duplicate names found: ${duplicateNames.length}`);
    console.log(`   - Total duplicate applications: ${totalDuplicates}`);
    console.log(`   - Total applications with duplicate names: ${duplicateNames.reduce((sum, name) => sum + duplicates[name].length, 0)}`);

    // Show detailed analysis if requested
    if (showDetails) {
      console.log(`\n📋 Detailed Analysis:`);
      
      // Analyze by status
      const statusAnalysis = {};
      duplicateNames.forEach(nameKey => {
        const apps = duplicates[nameKey];
        apps.forEach(app => {
          if (!statusAnalysis[app.status]) {
            statusAnalysis[app.status] = 0;
          }
          statusAnalysis[app.status]++;
        });
      });
      
      console.log(`   Status distribution:`);
      Object.keys(statusAnalysis).forEach(status => {
        console.log(`     ${status}: ${statusAnalysis[status]} applications`);
      });

      // Analyze by candidate type
      const candidateTypeAnalysis = {};
      duplicateNames.forEach(nameKey => {
        const apps = duplicates[nameKey];
        apps.forEach(app => {
          if (!candidateTypeAnalysis[app.candidateType]) {
            candidateTypeAnalysis[app.candidateType] = 0;
          }
          candidateTypeAnalysis[app.candidateType]++;
        });
      });
      
      console.log(`   Candidate type distribution:`);
      Object.keys(candidateTypeAnalysis).forEach(type => {
        console.log(`     ${type}: ${candidateTypeAnalysis[type]} applications`);
      });
    }

    // Export to CSV if requested
    if (exportCsv) {
      const fs = require('fs');
      const path = require('path');
      
      const csvHeader = 'Full Name,Email,Status,Created Date,Student Year,Major,Candidate Type,Duplicate Count\n';
      const csvContent = csvHeader + csvData.map(row => 
        `"${row.fullName}","${row.email}","${row.status}","${row.createdAt}","${row.studentYear}","${row.major}","${row.candidateType}",${row.duplicateCount}`
      ).join('\n');
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
      const filename = `duplicate-names-${timestamp}.csv`;
      const filepath = path.join(__dirname, '..', 'exports', filename);
      
      // Ensure exports directory exists
      const exportsDir = path.dirname(filepath);
      if (!fs.existsSync(exportsDir)) {
        fs.mkdirSync(exportsDir, { recursive: true });
      }
      
      fs.writeFileSync(filepath, csvContent);
      console.log(`\n📄 CSV exported to: ${filepath}`);
    }

    // Recommendations
    console.log(`\n💡 Recommendations:`);
    console.log(`   - Review these applications to determine if they are legitimate duplicates`);
    console.log(`   - Consider if applicants submitted multiple applications with different emails`);
    console.log(`   - Check if names are formatted differently (e.g., "John Smith" vs "Smith, John")`);
    console.log(`   - Verify if these are different people with the same name`);

  } catch (error) {
    console.error("❌ Error detecting duplicate names:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB");
  }
};

// Display usage information
const showUsage = () => {
  console.log("📖 Usage:");
  console.log("  node detectDuplicateNames.js [options]");
  console.log("");
  console.log("Options:");
  console.log("  --details, -d       Show detailed analysis (status, candidate type distribution)");
  console.log("  --export, -e        Export results to CSV file");
  console.log("  --case-sensitive, -c Use case-sensitive name comparison");
  console.log("  --help, -h          Show this help message");
  console.log("");
  console.log("Examples:");
  console.log("  node detectDuplicateNames.js");
  console.log("  node detectDuplicateNames.js --details");
  console.log("  node detectDuplicateNames.js --export --details");
  console.log("  node detectDuplicateNames.js --case-sensitive");
  console.log("");
  console.log("📝 Notes:");
  console.log("  - By default, name comparison is case-insensitive");
  console.log("  - CSV files are exported to the backend/exports/ directory");
  console.log("  - This script only detects duplicates, it does not modify data");
};

// Check if help is requested
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  showUsage();
  process.exit(0);
}

// Run the script
detectDuplicateNames();





