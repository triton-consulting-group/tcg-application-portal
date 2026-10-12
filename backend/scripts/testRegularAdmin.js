const mongoose = require('mongoose');
const Admin = require('../models/Admin');
require('dotenv').config();

// Script to test regular admin permissions
const testRegularAdminPermissions = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    // Find all admins and display their permissions
    const admins = await Admin.find({ isActive: true });
    
    console.log("\n🔍 Current Admin Permissions:");
    console.log("=" .repeat(60));
    
    admins.forEach((admin, index) => {
      console.log(`\n${index + 1}. ${admin.name} (${admin.email})`);
      console.log(`   Role: ${admin.role}`);
      console.log(`   Permissions:`);
      console.log(`   - View Applications: ${admin.permissions.canViewApplications ? '✅' : '❌'}`);
      console.log(`   - Edit Applications: ${admin.permissions.canEditApplications ? '✅' : '❌'}`);
      console.log(`   - Change Status: ${admin.permissions.canChangeStatus ? '✅' : '❌'}`);
      console.log(`   - Add Comments: ${admin.permissions.canAddComments ? '✅' : '❌'}`);
      console.log(`   - Delete Comments: ${admin.permissions.canDeleteComments ? '✅' : '❌'}`);
      console.log(`   - Drag & Drop: ${admin.permissions.canDragDrop ? '✅' : '❌'}`);
      console.log(`   - Manage Admins: ${admin.permissions.canManageAdmins ? '✅' : '❌'}`);
      console.log(`   - View Analytics: ${admin.permissions.canViewAnalytics ? '✅' : '❌'}`);
    });

    // Count different admin types
    const superAdmins = admins.filter(admin => admin.role === 'super_admin');
    const regularAdmins = admins.filter(admin => admin.role === 'admin');
    
    console.log("\n📊 Admin Summary:");
    console.log(`Total Active Admins: ${admins.length}`);
    console.log(`Super Admins: ${superAdmins.length}`);
    console.log(`Regular Admins: ${regularAdmins.length}`);

    // Show permission differences
    console.log("\n🔐 Permission Comparison:");
    console.log("Super Admin vs Regular Admin:");
    console.log("Super Admin: Full access to all features");
    console.log("Regular Admin: View-only access (cannot modify data)");

  } catch (error) {
    console.error("❌ Error testing admin permissions:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
};

testRegularAdminPermissions();
