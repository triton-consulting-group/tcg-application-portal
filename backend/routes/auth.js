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

module.exports = router;
