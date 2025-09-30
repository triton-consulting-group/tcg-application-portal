const express = require("express");
const multer = require("multer");
const router = express.Router();
const Application = require("../models/Application");
const path = require("path");
const { applicationSubmissionLimiter, generalApiLimiter } = require("../middleware/rateLimiter");
const CASE_NIGHT_CONFIG = require("../config/caseNightConfig");
const { emailService } = require("../config/emailConfig");

// 🟢 Set up Multer storage for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // Store files in "uploads/" directory
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname.replace(/\s+/g, "_")); // Generate unique filename
  },
});
const upload = multer({ storage });

// 🟢 Get case night configuration
router.get("/case-night-config", (req, res) => {
  try {
    res.json(CASE_NIGHT_CONFIG);
  } catch (error) {
    console.error("❌ Error fetching case night config:", error);
    res.status(500).json({ error: "❌ Failed to fetch case night config." });
  }
});

// 🟢 Test email configuration
router.get("/test-email", async (req, res) => {
  try {
    const result = await emailService.testEmailConfig();
    if (result.success) {
      res.json({ 
        message: "✅ Email configuration is valid",
        status: "healthy"
      });
    } else {
      res.status(500).json({ 
        error: "❌ Email configuration error",
        details: result.error
      });
    }
  } catch (error) {
    console.error("❌ Error testing email config:", error);
    res.status(500).json({ error: "❌ Failed to test email configuration." });
  }
});

// 🟢 Handle application submission
router.post(
  "/",
  applicationSubmissionLimiter, // Apply rate limiting
  upload.fields([
    { name: "resume", maxCount: 1 },
    { name: "transcript", maxCount: 1 },
    { name: "image", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      console.log("✅ Received application data:", req.body);
      console.log("✅ Received files:", req.files);

      // 🔴 Validate required fields
      if (!req.body.fullName || !req.body.email) {
        return res.status(400).json({ error: "❌ Full Name and Email are required." });
      }

      // 🟢 Create new application with **default status**
      const newApplication = new Application({
        email: req.body.email,
        fullName: req.body.fullName,
        studentYear: req.body.studentYear || "",
        major: req.body.major || "",
        appliedBefore: req.body.appliedBefore || "No",
        candidateType: req.body.candidateType || "Unknown",
        reason: req.body.reason || "",
        caseNightPreferences: req.body.caseNightPreferences || [],
        status: "Under Review", // ✅ Default status when a new application is created

        resume: req.files && req.files["resume"] ? `/uploads/${req.files["resume"][0].filename}` : null,
        transcript: req.files && req.files["transcript"] ? `/uploads/${req.files["transcript"][0].filename}` : null,
        image: req.files && req.files["image"] ? `/uploads/${req.files["image"][0].filename}` : null,
      });

      await newApplication.save();
      
      // Send confirmation email to the applicant
      try {
        const emailResult = await emailService.sendApplicationConfirmation(newApplication);
        if (emailResult.success) {
          console.log('✅ Confirmation email sent successfully to:', newApplication.email);
        } else {
          console.warn('⚠️ Failed to send confirmation email:', emailResult.error);
        }
      } catch (emailError) {
        console.error('❌ Error sending confirmation email:', emailError);
        // Don't fail the application submission if email fails
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

// 🟢 Fetch all applications (backward compatible - returns array only)
router.get("/all", generalApiLimiter, async (req, res) => {
  try {
    const applications = await Application.find()
      .sort({ createdAt: -1 })
      .lean();
    res.json(applications);
  } catch (error) {
    console.error("❌ Error fetching all applications:", error);
    res.status(500).json({ error: "❌ Failed to fetch applications." });
  }
});

// 🟢 Fetch all applications with pagination
router.get("/", generalApiLimiter, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const maxLimit = 200; // Maximum limit to prevent overload
    
    // Ensure limit doesn't exceed maximum
    const actualLimit = Math.min(limit, maxLimit);
    
    // Calculate skip value for pagination
    const skip = (page - 1) * actualLimit;
    
    // Get total count for pagination info
    const totalApplications = await Application.countDocuments();
    
    // Fetch applications with pagination
    const applications = await Application.find()
      .sort({ createdAt: -1 }) // Sort by newest first
      .skip(skip)
      .limit(actualLimit)
      .lean(); // Use lean() for better performance
    
    // Calculate pagination info
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

// 🟢 Fetch application by email
router.get("/email/:email", generalApiLimiter, async (req, res) => {
  try {
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

// 🟢 Update application by email
router.put("/email/:email", generalApiLimiter, upload.fields([
  { name: "resume", maxCount: 1 },
  { name: "transcript", maxCount: 1 },
  { name: "image", maxCount: 1 },
]), async (req, res) => {
  try {
    const { email } = req.params;
    
    // Find existing application
    const existingApplication = await Application.findOne({ email: email });
    
    if (!existingApplication) {
      return res.status(404).json({ error: "❌ No application found for this email." });
    }

    // Prepare update data
    const updateData = {
      fullName: req.body.fullName,
      studentYear: req.body.studentYear,
      major: req.body.major,
      appliedBefore: req.body.appliedBefore,
      candidateType: req.body.candidateType,
      reason: req.body.reason,
      caseNightPreferences: req.body.caseNightPreferences,
    };

    // Handle file updates
    if (req.files && req.files["resume"]) {
      updateData.resume = `/uploads/${req.files["resume"][0].filename}`;
    }
    if (req.files && req.files["transcript"]) {
      updateData.transcript = `/uploads/${req.files["transcript"][0].filename}`;
    }
    if (req.files && req.files["image"]) {
      updateData.image = `/uploads/${req.files["image"][0].filename}`;
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

// 🟢 Update Application Status API
router.put("/:id", async (req, res) => {
  try {
    const { status, changedBy, notes } = req.body;

    // ✅ Validate allowed status values
    if (!["Under Review", "Case Night - Yes", "Case Night - No", "Final Interview - Yes", "Final Interview - No", "Final Interview - Maybe", "Accepted", "Rejected"].includes(status)) {
      return res.status(400).json({ error: "❌ Invalid status value" });
    }

    // Find the current application to get the old status
    const currentApplication = await Application.findById(req.params.id);
    if (!currentApplication) {
      return res.status(404).json({ error: "❌ Application not found" });
    }

    // Create status history entry
    const statusHistoryEntry = {
      status: status,
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
      { new: true } // ✅ Returns the updated document
    );

    res.json(updatedApplication);
  } catch (error) {
    console.error("❌ Error updating status:", error);
    res.status(500).json({ error: "❌ Failed to update application status." });
  }
});

// ✅ Export Router
module.exports = router;
