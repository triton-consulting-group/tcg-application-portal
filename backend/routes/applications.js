const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
    res.send("All applications route");
});

module.exports = router;
