const mongoose = require('mongoose');
const Admin = require('../models/Admin');
const User = require('../models/User');
require('dotenv').config();

// Script to add multiple super admins
const addSuperAdmins = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // List of super admins to add
    const superAdminsToAdd = [
      { email: "justinzelu@gmail.com", name: "Justin Zelu" },
      { email: "aanarayanan@ucsd.edu", name: "A A Narayanan" },
      { email: "lanaphamnguy@gmail.com", name: "Lana Pham Nguyen" }
    ];

    console.log(`\n📋 Adding ${superAdminsToAdd.length} super admins...\n`);

    // Super admin permissions (all permissions enabled)
    const superAdminPermissions = {
      canViewApplications: true,
      canEditApplications: true,
      canDeleteApplications: true,
      canManageAdmins: true,
      canViewAnalytics: true,
      canChangeStatus: true,
      canAddComments: true,
      canDragDrop: true
    };

    let createdCount = 0;
    let updatedCount = 0;

    for (const adminData of superAdminsToAdd) {
      try {
        // Check if admin already exists
        const existingAdmin = await Admin.findOne({ email: adminData.email });
        
        if (existingAdmin) {
          // Update existing admin to super_admin
          existingAdmin.role = "super_admin";
          existingAdmin.name = adminData.name;
          existingAdmin.permissions = superAdminPermissions;
          existingAdmin.isActive = true;
          await existingAdmin.save();
          updatedCount++;
          console.log(`🔄 Updated to super admin: ${adminData.name} (${adminData.email})`);
        } else {
          // Create new super admin
          const newAdmin = new Admin({
            email: adminData.email,
            name: adminData.name,
            role: "super_admin",
            permissions: superAdminPermissions,
            isActive: true,
            createdBy: "system"
          });
          await newAdmin.save();
          createdCount++;
          console.log(`✅ Created super admin: ${adminData.name} (${adminData.email})`);
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
    console.log(`✅ Created: ${createdCount} super admins`);
    console.log(`🔄 Updated: ${updatedCount} super admins`);
    console.log(`\n📋 Super Admin Permissions:`);
    console.log(`✅ Can view applications`);
    console.log(`✅ Can edit applications`);
    console.log(`✅ Can delete applications`);
    console.log(`✅ Can manage other admins`);
    console.log(`✅ Can view analytics`);
    console.log(`✅ Can change application status`);
    console.log(`✅ Can add comments`);
    console.log(`✅ Can drag and drop applications`);

  } catch (error) {
    console.error("❌ Error adding super admins:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB");
  }
};

// Run the script
addSuperAdmins();

