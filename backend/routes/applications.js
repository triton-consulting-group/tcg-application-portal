const express = require("express");
const multer = require("multer");
const multerS3 = require("multer-s3");
const router = express.Router();
const Application = require("../models/Application");
const path = require("path");
const { applicationSubmissionLimiter, generalApiLimiter } = require("../middleware/rateLimiter");
const { requireStatusChangePermission, requireCommentPermission, requireAdminAuth } = require("../middleware/adminPermissions");
const CASE_NIGHT_CONFIG = require("../config/caseNightConfig");
const DEADLINE_CONFIG = require("../config/deadlineConfig");
const { s3, S3_CONFIG, getFileTypeAndPath, getFileUrl, isS3Configured } = require("../config/s3Config");

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
  
  const region = process.env.AWS_REGION || 'us-west-1';
  
  // Create a dedicated S3 instance specifically for multer-s3 with bulletproof region config
  const AWS = require('aws-sdk');
  
  // Set global AWS region configuration
  AWS.config.update({
    region: region || 'us-west-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    signatureVersion: 'v4'
  });
  
  // Force AWS SDK to use explicit configuration
  const multerS3Instance = new AWS.S3({
    region: region || 'us-west-1',
    signatureVersion: 'v4',
    s3ForcePathStyle: false,
    useAccelerateEndpoint: false
    // Remove explicit endpoint - let AWS SDK determine it automatically
  });
  
  console.log(`📍 Multer S3 instance region: ${region}`);
  console.log(`🪣 Target bucket: ${S3_CONFIG.bucketName}`);
  console.log(`� S3 instance config:`, {
    region: multerS3Instance.config.region,
    endpoint: multerS3Instance.endpoint?.host || 'auto-detected'
  });
  
  storage = multerS3({
    s3: s3, // Use the pre-configured S3 instance from s3Config
    bucket: S3_CONFIG.bucketName,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    acl: 'private',
    serverSideEncryption: 'AES256',
    cacheControl: 'max-age=31536000',
    key: function (req, file, cb) {
      try {
        const { fileType, s3Path } = getFileTypeAndPath(file.fieldname, file.mimetype);
        const originalName = file.originalname || "file";
        const normalized = originalName.normalize("NFC");
        const ext = path.extname(normalized);
        const nameWithoutExt = path.basename(normalized, ext);

        // Special handling for images - more aggressive sanitization
        if (file.fieldname === 'image') {
          console.log(`🖼️ Processing profile picture: ${originalName}`);
          // For images, use an even more conservative approach
          let safeName = nameWithoutExt
            .replace(/[^\x00-\x7F]/g, "") // Remove all non-ASCII completely
            .replace(/[^a-zA-Z0-9]/g, "") // Only allow alphanumeric
            .substring(0, 20); // Limit length
          
          if (!safeName || safeName.length === 0) {
            safeName = "profile_image";
          }
          
          const finalName = `${safeName}${ext}`;
          const s3Key = `${s3Path}${Date.now()}-${finalName}`; // No encoding for images
          
          console.log(`🖼️ Image S3 upload key: ${s3Key}`);
          console.log(`🖼️ Image sanitized filename: ${finalName}`);
          cb(null, s3Key);
          return;
        }

        // Regular handling for other files
        let safeName = nameWithoutExt
          .replace(/[^\x00-\x7F]/g, "_")
          .replace(/[^a-zA-Z0-9._-]/g, "_")
          .replace(/_{2,}/g, "_")
          .replace(/^_+|_+$/g, "");

        if (!safeName) safeName = `file_${fileType}`;

        const finalName = `${safeName}${ext}`;
        const s3Key = `${s3Path}${Date.now()}-${encodeURIComponent(finalName)}`;

        console.log(`📁 S3 upload key: ${s3Key}`);
        console.log(`🔤 Original filename: ${originalName}`);
        console.log(`🔤 Sanitized filename: ${finalName}`);
        
        cb(null, s3Key);
      } catch (err) {
        console.error('❌ Error generating S3 key:', err);
        cb(err);
      }
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
    filename: (req, file, cb) => {
      // IMPROVED local filename sanitization - same logic as S3
      const originalName = file.originalname;
      const fileExtension = path.extname(originalName);
      const nameWithoutExt = originalName.replace(fileExtension, '');
      
      let sanitizedName = nameWithoutExt
        .replace(/[^\x00-\x7F]/g, '_') // Replace all non-ASCII with underscore
        .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace remaining special chars
        .replace(/_{2,}/g, '_') // Replace multiple underscores with single
        .replace(/^_+|_+$/g, ''); // Remove leading/trailing underscores
      
      // If name becomes empty (all Chinese), use a fallback
      if (!sanitizedName || sanitizedName.length === 0) {
        sanitizedName = 'file';
      }
      
      const finalFilename = `${Date.now()}-${sanitizedName}${fileExtension}`;
      console.log(`📁 Local storage filename: ${finalFilename}`);
      console.log(`🔤 Original filename: ${originalName}`);
      console.log(`🔤 Sanitized filename: ${sanitizedName}${fileExtension}`);
      cb(null, finalFilename);
    },
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

// Debug route to test S3 upload configuration
router.post("/debug-s3", async (req, res) => {
  try {
    const region = process.env.AWS_REGION || 'us-west-1';
    
    console.log('🧪 Testing S3 upload configuration...');
    console.log('📍 Region:', region);
    console.log('🪣 Bucket:', process.env.S3_BUCKET_NAME);
    
    // Test a simple putObject operation
    const testParams = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: 'test/debug-test.txt',
      Body: 'Debug test file',
      ContentType: 'text/plain',
      ServerSideEncryption: 'AES256'
    };
    
    const result = await s3.putObject(testParams).promise();
    console.log('✅ S3 upload test successful:', result);
    
    res.json({
      success: true,
      message: 'S3 upload test successful',
      region: region,
      bucket: process.env.S3_BUCKET_NAME
    });
  } catch (error) {
    console.error('❌ S3 upload test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: error.code,
      region: error.region
    });
  }
});

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
   File Upload Error Handler Middleware
   =================================================== */
const handleUploadError = (error, req, res, next) => {
  console.error('❌ Upload error:', error);
  console.error('📍 Error region:', error.region);
  console.error('🔧 Expected region:', process.env.AWS_REGION || 'us-west-1');
  
  if (error.code === 'SignatureDoesNotMatch') {
    console.error('🔐 S3 Signature error - likely caused by special characters in filename');
    console.error('🔍 Debugging info:');
    console.error('   - AWS_REGION env var:', process.env.AWS_REGION);
    console.error('   - S3_BUCKET_NAME:', process.env.S3_BUCKET_NAME);
    console.error('   - Error region:', error.region);
    
    // Check if this is likely an image upload issue
    const isImageError = req.files && req.files.image;
    const errorMessage = isImageError 
      ? "❌ Profile picture upload failed. Please rename your image file using only English letters and numbers (e.g., 'profile.jpg' instead of '照片.jpg')."
      : "❌ File upload failed. Please make sure your file names don't contain special characters.";
    
    return res.status(400).json({ error: errorMessage });
  }
  
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ 
      error: "❌ File too large. Maximum file size is 10MB." 
    });
  }
  
  if (error.message && error.message.includes('File type')) {
    return res.status(400).json({ error: error.message });
  }
  
  // Default error
  return res.status(500).json({ 
    error: "❌ File upload error. Please try again." 
  });
};

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
  handleUploadError, // Add error handler for upload errors
  async (req, res) => {
    try {
      const startTime = Date.now();
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

      const beforeDbSave = Date.now();
      await newApplication.save();
      const afterDbSave = Date.now();
      console.log(`✅ Application saved to database: ${newApplication._id}`);
      console.log(`⏱️ Database save took: ${afterDbSave - beforeDbSave}ms`);

      // Send response immediately
      const beforeResponse = Date.now();
      res.status(201).json({
        message: "✅ Application submitted successfully!",
        application: newApplication,
      });
      const afterResponse = Date.now();
      console.log(`⏱️ Response sent (${afterResponse - beforeResponse}ms)`);
      console.log(`⏱️ Total request time: ${afterResponse - startTime}ms`);
    } catch (error) {
      console.error("❌ Error submitting application:", error);
      
      // Check for specific S3 signature errors
      if (error.message && error.message.includes('signature')) {
        console.error("🔐 S3 Signature Error - likely caused by special characters in filename");
        res.status(400).json({ 
          error: "❌ File upload failed. Please make sure your file names don't contain special characters."
        });
      } else if (error.code === 'SignatureDoesNotMatch') {
        console.error("🔐 S3 SignatureDoesNotMatch - likely caused by special characters in filename");
        res.status(400).json({ 
          error: "❌ File upload failed. Please make sure your file names don't contain special characters." 
        });
      } else if (error.message && error.message.includes('Access Denied')) {
        console.error("🚫 S3 Access Denied - Check bucket permissions");
        res.status(500).json({ 
          error: "❌ File upload permission error. Please contact support." 
        });
      } else if (error.name === 'MulterError') {
        console.error("📁 Multer Error:", error.code);
        if (error.code === 'LIMIT_FILE_SIZE') {
          res.status(413).json({ 
            error: "❌ File too large. Maximum file size is 10MB." 
          });
        } else {
          res.status(400).json({ 
            error: "❌ File upload error. Please check your files and try again." 
          });
        }
      } else {
        res.status(500).json({ error: "❌ Failed to submit application." });
      }
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
router.get("/all", generalApiLimiter, requireAdminAuth, async (req, res) => {
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
router.get("/", generalApiLimiter, requireAdminAuth, async (req, res) => {
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

// By email - allow applicants to view their own application
router.get("/email/:email", generalApiLimiter, async (req, res) => {
  try {
    addNoStore(res);
    const { email } = req.params;
    const application = await Application.findOne({ email: email });
    if (!application) {
      return res.status(404).json({ error: "❌ No application found for this email." });
    }
    // Only return limited info or require the user to be the owner
    // For now, we allow it but this could be enhanced with authentication
    res.json(application);
  } catch (error) {
    console.error("❌ Error fetching application by email:", error);
    res.status(500).json({ error: "❌ Failed to fetch application." });
  }
});

router.get("/export-by-status", generalApiLimiter, requireAdminAuth, async (req, res) => {
  try {
    let { statuses } = req.query;
    
    if (!statuses) {
      return res.status(400).json({ error: "❌ Statuses parameter is required" });
    }

    // Parse applications by statuses, comma separated
    const statusArray = Array.isArray(statuses) 
      ? statuses.map(s => s.trim())
      : statuses.split(',').map(s => s.trim());

    const applications = await Application.find({ 
      status: { $in: statusArray } 
    })
      .sort({ createdAt: -1 })
      .lean();

    if (applications.length === 0) {
      return res.status(404).json({ error: "❌ No applications found for specified statuses" });
    }

    // Create CSV content
    const csvHeaders = [
      'Name',
      'Email',
      'Major',
      'Student Year',
      'Candidate Type',
      'Case Night Preferences',
      'Status',
      'Applied Before',
      'Reason',
      'Zombie Answer',
      'Additional Info',
      'Created Date',
      'Created Time',
      'Updated Date',
      'Updated Time'
    ];

    const csvRows = [csvHeaders.join(',')];

    applications.forEach(app => {
      const row = [
        `"${(app.fullName || '').replace(/"/g, '""')}"`, // Escape quotes in CSV
        app.email || '',
        `"${(app.major || '').replace(/"/g, '""')}"`,
        app.studentYear || '',
        app.candidateType || '',
        `"${(app.caseNightPreferences || []).join(', ').replace(/"/g, '""')}"`,
        app.status || '',
        app.appliedBefore || '',
        `"${(app.reason || '').replace(/"/g, '""')}"`,
        `"${(app.zombieAnswer || '').replace(/"/g, '""')}"`,
        `"${(app.additionalInfo || '').replace(/"/g, '""')}"`,
        new Date(app.createdAt).toLocaleString(), // Splits across two cells due to comma
        new Date(app.updatedAt).toLocaleString()
      ];
      csvRows.push(row.join(','));
    });


    const csvContent = csvRows.join('\n');

    // Set response headers for file download
    res.setHeader('Content-Type', 'text/csv');
    const statusLabel = statusArray.length === 1 
      ? statusArray[0].replace(/[^a-zA-Z0-9]/g, '-') 
      : 'multiple-statuses';
    res.setHeader('Content-Disposition', `attachment; filename="applicants-${statusLabel}-${new Date().toISOString().split('T')[0]}.csv"`);
    
    res.send(csvContent);

  } catch (error) {
    console.error("❌ Error exporting applications by status:", error);
    res.status(500).json({ error: "❌ Failed to export applications by status/." });
  }
});

// By ID - require admin authentication
router.get("/:id", generalApiLimiter, requireAdminAuth, async (req, res) => {
  try {
    addNoStore(res);
    const { id } = req.params;
    
    // Check if the ID looks like an email parameter (common mistake)
    if (id.includes('email=')) {
      return res.status(400).json({ 
        error: "❌ Invalid request format. Use /api/applications/email/{email} to find by email.",
        hint: "It looks like you're trying to search by email. Use the correct endpoint format."
      });
    }
    
    // Validate that the ID is a valid MongoDB ObjectId
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(400).json({ 
        error: "❌ Invalid ID format. Expected a 24-character hexadecimal string.",
        receivedId: id
      });
    }
    
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
