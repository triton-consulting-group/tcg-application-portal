const mongoose = require('mongoose');
const Admin = require('../models/Admin');
const User = require('../models/User');
require('dotenv').config();

// Script to create a regular admin with view-only permissions
const createRegularAdmin = async (email, name) => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    // Regular admin details with view-only permissions
    const regularAdminData = {
      email: email,
      name: name,
      role: "admin", // Regular admin role
      permissions: {
        canViewApplications: true,
        canEditApplications: false, // Cannot edit applications
        canDeleteApplications: false,
        canManageAdmins: false,
        canViewAnalytics: true,
        canChangeStatus: false, // Cannot change status
        canAddComments: false, // Cannot add comments
        canDeleteComments: false, // Cannot delete comments
        canDragDrop: false // Cannot drag and drop
      },
      isActive: true,
      createdBy: "system"
    };

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email: regularAdminData.email });
    if (existingAdmin) {
      // Update to regular admin permissions if not already
      existingAdmin.role = "admin";
      existingAdmin.name = regularAdminData.name;
      existingAdmin.permissions = regularAdminData.permissions;
      existingAdmin.isActive = true;
      await existingAdmin.save();
      console.log("✅ Regular admin updated successfully!");
      console.log("Email:", regularAdminData.email);
      console.log("Name:", regularAdminData.name);
      console.log("Role:", regularAdminData.role);
      console.log("Permissions:", existingAdmin.permissions);
    } else {
      // Create regular admin
      const regularAdmin = new Admin(regularAdminData);
      await regularAdmin.save();
      console.log("✅ Regular admin created successfully!");
      console.log("Email:", regularAdminData.email);
      console.log("Name:", regularAdminData.name);
      console.log("Role:", regularAdminData.role);
      console.log("Permissions:", regularAdmin.permissions);
    }

    // Also create/update user record for the regular admin
    await User.findOneAndUpdate(
      { email: regularAdminData.email },
      { email: regularAdminData.email, name: regularAdminData.name, role: "associate" },
      { upsert: true, new: true }
    );

    console.log("\n📋 Regular Admin Permissions Summary:");
    console.log("✅ Can view applications");
    console.log("✅ Can view analytics");
    console.log("❌ Cannot edit applications");
    console.log("❌ Cannot change application status");
    console.log("❌ Cannot add comments");
    console.log("❌ Cannot drag and drop applications");
    console.log("❌ Cannot manage other admins");

  } catch (error) {
    console.error("❌ Error creating regular admin:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
};

// Example usage - you can modify these values
const email = process.argv[2] || "regularadmin@example.com";
const name = process.argv[3] || "Regular Admin";

console.log(`Creating regular admin: ${name} (${email})`);
createRegularAdmin(email, name);
