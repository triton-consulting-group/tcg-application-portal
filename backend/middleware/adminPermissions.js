const Admin = require('../models/Admin');

// Middleware to check if admin has specific permission
const checkAdminPermission = (permission) => {
  return async (req, res, next) => {
    try {
      const adminEmail = req.headers['x-admin-email'];
      
      if (!adminEmail) {
        return res.status(401).json({ error: "❌ Admin email required in headers" });
      }

      const admin = await Admin.findOne({ email: adminEmail, isActive: true });
      
      if (!admin) {
        return res.status(403).json({ error: "❌ Admin not found or inactive" });
      }

      // Super admins have all permissions, regular admins need explicit permission
      if (admin.role !== "super_admin" && !admin.permissions[permission]) {
        return res.status(403).json({ 
          error: `❌ Permission denied. You need ${permission} permission to perform this action.`,
          requiredPermission: permission,
          adminRole: admin.role
        });
      }

      // Add admin info to request for use in route handlers
      req.admin = admin;
      next();
    } catch (error) {
      console.error("❌ Error checking admin permission:", error);
      res.status(500).json({ error: "❌ Failed to verify admin permissions" });
    }
  };
};

// Middleware to verify admin exists (for sensitive read operations)
const requireAdminAuth = async (req, res, next) => {
  try {
    // Token-based admin auth only
    const bearerToken = req.headers['authorization']?.replace('Bearer ', '');
    const validToken = process.env.ADMIN_API_TOKEN;
    
    if (bearerToken && validToken && bearerToken === validToken) {
      req.isAdmin = true;
      return next();
    }

    return res.status(401).json({ error: "❌ Invalid or missing authentication" });
  } catch (error) {
    console.error("❌ Error checking admin authentication:", error);
    res.status(500).json({ error: "❌ Failed to verify authentication" });
  }
};

// Specific permission checkers
const requireStatusChangePermission = checkAdminPermission('canChangeStatus');
const requireCommentPermission = checkAdminPermission('canAddComments');
const requireDragDropPermission = checkAdminPermission('canDragDrop');

module.exports = {
  checkAdminPermission,
  requireAdminAuth,
  requireStatusChangePermission,
  requireCommentPermission,
  requireDragDropPermission
};
