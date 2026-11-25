const express = require("express");
const router = express.Router();
const Admin = require("../models/Admin");
const User = require("../models/User");
const adminManagementWrite = require("../services/adminManagementWrite");
const { requireAdminAuth, getVerifiedEmail } = require("../middleware/adminPermissions");

const ROLES = ["admin", "super_admin"];
const PERMISSION_KEYS = [
  "canViewApplications", "canEditApplications", "canDeleteApplications", "canManageAdmins",
  "canViewAnalytics", "canChangeStatus", "canAddComments", "canDeleteComments", "canDragDrop"
];

// Admin management needs super_admin or canManageAdmins (runs after requireAdminAuth)
const requireManageAdmins = (req, res, next) => {
  if (req.admin.role !== "super_admin" && !req.admin.permissions?.canManageAdmins) {
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

const normalizeEmail = (value) => typeof value === "string" ? value.trim().toLowerCase() : "";
const validEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validPermissions = (permissions) => permissions === undefined || (
  permissions !== null && typeof permissions === "object" && !Array.isArray(permissions) &&
  PERMISSION_KEYS.every(key => permissions[key] === undefined || typeof permissions[key] === "boolean")
);

const sendWriteError = (res, error) => {
  if (error.code === 20) return res.status(503).json({ error: "Admin changes require MongoDB configured as a replica set or sharded cluster" });
  if (error.code === 11000) return res.status(409).json({ error: "Admin with this email already exists" });
  if (error.name === "ValidationError") return res.status(400).json({ error: "Please check the admin details" });
  return res.status(500).json({ error: "Server error" });
};

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
    const result = await adminManagementWrite(req.admin.email, async (actor, session) => {
      const email = normalizeEmail(req.body.email);
      const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
      const { role = "admin", permissions } = req.body;

      if (!email || !name) {
        return { status: 400, body: { error: "Email and name are required" } };
      }
      if (!validEmail(email)) return { status: 400, body: { error: "Enter a valid email address" } };
      if (!validPermissions(permissions)) return { status: 400, body: { error: "Permissions must be true or false" } };
      if (!ROLES.includes(role)) {
        return { status: 400, body: { error: "Invalid role" } };
      }
      if (grantsElevatedAccess(role, permissions) && actor.role !== "super_admin") {
        return { status: 403, body: { error: "Only super admins can grant super admin or admin-management access" } };
      }

      // Check if admin already exists
      const existingAdmin = await Admin.findOne({ email }, null, { session });
      if (existingAdmin) {
        return { status: 400, body: { error: "Admin with this email already exists" } };
      }

      const newAdmin = new Admin({
        email,
        name,
        role,
        permissions: pickPermissions(permissions),
        createdBy: actor.email
      });

      await newAdmin.save({ session });

      // Also create/update user record
      await User.findOneAndUpdate(
        { email },
        { email, name, role: "associate" },
        { upsert: true, new: true, session }
      );

      return { status: 201, body: {
        message: "Admin created successfully",
        admin: {
          email: newAdmin.email,
          name: newAdmin.name,
          role: newAdmin.role
        }
      } };
    });
    res.status(result.status).json(result.body);
  } catch (error) {
    console.error("Error creating admin:", error);
    sendWriteError(res, error);
  }
});

// Update admin
router.put("/:email", requireAdminAuth, requireManageAdmins, async (req, res) => {
  try {
    const result = await adminManagementWrite(req.admin.email, async (actor, session) => {
      const email = normalizeEmail(req.params.email);
      const { name, role, permissions, isActive } = req.body;

      if (name !== undefined && (typeof name !== "string" || !name.trim())) {
        return { status: 400, body: { error: "Name is required" } };
      }
      if (!validPermissions(permissions)) return { status: 400, body: { error: "Permissions must be true or false" } };
      if (isActive !== undefined && typeof isActive !== "boolean") {
        return { status: 400, body: { error: "Active status must be true or false" } };
      }

      if (role !== undefined && !ROLES.includes(role)) {
        return { status: 400, body: { error: "Invalid role" } };
      }
      if (grantsElevatedAccess(role, permissions) && actor.role !== "super_admin") {
        return { status: 403, body: { error: "Only super admins can grant super admin or admin-management access" } };
      }
      if (email === actor.email && isActive === false) {
        return { status: 400, body: { error: "Cannot deactivate your own account" } };
      }
      if (email === actor.email && (
        (actor.role === "super_admin" && role === "admin") ||
        (actor.role !== "super_admin" && permissions?.canManageAdmins === false)
      )) {
        return { status: 400, body: { error: "Cannot remove your own management access" } };
      }

      const target = await Admin.findOne({ email }, null, { session });
      if (!target) {
        return { status: 404, body: { error: "Admin not found" } };
      }
      if (target.role === "super_admin" && actor.role !== "super_admin") {
        return { status: 403, body: { error: "Only super admins can modify super admins" } };
      }
      if (target.role === "super_admin" && target.isActive && (role === "admin" || isActive === false)) {
        const others = await Admin.countDocuments({ role: "super_admin", isActive: true, email: { $ne: email } }, { session });
        if (!others) return { status: 400, body: { error: "Cannot remove the last active super admin" } };
      }

      // Allowlisted fields only; email, createdBy, etc. are never writable here
      const update = {};
      if (typeof name === "string") update.name = name.trim();
      if (role !== undefined) update.role = role;
      if (typeof isActive === "boolean") update.isActive = isActive;
      for (const [key, value] of Object.entries(pickPermissions(permissions))) {
        update[`permissions.${key}`] = value;
      }

      const admin = await Admin.findOneAndUpdate({ email }, { $set: update }, { new: true, runValidators: true, session });

      if (!admin) return { status: 404, body: { error: "Admin not found" } };

      return { status: 200, body: {
        message: "Admin updated successfully",
        admin: {
          email: admin.email,
          name: admin.name,
          role: admin.role,
          isActive: admin.isActive,
          permissions: admin.permissions
        }
      } };
    });
    res.status(result.status).json(result.body);
  } catch (error) {
    console.error("Error updating admin:", error);
    sendWriteError(res, error);
  }
});

// Deactivate admin
router.delete("/:email", requireAdminAuth, requireManageAdmins, async (req, res) => {
  try {
    const result = await adminManagementWrite(req.admin.email, async (actor, session) => {
      const email = normalizeEmail(req.params.email);

      // Prevent self-deactivation
      if (email === actor.email) {
        return { status: 400, body: { error: "Cannot deactivate your own account" } };
      }

      const target = await Admin.findOne({ email }, null, { session });
      if (!target) {
        return { status: 404, body: { error: "Admin not found" } };
      }
      if (target.role === "super_admin" && actor.role !== "super_admin") {
        return { status: 403, body: { error: "Only super admins can modify super admins" } };
      }

      if (target.role === "super_admin" && target.isActive) {
        const others = await Admin.countDocuments({ role: "super_admin", isActive: true, email: { $ne: email } }, { session });
        if (!others) return { status: 400, body: { error: "Cannot remove the last active super admin" } };
      }

      const admin = await Admin.findOneAndUpdate(
        { email },
        { isActive: false },
        { new: true, session }
      );

      if (!admin) {
        return { status: 404, body: { error: "Admin not found" } };
      }

      return { status: 200, body: { message: "Admin deactivated successfully" } };
    });
    res.status(result.status).json(result.body);
  } catch (error) {
    console.error("Error deactivating admin:", error);
    sendWriteError(res, error);
  }
});

module.exports = router;
