require('dotenv').config({ path: require('path').join(__dirname, '../production.env') });
const mongoose = require('mongoose');
const Admin = require('../models/Admin');

async function checkAdmins() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to production database');

    const admins = await Admin.find({});
    console.log(`\n📊 Found ${admins.length} admins:\n`);
    
    admins.forEach(admin => {
      console.log(`Email: ${admin.email}`);
      console.log(`Name: ${admin.name}`);
      console.log(`Role: ${admin.role}`);
      console.log(`Active: ${admin.isActive}`);
      console.log(`Permissions:`, admin.permissions);
      console.log('---');
    });

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkAdmins();
