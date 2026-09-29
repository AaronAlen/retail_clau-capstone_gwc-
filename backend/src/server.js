"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
// Velocity Retail API Server - Ready
dotenv_1.default.config();
const http_1 = __importDefault(require("http"));
const app_1 = require("./app");
const db_1 = require("./config/db");
const sockets_1 = require("./sockets");
const dns_1 = __importDefault(require("dns"));
dns_1.default.setDefaultResultOrder("ipv4first");
dns_1.default.setServers(["8.8.8.8", "8.8.4.4"]);
const PORT = process.env.PORT || 5000;
const start = async () => {
    await (0, db_1.connectDB)();
    const app = (0, app_1.createApp)();
    const server = http_1.default.createServer(app);
    (0, sockets_1.initSocket)(server);
    server.listen(PORT, () => {
        console.log(`[server] Velocity Retail API running on port ${PORT}`);
    });
};
start().catch((err) => {
    console.error("[server] Failed to start:", err);
    process.exit(1);
});
//# sourceMappingURL=server.js.map