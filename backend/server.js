const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db");

dotenv.config(); // Load environment variables
connectDB(); // Connect to MongoDB

const app = express();
app.use(cors());
app.use(express.json());

try {
    const applicationsRoutes = require("./routes/applications");
    app.use("/api/applications", applicationsRoutes);
    console.log("✅ /api/applications route successfully registered");
  } catch (error) {
    console.error("❌ Failed to register /api/applications:", error);
  }
  
// Import routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/applications", require("./routes/applications"));
app.use("/api/admin", require("./routes/admin"));
app.use("/uploads", express.static("uploads"));


// Example routes
app.get("/", (req, res) => {
    res.send("Backend is running!");
});

const PORT = process.env.PORT || 5002;

app._router.stack.forEach((middleware) => {
    if (middleware.route) { // Routes registered directly
      console.log("Registered Route:", middleware.route.path);
    } else if (middleware.name === "router") { // Routes registered via router
      middleware.handle.stack.forEach((route) => {
        if (route.route) {
          console.log("Registered Route:", route.route.path);
        }
      });
    }
  });
  
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
