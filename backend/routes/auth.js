const express = require("express");
const router = express.Router();
const User = require("../models/User");

// Get user role based on email
router.get("/role/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ role: user.role });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Create or update user
router.post("/register", async (req, res) => {
  try {
    const { email, name } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Check if user already exists
    let user = await User.findOne({ email });
    
    if (user) {
      // Update existing user
      user.name = name || user.name;
      await user.save();
      res.json({ message: "User updated", role: user.role });
    } else {
      // Create new user with default role "applicant"
      user = new User({
        email,
        name: name || "",
        role: "applicant" // Default role for new users
      });
      await user.save();
      res.status(201).json({ message: "User created", role: user.role });
    }
  } catch (error) {
    console.error("Error creating/updating user:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
