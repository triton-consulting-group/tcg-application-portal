const express = require("express");
const multer = require("multer");
const multerS3 = require("multer-s3");
const router = express.Router();
const Application = require("../models/Application");
const path = require("path");
const { applicationSubmissionLimiter, generalApiLimiter } = require("../middleware/rateLimiter");
const { requireStatusChangePermission, requireCommentPermission } = require("../middleware/adminPermissions");
const CASE_NIGHT_CONFIG = require("../config/caseNightConfig");
const DEADLINE_CONFIG = require("../config/deadlineConfig");
const { s3, S3_CONFIG, getFileTypeAndPath, getFileUrl, isS3Configured } = require("../config/s3Config");
const { emailService } = require("../config/emailConfig");

/* =========================
   NEW: date helpers + no-cache
   ========================= */
function parseMaybeDate(val) {
  // Accept ISO strings, numbers (timestamps), or Date
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === "number") return new Date(val);
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}
function nowUtc() {
  return new Date(); // backend runs in UTC; compute consistently
}
function addNoStore(res) {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  res.set("Surrogate-Control", "no-store");
}

/* =========================
   Multer storage setup (unchanged)
   ========================= */
let storage, upload;

if (isS3Configured()) {
  console.log("✅ Using S3 storage for file uploads");
  storage = multerS3({
    s3: s3,
    bucket: S3_CONFIG.bucketName,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: function (req, file, cb) {
      const { fileType, s3Path } = getFileTypeAndPath(file.fieldname, file.mimetype);
      const timestamp = Date.now();
      const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      const s3Key = `${s3Path}${timestamp}-${sanitizedName}`;
      cb(null, s3Key);
    },
    metadata: function (req, file, cb) {
      cb(null, { 
        fieldName: file.fieldname,
        originalName: file.originalname,
        uploadedAt: new Date().toISOString()
      });
    }
  });
} else {
  console.log("⚠️ S3 not configured, falling back to local storage");
  storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, "uploads/"),
    filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname.replace(/\s+/g, "_")),
  });
}

upload = multer({ 
  storage: storage,
  limits: { fileSize: S3_CONFIG.uploadSettings.maxFileSize },
  fileFilter: (req, file, cb) => {
    if (S3_CONFIG.uploadSettings.allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.doc', '.docx'];
      const fileExtension = path.extname(file.originalname).toLowerCase();
      if (allowedExtensions.includes(fileExtension)) {
        console.log(`⚠️ File ${file.originalname} has MIME type ${file.mimetype} but extension ${fileExtension} is allowed`);
        cb(null, true);
      } else {
        cb(new Error(`File type ${file.mimetype} and extension ${fileExtension} are not allowed`), false);
      }
    }
  }
});

/* =========================
   Routes
   ========================= */

// Case night config
router.get("/case-night-config", (req, res) => {
  try {
    addNoStore(res);
    res.json(CASE_NIGHT_CONFIG);
  } catch (error) {
    console.error("❌ Error fetching case night config:", error);
    res.status(500).json({ error: "❌ Failed to fetch case night config." });
  }
});

// Test email
router.get("/test-email", async (req, res) => {
  try {
    addNoStore(res);
    const result = await emailService.testEmailConfig();
    if (result.success) {
      res.json({ message: "✅ Email configuration is valid", status: "healthy" });
    } else {
      res.status(500).json({ error: "❌ Email configuration error", details: result.error });
    }
  } catch (error) {
    console.error("❌ Error testing email config:", error);
    res.status(500).json({ error: "❌ Failed to test email configuration." });
  }
});

/* ===================================================
   NEW: Public window status (start + deadline together)
   GET /api/applications/window-status
   =================================================== */
router.get("/window-status", (req, res) => {
  try {
    addNoStore(res);

    const isActive = !!DEADLINE_CONFIG.isActive;
    const start = parseMaybeDate(DEADLINE_CONFIG.applicationStart);
    const deadline = parseMaybeDate(DEADLINE_CONFIG.applicationDeadline);

    const now = nowUtc();
    const hasStart = !!start;
    const hasDeadline = !!deadline;

    const isBeforeStart = isActive && hasStart ? now < start : false;
    const isAfterDeadline = isActive && hasDeadline ? now > deadline : false;
    const isOpen = isActive && (!hasStart || now >= start) && (!hasDeadline || now <= deadline);

    res.json({
      isActive,
      isOpen,
      isBeforeStart,
      isAfterDeadline,
      start: hasStart ? start.toISOString() : null,
      deadline: hasDeadline ? deadline.toISOString() : null,
      preStartMessage: DEADLINE_CONFIG.preStartMessage || "Applications are not open yet.",
      deadlineMessage: DEADLINE_CONFIG.message || "Application deadline has passed.",
      serverTime: now.toISOString(),
      timeUntilStart: isActive && hasStart && now < start ? (start - now) : null,
      timeRemaining: isActive && hasDeadline && now < deadline ? (deadline - now) : null,
    });
  } catch (error) {
    console.error("❌ Error checking window status:", error);
    res.status(500).json({ error: "❌ Failed to check window status." });
  }
});

/* ===================================================
   Submission (with start-time + deadline gating)
   =================================================== */
router.post(
  "/",
  applicationSubmissionLimiter,
  upload.fields([
    { name: "resume", maxCount: 1 },
    { name: "transcript", maxCount: 1 },
    { name: "image", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      console.log("✅ Received application data:", req.body);
      console.log("✅ Received files:", req.files);

      // --- NEW: Start-time gate ---
      if (DEADLINE_CONFIG.isActive) {
        const now = nowUtc();
        const start = parseMaybeDate(DEADLINE_CONFIG.applicationStart);
        if (start && now < start) {
          addNoStore(res);
          return res.status(400).json({
            error: "Applications are not open yet.",
            message: DEADLINE_CONFIG.preStartMessage || "Please check back when the application opens.",
            start: start.toISOString(),
            serverTime: now.toISOString(),
            timeUntilStart: start - now
          });
        }
      }

      // Existing: deadline gate
      if (DEADLINE_CONFIG.isActive) {
        const now = nowUtc();
        const deadline = parseMaybeDate(DEADLINE_CONFIG.applicationDeadline);

        if (deadline && now > deadline) {
          addNoStore(res);
          return res.status(400).json({ 
            error: "Application deadline has passed.",
            message: DEADLINE_CONFIG.message,
            deadline: deadline.toISOString(),
            serverTime: now.toISOString()
          });
        }
      }

      // Validate required fields
      if (!req.body.fullName || !req.body.email) {
        return res.status(400).json({ error: "❌ Full Name and Email are required." });
      }

      // Create application
      const newApplication = new Application({
        email: req.body.email,
        fullName: req.body.fullName,
        studentYear: req.body.studentYear || "",
        major: req.body.major || "",
        appliedBefore: req.body.appliedBefore || "No",
        candidateType: req.body.candidateType || "Unknown",
        reason: req.body.reason || "",
        zombieAnswer: req.body.zombieAnswer || "",
        additionalInfo: req.body.additionalInfo || "",
        caseNightPreferences: Array.isArray(req.body.caseNightPreferences) 
          ? req.body.caseNightPreferences 
          : (req.body.caseNightPreferences ? 
              (typeof req.body.caseNightPreferences === 'string' && req.body.caseNightPreferences.startsWith('[') ? 
                JSON.parse(req.body.caseNightPreferences) : 
                [req.body.caseNightPreferences]) : 
              []),
        status: "Under Review",
        resume: req.files && req.files["resume"] ? 
          (isS3Configured() ? req.files["resume"][0].location : `/uploads/${req.files["resume"][0].filename}`) : null,
        transcript: req.files && req.files["transcript"] ? 
          (isS3Configured() ? req.files["transcript"][0].location : `/uploads/${req.files["transcript"][0].filename}`) : null,
        image: req.files && req.files["image"] ? 
          (isS3Configured() ? req.files["image"][0].location : `/uploads/${req.files["image"][0].filename}`) : null,
      });

      await newApplication.save();

      // Confirmation email (best-effort)
      try {
        const emailResult = await emailService.sendApplicationConfirmation(newApplication);
        if (emailResult.success) {
          console.log('✅ Confirmation email sent successfully to:', newApplication.email);
        } else {
          console.warn('⚠️ Failed to send confirmation email:', emailResult.error);
        }
      } catch (emailError) {
        console.error('❌ Error sending confirmation email:', emailError);
      }
      
      res.status(201).json({
        message: "✅ Application submitted successfully!",
        application: newApplication,
      });
    } catch (error) {
      console.error("❌ Error submitting application:", error);
      res.status(500).json({ error: "❌ Failed to submit application." });
    }
  }
);

// Back-compat: deadline status only (unchanged shape)
router.get("/deadline-status", (req, res) => {
  try {
    addNoStore(res);
    const now = nowUtc();
    const deadline = parseMaybeDate(DEADLINE_CONFIG.applicationDeadline);
    const isDeadlinePassed = deadline ? now > deadline : false;
    
    res.json({
      isActive: !!DEADLINE_CONFIG.isActive,
      isDeadlinePassed,
      deadline: deadline ? deadline.toISOString() : null,
      message: isDeadlinePassed ? DEADLINE_CONFIG.message : null,
      timeRemaining: (deadline && now < deadline) ? Math.max(0, deadline - now) : null
    });
  } catch (error) {
    console.error("Error checking deadline status:", error);
    res.status(500).json({ error: "Failed to check deadline status." });
  }
});

// All applications (array only)
router.get("/all", generalApiLimiter, async (req, res) => {
  try {
    addNoStore(res);
    const applications = await Application.find().sort({ createdAt: -1 }).lean();
    res.json(applications);
  } catch (error) {
    console.error("❌ Error fetching all applications:", error);
    res.status(500).json({ error: "❌ Failed to fetch applications." });
  }
});

// Paginated list
router.get("/", generalApiLimiter, async (req, res) => {
  try {
    addNoStore(res);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const maxLimit = 200;
    const actualLimit = Math.min(limit, maxLimit);
    const skip = (page - 1) * actualLimit;
    const totalApplications = await Application.countDocuments();
    const applications = await Application.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(actualLimit)
      .lean();
    const totalPages = Math.ceil(totalApplications / actualLimit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;
    
    res.json({
      applications,
      pagination: {
        currentPage: page,
        totalPages,
        totalApplications,
        applicationsPerPage: actualLimit,
        hasNextPage,
        hasPrevPage,
        nextPage: hasNextPage ? page + 1 : null,
        prevPage: hasPrevPage ? page - 1 : null
      }
    });
  } catch (error) {
    console.error("❌ Error fetching applications:", error);
    res.status(500).json({ error: "❌ Failed to fetch applications." });
  }
});

// Signed file URL
router.get("/file-url/*", generalApiLimiter, async (req, res) => {
  try {
    addNoStore(res);
    const filePath = req.params[0];
    if (!isS3Configured()) {
      return res.json({ url: `${process.env.BACKEND_URL || 'http://localhost:5002'}/${filePath}` });
    }
    let s3Key = filePath;
    if (filePath.includes('amazonaws.com/')) {
      s3Key = filePath.split('amazonaws.com/')[1];
    }
    const { getSignedUrl } = require("../config/s3Config");
    const signedUrl = getSignedUrl(s3Key, 3600);
    res.json({ url: signedUrl });
  } catch (error) {
    console.error("❌ Error generating file URL:", error);
    res.status(500).json({ error: "❌ Failed to generate file URL." });
  }
});

// By email
router.get("/email/:email", generalApiLimiter, async (req, res) => {
  try {
    addNoStore(res);
    const { email } = req.params;
    const application = await Application.findOne({ email: email });
    if (!application) {
      return res.status(404).json({ error: "❌ No application found for this email." });
    }
    res.json(application);
  } catch (error) {
    console.error("❌ Error fetching application by email:", error);
    res.status(500).json({ error: "❌ Failed to fetch application." });
  }
});

// By ID
router.get("/:id", generalApiLimiter, async (req, res) => {
  try {
    addNoStore(res);
    const { id } = req.params;
    const application = await Application.findById(id);
    if (!application) {
      return res.status(404).json({ error: "❌ No application found for this ID." });
    }
    res.json(application);
  } catch (error) {
    console.error("❌ Error fetching application by ID:", error);
    res.status(500).json({ error: "❌ Failed to fetch application." });
  }
});

// Update by email
router.put("/email/:email", generalApiLimiter, upload.fields([
  { name: "resume", maxCount: 1 },
  { name: "transcript", maxCount: 1 },
  { name: "image", maxCount: 1 },
]), async (req, res) => {
  try {
    addNoStore(res);
    const { email } = req.params;
    const existingApplication = await Application.findOne({ email: email });
    if (!existingApplication) {
      return res.status(404).json({ error: "❌ No application found for this email." });
    }

    const updateData = {
      fullName: req.body.fullName,
      studentYear: req.body.studentYear,
      major: req.body.major,
      appliedBefore: req.body.appliedBefore,
      candidateType: req.body.candidateType,
      reason: req.body.reason,
      zombieAnswer: req.body.zombieAnswer,
      additionalInfo: req.body.additionalInfo,
      caseNightPreferences: Array.isArray(req.body.caseNightPreferences) 
        ? req.body.caseNightPreferences 
        : (req.body.caseNightPreferences ? 
            (typeof req.body.caseNightPreferences === 'string' && req.body.caseNightPreferences.startsWith('[') ? 
              JSON.parse(req.body.caseNightPreferences) : 
              [req.body.caseNightPreferences]) : 
            []),
    };

    if (req.files && req.files["resume"]) {
      updateData.resume = isS3Configured() ? req.files["resume"][0].location : `/uploads/${req.files["resume"][0].filename}`;
    }
    if (req.files && req.files["transcript"]) {
      updateData.transcript = isS3Configured() ? req.files["transcript"][0].location : `/uploads/${req.files["transcript"][0].filename}`;
    }
    if (req.files && req.files["image"]) {
      updateData.image = isS3Configured() ? req.files["image"][0].location : `/uploads/${req.files["image"][0].filename}`;
    }

    const updatedApplication = await Application.findOneAndUpdate(
      { email: email },
      updateData,
      { new: true }
    );

    res.json({
      message: "✅ Application updated successfully!",
      application: updatedApplication,
    });
  } catch (error) {
    console.error("❌ Error updating application:", error);
    res.status(500).json({ error: "❌ Failed to update application." });
  }
});

// Status update
router.put("/:id", requireStatusChangePermission, async (req, res) => {
  try {
    addNoStore(res);
    const { status, changedBy, notes } = req.body;

    if (!["Under Review", "Case Night - Yes", "Case Night - No", "Final Interview - Yes", "Final Interview - No", "Final Interview - Maybe", "Accepted", "Rejected"].includes(status)) {
      return res.status(400).json({ error: "❌ Invalid status value" });
    }

    const currentApplication = await Application.findById(req.params.id);
    if (!currentApplication) {
      return res.status(404).json({ error: "❌ Application not found" });
    }

    const statusHistoryEntry = {
      status,
      changedBy: changedBy || "Unknown Admin",
      changedAt: new Date(),
      notes: notes || ""
    };

    const updatedApplication = await Application.findByIdAndUpdate(
      req.params.id,
      { 
        status,
        $push: { statusHistory: statusHistoryEntry }
      },
      { new: true }
    );

    res.json(updatedApplication);
  } catch (error) {
    console.error("❌ Error updating status:", error);
    res.status(500).json({ error: "❌ Failed to update application status." });
   }
});

// Comments
router.post("/:id/comment", requireCommentPermission, async (req, res) => {
  try {
    addNoStore(res);
    const { comment, adminEmail, adminName } = req.body;

    if (!comment || !adminEmail || !adminName) {
      return res.status(400).json({ error: "❌ Comment, admin email, and admin name are required." });
    }

    const application = await Application.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ error: "❌ Application not found" });
    }

    const commentEntry = {
      comment: comment.trim(),
      commentedBy: adminEmail,
      commentedAt: new Date(),
      adminName: adminName.trim()
    };

    const updatedApplication = await Application.findByIdAndUpdate(
      req.params.id,
      { $push: { comments: commentEntry } },
      { new: true }
    );

    res.json({
      message: "✅ Comment added successfully",
      comment: commentEntry,
      totalComments: updatedApplication.comments.length
    });
  } catch (error) {
    console.error("❌ Error adding comment:", error);
    res.status(500).json({ error: "❌ Failed to add comment." });
  }
});

module.exports = router;
