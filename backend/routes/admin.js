const express = require("express");
const router = express.Router();
const Admin = require("../models/Admin");
const User = require("../models/User");

// Middleware to check if user is admin
const isAdmin = async (req, res, next) => {
  try {
    const { email } = req.body;
    const admin = await Admin.findOne({ email, isActive: true });
    
    if (!admin) {
      return res.status(403).json({ error: "Access denied. Admin privileges required." });
    }
    
    req.admin = admin;
    next();
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

// Check if user is admin
router.post("/check", async (req, res) => {
  try {
    const { email } = req.body;
    const admin = await Admin.findOne({ email, isActive: true });
    
    if (!admin) {
      return res.status(404).json({ isAdmin: false, message: "User is not an admin" });
    }
    
    // Update last login
    admin.lastLogin = new Date();
    await admin.save();
    
    res.json({ 
      isAdmin: true, 
      admin: {
        email: admin.email,
        name: admin.name,
        role: admin.role,
        permissions: admin.permissions
      }
    });
  } catch (error) {
    console.error("Error checking admin status:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Get all admins (super admin only)
router.get("/", isAdmin, async (req, res) => {
  try {
    if (req.admin.role !== "super_admin" && !req.admin.permissions.canManageAdmins) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    
    const admins = await Admin.find({}, { email: 1, name: 1, role: 1, isActive: 1, lastLogin: 1, permissions: 1 });
    res.json(admins);
  } catch (error) {
    console.error("Error fetching admins:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Create new admin (super admin only)
router.post("/", isAdmin, async (req, res) => {
  try {
    if (req.admin.role !== "super_admin" && !req.admin.permissions.canManageAdmins) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    
    const { email, name, role, permissions } = req.body;
    
    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({ error: "Admin with this email already exists" });
    }
    
    const newAdmin = new Admin({
      email,
      name,
      role: role || "admin",
      permissions: permissions || {},
      createdBy: req.admin.email
    });
    
    await newAdmin.save();
    
    // Also create/update user record
    await User.findOneAndUpdate(
      { email },
      { email, name, role: "associate" },
      { upsert: true, new: true }
    );
    
    res.status(201).json({ 
      message: "Admin created successfully", 
      admin: {
        email: newAdmin.email,
        name: newAdmin.name,
        role: newAdmin.role
      }
    });
  } catch (error) {
    console.error("Error creating admin:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Update admin (super admin only)
router.put("/:email", isAdmin, async (req, res) => {
  try {
    if (req.admin.role !== "super_admin" && !req.admin.permissions.canManageAdmins) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    
    const { email } = req.params;
    const updateData = req.body;
    
    const admin = await Admin.findOneAndUpdate(
      { email },
      updateData,
      { new: true }
    );
    
    if (!admin) {
      return res.status(404).json({ error: "Admin not found" });
    }
    
    res.json({ 
      message: "Admin updated successfully", 
      admin: {
        email: admin.email,
        name: admin.name,
        role: admin.role,
        permissions: admin.permissions
      }
    });
  } catch (error) {
    console.error("Error updating admin:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Deactivate admin (super admin only)
router.delete("/:email", isAdmin, async (req, res) => {
  try {
    if (req.admin.role !== "super_admin" && !req.admin.permissions.canManageAdmins) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    
    const { email } = req.params;
    
    // Prevent self-deactivation
    if (email === req.admin.email) {
      return res.status(400).json({ error: "Cannot deactivate your own account" });
    }
    
    const admin = await Admin.findOneAndUpdate(
      { email },
      { isActive: false },
      { new: true }
    );
    
    if (!admin) {
      return res.status(404).json({ error: "Admin not found" });
    }
    
    res.json({ message: "Admin deactivated successfully" });
  } catch (error) {
    console.error("Error deactivating admin:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Get admin permissions
router.get("/permissions/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const admin = await Admin.findOne({ email, isActive: true });
    
    if (!admin) {
      return res.status(404).json({ error: "Admin not found" });
    }
    
    res.json({ permissions: admin.permissions });
  } catch (error) {
    console.error("Error fetching admin permissions:", error);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router; 