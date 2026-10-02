const mongoose = require('mongoose');
const Admin = require('../models/Admin');
const User = require('../models/User');
require('dotenv').config();

// Script to add multiple admins with standard admin permissions
const addAdmins = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // List of admins to add
    const adminsToAdd = [
      { email: "ngolder@ucsd.edu", name: "N Golder" },
      { email: "spodugu@ucsd.edu", name: "S Podugu" },
      { email: "georgema2020@gmail.com", name: "George Ma" },
      { email: "justinzelu@gmail.com", name: "Justin Zelu" },
      { email: "sbhatnagar@ucsd.edu", name: "S Bhatnagar" }
    ];

    console.log(`\n📋 Adding ${adminsToAdd.length} admins...\n`);

    // Standard admin permissions (default admin permissions)
    const standardAdminPermissions = {
      canViewApplications: true,
      canEditApplications: true,
      canDeleteApplications: false,
      canManageAdmins: false,
      canViewAnalytics: true,
      canChangeStatus: true,
      canAddComments: true,
      canDragDrop: true
    };

    let createdCount = 0;
    let updatedCount = 0;

    for (const adminData of adminsToAdd) {
      try {
        // Check if admin already exists
        const existingAdmin = await Admin.findOne({ email: adminData.email });
        
        if (existingAdmin) {
          // Update existing admin
          existingAdmin.role = "admin";
          existingAdmin.name = adminData.name;
          existingAdmin.permissions = standardAdminPermissions;
          existingAdmin.isActive = true;
          await existingAdmin.save();
          updatedCount++;
          console.log(`🔄 Updated admin: ${adminData.name} (${adminData.email})`);
        } else {
          // Create new admin
          const newAdmin = new Admin({
            email: adminData.email,
            name: adminData.name,
            role: "admin",
            permissions: standardAdminPermissions,
            isActive: true,
            createdBy: "system"
          });
          await newAdmin.save();
          createdCount++;
          console.log(`✅ Created admin: ${adminData.name} (${adminData.email})`);
        }

        // Also create/update user record
        await User.findOneAndUpdate(
          { email: adminData.email },
          { 
            email: adminData.email, 
            name: adminData.name, 
            role: "associate" 
          },
          { upsert: true, new: true }
        );

      } catch (error) {
        console.error(`❌ Error processing ${adminData.email}:`, error.message);
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`✅ Created: ${createdCount} admins`);
    console.log(`🔄 Updated: ${updatedCount} admins`);
    console.log(`\n📋 Standard Admin Permissions:`);
    console.log(`✅ Can view applications`);
    console.log(`✅ Can edit applications`);
    console.log(`✅ Can change application status`);
    console.log(`✅ Can add comments`);
    console.log(`✅ Can drag and drop applications`);
    console.log(`✅ Can view analytics`);
    console.log(`❌ Cannot delete applications`);
    console.log(`❌ Cannot manage other admins`);

  } catch (error) {
    console.error("❌ Error adding admins:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB");
  }
};

// Run the script
addAdmins();




