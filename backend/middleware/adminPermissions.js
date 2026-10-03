const Admin = require('../models/Admin');
const { getFirebaseAuth } = require('../config/firebaseAdmin');

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

// Returns the verified email from the request's Firebase ID token, or null if there is none
const getVerifiedEmail = async (req) => {
  const header = req.headers['authorization'] || '';
  if (!header.startsWith('Bearer ')) {
    return null;
  }

  let decoded;
  try {
    decoded = await getFirebaseAuth().verifyIdToken(header.slice('Bearer '.length));
  } catch (verifyError) {
    return null;
  }

  return decoded.email && decoded.email_verified ? decoded.email : null;
};

// Middleware to verify the caller is an active admin (Firebase ID token)
const requireAdminAuth = async (req, res, next) => {
  try {
    const email = await getVerifiedEmail(req);
    if (!email) {
      return res.status(401).json({ error: "❌ Invalid or missing authentication" });
    }

    const admin = await Admin.findOne({ email, isActive: true });
    if (!admin) {
      return res.status(403).json({ error: "❌ Admin not found or inactive" });
    }

    req.admin = admin;
    req.isAdmin = true;
    next();
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
  getVerifiedEmail,
  requireAdminAuth,
  requireStatusChangePermission,
  requireCommentPermission,
  requireDragDropPermission
};
