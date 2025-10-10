const mongoose = require('mongoose');
const Application = require('../models/Application');
require('dotenv').config();

const deleteDuplicateApplications = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    // Get command line arguments
    const args = process.argv.slice(2);
    const isDryRun = args.includes('--dry-run') || args.includes('-d');
    const forceMode = args.includes('--force') || args.includes('-f');
    
    console.log(`\n🔍 Starting duplicate application detection...`);
    console.log(`Mode: ${isDryRun ? 'DRY RUN (no changes will be made)' : 'LIVE MODE'}`);
    console.log(`Force mode: ${forceMode ? 'ENABLED (no confirmations)' : 'DISABLED'}\n`);

    // Find all applications grouped by email
    const applications = await Application.find().sort({ email: 1, createdAt: 1 });
    
    // Group applications by email
    const emailGroups = {};
    applications.forEach(app => {
      if (!emailGroups[app.email]) {
        emailGroups[app.email] = [];
      }
      emailGroups[app.email].push(app);
    });

    // Find duplicates (emails with more than one application)
    const duplicates = {};
    Object.keys(emailGroups).forEach(email => {
      if (emailGroups[email].length > 1) {
        duplicates[email] = emailGroups[email];
      }
    });

    const duplicateEmails = Object.keys(duplicates);
    
    if (duplicateEmails.length === 0) {
      console.log("✅ No duplicate applications found! All emails have only one application.");
      return;
    }

    console.log(`📊 Found ${duplicateEmails.length} emails with duplicate applications:\n`);

    // Display duplicates summary
    let totalDuplicates = 0;
    duplicateEmails.forEach(email => {
      const apps = duplicates[email];
      totalDuplicates += apps.length - 1; // -1 because we keep one
      console.log(`📧 ${email}: ${apps.length} applications`);
      apps.forEach((app, index) => {
        console.log(`   ${index + 1}. ${app.fullName} - ${app.status} (${app.createdAt.toISOString().split('T')[0]})`);
      });
      console.log('');
    });

    console.log(`📈 Summary:`);
    console.log(`   - Emails with duplicates: ${duplicateEmails.length}`);
    console.log(`   - Total duplicate applications to delete: ${totalDuplicates}`);
    console.log(`   - Applications to keep: ${duplicateEmails.length}\n`);

    if (isDryRun) {
      console.log("🔍 DRY RUN COMPLETE - No changes were made.");
      console.log("To actually delete duplicates, run without --dry-run flag");
      return;
    }

    // Confirmation prompt (unless force mode)
    if (!forceMode) {
      console.log("⚠️  WARNING: This will permanently delete duplicate applications!");
      console.log("The script will keep the OLDEST application for each email address.");
      console.log("This action cannot be undone.\n");
      
      // In a real environment, you might want to use readline for interactive confirmation
      // For now, we'll require the --force flag for safety
      console.log("To proceed, add the --force flag to confirm deletion:");
      console.log("node deleteDuplicateApplications.js --force");
      return;
    }

    console.log("🗑️  Starting deletion process...\n");

    let deletedCount = 0;
    let keptCount = 0;

    // Process each email with duplicates
    for (const email of duplicateEmails) {
      const apps = duplicates[email];
      
      // Sort by creation date (oldest first) - keep the oldest one
      apps.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      
      const appToKeep = apps[0];
      const appsToDelete = apps.slice(1);

      console.log(`📧 Processing ${email}:`);
      console.log(`   ✅ Keeping: ${appToKeep.fullName} (${appToKeep.createdAt.toISOString().split('T')[0]})`);
      
      // Delete the newer applications
      for (const appToDelete of appsToDelete) {
        console.log(`   🗑️  Deleting: ${appToDelete.fullName} (${appToDelete.createdAt.toISOString().split('T')[0]})`);
        
        await Application.findByIdAndDelete(appToDelete._id);
        deletedCount++;
      }
      
      keptCount++;
      console.log('');
    }

    console.log("✅ Duplicate deletion completed!");
    console.log(`📊 Results:`);
    console.log(`   - Applications deleted: ${deletedCount}`);
    console.log(`   - Applications kept: ${keptCount}`);
    console.log(`   - Emails processed: ${duplicateEmails.length}`);

    // Verify the cleanup
    console.log("\n🔍 Verifying cleanup...");
    const remainingApps = await Application.find();
    const remainingEmails = new Set(remainingApps.map(app => app.email));
    
    console.log(`📈 Final counts:`);
    console.log(`   - Total applications remaining: ${remainingApps.length}`);
    console.log(`   - Unique emails: ${remainingEmails.size}`);
    
    if (remainingApps.length === remainingEmails.size) {
      console.log("✅ Verification successful: No duplicate emails remain!");
    } else {
      console.log("⚠️  Warning: Some emails may still have duplicates");
    }

  } catch (error) {
    console.error("❌ Error processing duplicate applications:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB");
  }
};

// Display usage information
const showUsage = () => {
  console.log("📖 Usage:");
  console.log("  node deleteDuplicateApplications.js [options]");
  console.log("");
  console.log("Options:");
  console.log("  --dry-run, -d    Show what would be deleted without making changes");
  console.log("  --force, -f      Skip confirmation prompts (required for actual deletion)");
  console.log("");
  console.log("Examples:");
  console.log("  node deleteDuplicateApplications.js --dry-run");
  console.log("  node deleteDuplicateApplications.js --force");
  console.log("");
  console.log("⚠️  Safety Notes:");
  console.log("  - Always run with --dry-run first to see what will be deleted");
  console.log("  - The script keeps the OLDEST application for each email");
  console.log("  - This action cannot be undone");
  console.log("  - Use --force flag to confirm you want to proceed");
};

// Check if help is requested
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  showUsage();
  process.exit(0);
}

// Run the script
deleteDuplicateApplications();
