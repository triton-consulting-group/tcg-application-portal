const Admin = require("../models/Admin");
const Application = require("../models/Application");
const { getVerifiedEmail } = require("./adminPermissions");

const FILE_FIELDS = ["resume", "transcript", "image"];

// Reduces a stored file reference (full S3 URL, bare key, or /uploads path) to the key that gets signed
const toFileKey = (value) => {
  if (!value || typeof value !== "string") return "";
  const key = value.includes("amazonaws.com/") ? value.split("amazonaws.com/")[1] : value;
  return key.replace(/^\/+/, "");
};

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Allows active admins, or the applicant whose own application references the requested file
const requireFileAccess = async (req, res, next) => {
  try {
    const email = await getVerifiedEmail(req);
    if (!email) {
      return res.status(401).json({ error: "❌ Invalid or missing authentication" });
    }

    const key = toFileKey(req.params[0]);
    if (!key) {
      return res.status(400).json({ error: "❌ File path is required." });
    }

    const admin = await Admin.findOne({ email, isActive: true });
    if (admin) {
      req.admin = admin;
      req.isAdmin = true;
      req.fileKey = key;
      return next();
    }

    // Applicants may have typed their email with different casing than Firebase reports
    const applications = await Application.find(
      { email: new RegExp(`^${escapeRegex(email)}$`, "i") },
      FILE_FIELDS.join(" ")
    ).lean();

    const ownsFile = applications.some((app) =>
      FILE_FIELDS.some((field) => app[field] && toFileKey(app[field]) === key)
    );
    if (!ownsFile) {
      // Same response whether the file is missing or belongs to someone else
      return res.status(403).json({ error: "❌ You can only access your own files." });
    }

    req.fileKey = key;
    next();
  } catch (error) {
    console.error("❌ Error checking file access:", error);
    res.status(500).json({ error: "❌ Failed to verify file access" });
  }
};

module.exports = { toFileKey, requireFileAccess };
