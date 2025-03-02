const express = require("express");
const multer = require("multer");
const router = express.Router();
const Application = require("../models/Application");
const path = require("path");

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

// 🟢 Handle application submission
router.post(
  "/",
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
        status: "Under Review", // ✅ Default status when a new application is created

        resume: req.files["resume"] ? `/uploads/${req.files["resume"][0].filename}` : null,
        transcript: req.files["transcript"] ? `/uploads/${req.files["transcript"][0].filename}` : null,
        image: req.files["image"] ? `/uploads/${req.files["image"][0].filename}` : null,
      });

      await newApplication.save();
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

// 🟢 Fetch all applications
router.get("/", async (req, res) => {
  try {
    const applications = await Application.find(); // Fetch all applications
    res.json(applications);
  } catch (error) {
    console.error("❌ Error fetching applications:", error);
    res.status(500).json({ error: "❌ Failed to fetch applications." });
  }
});

// 🟢 Update Application Status API
router.put("/:id", async (req, res) => {
  try {
    const { status } = req.body;

    // ✅ Validate allowed status values
    if (!["Under Review", "Maybe", "Accepted", "Rejected"].includes(status)) {
      return res.status(400).json({ error: "❌ Invalid status value" });
    }

    const updatedApplication = await Application.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true } // ✅ Returns the updated document
    );

    if (!updatedApplication) {
      return res.status(404).json({ error: "❌ Application not found" });
    }

    res.json(updatedApplication);
  } catch (error) {
    console.error("❌ Error updating status:", error);
    res.status(500).json({ error: "❌ Failed to update application status." });
  }
});

// ✅ Export Router
module.exports = router;
