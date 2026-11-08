const mongoose = require('mongoose');
const Admin = require('../models/Admin');
const User = require('../models/User');
require('dotenv').config();

const createSuperAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    // Usage: node scripts/createSuperAdmin.js <email> "<Full Name>"
    // Super admin details
    const superAdminData = {
      email: (process.argv[2] || "").trim().toLowerCase(),
      name: (process.argv[3] || "").trim(),
      role: "super_admin",
      permissions: {
        canViewApplications: true,
        canEditApplications: true,
        canDeleteApplications: true,
        canManageAdmins: true,
        canViewAnalytics: true
      },
      isActive: true,
      createdBy: "system"
    };

    if (!superAdminData.email || !superAdminData.name) {
      console.error('Usage: node scripts/createSuperAdmin.js <email> "<Full Name>"');
      process.exit(1);
    }

    // Check if super admin already exists
    const existingAdmin = await Admin.findOne({ email: superAdminData.email });
    if (existingAdmin) {
      // Update to super_admin if not already
      existingAdmin.role = "super_admin";
      existingAdmin.name = superAdminData.name;
      existingAdmin.permissions = superAdminData.permissions;
      existingAdmin.isActive = true;
      await existingAdmin.save();
      console.log("Super admin updated successfully!");
      console.log("Email:", superAdminData.email);
      console.log("Role:", superAdminData.role);
      console.log("Permissions:", superAdminData.permissions);
    } else {
      // Create super admin
      const superAdmin = new Admin(superAdminData);
      await superAdmin.save();
      console.log("✅ Super admin created successfully!");
      console.log("Email:", superAdminData.email);
      console.log("Role:", superAdminData.role);
      console.log("Permissions:", superAdminData.permissions);
    }

    // Also create user record
    await User.findOneAndUpdate(
      { email: superAdminData.email },
      { 
        email: superAdminData.email, 
        name: superAdminData.name, 
        role: "associate" 
      },
      { upsert: true, new: true }
    );

  } catch (error) {
    console.error("❌ Error creating super admin:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
};

// Run the script
createSuperAdmin(); 