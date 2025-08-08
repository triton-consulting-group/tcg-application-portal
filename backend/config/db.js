const mongoose = require("mongoose");

const connectDB = async () => {
    try {
        console.log("Connecting to MongoDB with optimized settings...");
        
        // Optimized connection options for better performance (scaled for 300+ applications)
        const conn = await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            // Connection pool settings (scaled for higher volume)
            maxPoolSize: 100, // Increased from 50 to 100
            minPoolSize: 10,  // Increased from 5 to 10
            maxIdleTimeMS: 60000, // Increased from 30s to 60s
            serverSelectionTimeoutMS: 10000, // Increased from 5s to 10s
            socketTimeoutMS: 60000, // Increased from 45s to 60s
            bufferCommands: false, // Disable mongoose buffering
        });
        
        console.log(`MongoDB Connected: ${conn.connection.host}`);
        
        // Set up connection event handlers
        mongoose.connection.on('error', (err) => {
            console.error('MongoDB connection error:', err);
        });
        
        mongoose.connection.on('disconnected', () => {
            console.log('MongoDB disconnected');
        });
        
        mongoose.connection.on('reconnected', () => {
            console.log('MongoDB reconnected');
        });
        
    } catch (error) {
        console.error("Error connecting to MongoDB:");
        console.error(error.message);
        process.exit(1);
    }
};

module.exports = connectDB;
