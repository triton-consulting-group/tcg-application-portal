const mongoose = require("mongoose");

// Build every index the schemas declare. Mongoose only does this implicitly when
// a model initializes, which can be skipped or lost when bufferCommands is off
// and the model loads before the connection is ready (e.g. a fresh database).
// A failure here (say, duplicate emails blocking a unique index) is logged but
// must not stop the server from starting.
const ensureIndexes = async () => {
    // Register every model so none is missed, whatever order the app loads them in.
    ["Admin", "Application", "CaseGroupAssignment", "CaseGroupBackup", "CaseGroupEditLog", "User"]
        .forEach((file) => require(`../models/${file}`));
    const names = mongoose.modelNames();
    const results = await Promise.allSettled(
        names.map((name) => mongoose.model(name).createIndexes())
    );
    results.forEach((result, i) => {
        if (result.status === "rejected") {
            console.error(`Index creation failed for ${names[i]}:`, result.reason.message);
        }
    });
    const ok = results.filter((r) => r.status === "fulfilled").length;
    console.log(`MongoDB indexes ensured for ${ok}/${names.length} models`);
};

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

        await ensureIndexes();

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
module.exports.ensureIndexes = ensureIndexes;
