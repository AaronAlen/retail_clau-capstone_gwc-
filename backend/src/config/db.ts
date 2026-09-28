import mongoose from "mongoose";
import dns from "dns";

dns.setDefaultResultOrder("ipv4first");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

export const connectDB = async (): Promise<void> => {
  const uri = process.env.MONGO_URI || "mongodb://localhost:27017/velocity_retail";
  try {
    await mongoose.connect(uri);
    console.log(`[db] MongoDB connected: ${mongoose.connection.host}`);
  } catch (err) {
    console.error("[db] MongoDB connection failed:", err);
    process.exit(1);
  }
};
