const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db");

dotenv.config(); // Load environment variables
connectDB(); // Connect to MongoDB

const app = express();
app.use(cors());
app.use(express.json());

// Import routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/applications", require("./routes/applications"));

// Example routes
app.get("/", (req, res) => {
    res.send("Backend is running!");
});

const PORT = process.env.PORT || 5002;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
