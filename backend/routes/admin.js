const express = require("express");
const router = express.Router();
const Admin = require("../models/Admin");
const User = require("../models/User");
const { requireAdminAuth, getVerifiedEmail } = require("../middleware/adminPermissions");

const ROLES = ["admin", "super_admin"];
const PERMISSION_KEYS = [
  "canViewApplications", "canEditApplications", "canDeleteApplications", "canManageAdmins",
  "canViewAnalytics", "canChangeStatus", "canAddComments", "canDragDrop"
];

// Admin management needs super_admin or canManageAdmins (runs after requireAdminAuth)
const requireManageAdmins = (req, res, next) => {
  if (req.admin.role !== "super_admin" && !req.admin.permissions.canManageAdmins) {
    return res.status(403).json({ error: "Insufficient permissions" });
  }
  next();
};

// Only known permission flags with boolean values
const pickPermissions = (permissions = {}) =>
  Object.fromEntries(
    PERMISSION_KEYS.filter((key) => typeof permissions[key] === "boolean").map((key) => [key, permissions[key]])
  );

// Making someone a super admin or an admin manager is reserved for super admins
const grantsElevatedAccess = (role, permissions) =>
  role === "super_admin" || permissions?.canManageAdmins === true;

// Check if the signed-in user is an admin
router.post("/check", async (req, res) => {
  try {
    const email = await getVerifiedEmail(req);
    if (!email) {
      return res.status(401).json({ isAdmin: false, error: "Invalid or missing authentication" });
    }
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

// Get all admins
router.get("/", requireAdminAuth, requireManageAdmins, async (req, res) => {
  try {
    const admins = await Admin.find({}, { email: 1, name: 1, role: 1, isActive: 1, lastLogin: 1, permissions: 1 });
    res.json(admins);
  } catch (error) {
    console.error("Error fetching admins:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Create new admin
router.post("/", requireAdminAuth, requireManageAdmins, async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const { name, role = "admin", permissions } = req.body;

    if (!email || !name) {
      return res.status(400).json({ error: "Email and name are required" });
    }
    if (!ROLES.includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }
    if (grantsElevatedAccess(role, permissions) && req.admin.role !== "super_admin") {
      return res.status(403).json({ error: "Only super admins can grant super admin or admin-management access" });
    }

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({ error: "Admin with this email already exists" });
    }

    const newAdmin = new Admin({
      email,
      name,
      role,
      permissions: pickPermissions(permissions),
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

// Update admin
router.put("/:email", requireAdminAuth, requireManageAdmins, async (req, res) => {
  try {
    const { email } = req.params;
    const { name, role, permissions, isActive } = req.body;

    if (role !== undefined && !ROLES.includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }
    if (grantsElevatedAccess(role, permissions) && req.admin.role !== "super_admin") {
      return res.status(403).json({ error: "Only super admins can grant super admin or admin-management access" });
    }
    if (email === req.admin.email && isActive === false) {
      return res.status(400).json({ error: "Cannot deactivate your own account" });
    }

    const target = await Admin.findOne({ email });
    if (!target) {
      return res.status(404).json({ error: "Admin not found" });
    }
    if (target.role === "super_admin" && req.admin.role !== "super_admin") {
      return res.status(403).json({ error: "Only super admins can modify super admins" });
    }

    // Allowlisted fields only; email, createdBy, etc. are never writable here
    const update = {};
    if (typeof name === "string") update.name = name;
    if (role !== undefined) update.role = role;
    if (typeof isActive === "boolean") update.isActive = isActive;
    for (const [key, value] of Object.entries(pickPermissions(permissions))) {
      update[`permissions.${key}`] = value;
    }

    const admin = await Admin.findOneAndUpdate({ email }, { $set: update }, { new: true, runValidators: true });

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

// Deactivate admin
router.delete("/:email", requireAdminAuth, requireManageAdmins, async (req, res) => {
  try {
    const { email } = req.params;

    // Prevent self-deactivation
    if (email === req.admin.email) {
      return res.status(400).json({ error: "Cannot deactivate your own account" });
    }

    const target = await Admin.findOne({ email });
    if (!target) {
      return res.status(404).json({ error: "Admin not found" });
    }
    if (target.role === "super_admin" && req.admin.role !== "super_admin") {
      return res.status(403).json({ error: "Only super admins can modify super admins" });
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

module.exports = router;
