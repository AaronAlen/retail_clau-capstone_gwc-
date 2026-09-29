"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDB = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const dns_1 = __importDefault(require("dns"));
dns_1.default.setDefaultResultOrder("ipv4first");
dns_1.default.setServers(["8.8.8.8", "8.8.4.4"]);
const connectDB = async () => {
    const uri = process.env.MONGO_URI || "mongodb://localhost:27017/velocity_retail";
    try {
        await mongoose_1.default.connect(uri);
        console.log(`[db] MongoDB connected: ${mongoose_1.default.connection.host}`);
    }
    catch (err) {
        console.error("[db] MongoDB connection failed:", err);
        process.exit(1);
    }
};
exports.connectDB = connectDB;
//# sourceMappingURL=db.js.map