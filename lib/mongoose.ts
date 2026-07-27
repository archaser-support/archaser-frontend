import mongoose from "mongoose";

// MongoDB connection configuration
// Read at connection time to ensure .env is loaded first
const getMongoDBUri = () => {
    return process.env.MONGODB_URI || "mongodb://localhost:27017/archaser";
};

// Mongoose connection options
const mongooseOptions = {
    maxPoolSize: 5, // Reduced pool size for quota-constrained clusters
    serverSelectionTimeoutMS: 30000, // Increased timeout for quota issues
    socketTimeoutMS: 60000, // Increased socket timeout
    bufferCommands: true, // Enable buffering for logging operations
    retryWrites: true,
    retryReads: true,
};

// Extend the Node.js global type to include `mongoose`
declare global {
    // eslint-disable-next-line no-var
    var mongooseInstance: typeof mongoose | undefined;
}

// Store global references in development
if (process.env.NODE_ENV !== "production") {
    global.mongooseInstance = mongoose;
}

// Initialize connection
const connectMongoDB = async (): Promise<typeof mongoose> => {
    try {
        if (mongoose.connection.readyState === 1) {
            return mongoose;
        }

        await mongoose.connect(getMongoDBUri(), mongooseOptions);
        return mongoose;
    } catch (error) {
        console.error("Failed to connect to MongoDB:", error);
        throw error;
    }
};

// Export connection function
export const ensureMongoConnection = connectMongoDB;

// Export a function to check connection health
export const checkMongoConnectionHealth = async (): Promise<boolean> => {
    try {
        if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
            await mongoose.connection.db.admin().ping();
            return true;
        }
        return false;
    } catch (error) {
        console.error("MongoDB connection health check failed:", error);
        return false;
    }
};

// Graceful shutdown
const gracefulShutdown = async () => {
    try {
        await mongoose.disconnect();
    } catch (error) {
        console.error("Error during MongoDB disconnect:", error);
    }
};

// Track if listeners have been registered to prevent duplicates
// Use global to persist across hot reloads in development
if (typeof global !== "undefined") {
    (global as any).__mongooseListenersRegistered =
        (global as any).__mongooseListenersRegistered || false;
}

// Handle process termination - only register listeners once
if (!(global as any).__mongooseListenersRegistered) {
    // Increase max listeners to prevent warnings during development hot reloading
    process.setMaxListeners(20);

    process.on("beforeExit", gracefulShutdown);
    process.on("SIGINT", async () => {
        await gracefulShutdown();
        process.exit(0);
    });
    process.on("SIGTERM", async () => {
        await gracefulShutdown();
        process.exit(0);
    });

    (global as any).__mongooseListenersRegistered = true;
}

// Export mongoose for direct use
export { mongoose };
export default mongoose;
