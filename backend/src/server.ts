import dotenv from "dotenv";
// Velocity Retail API Server - Ready
dotenv.config();

import http from "http";
import { createApp } from "./app";
import { connectDB } from "./config/db";
import { initSocket } from "./sockets";
import dns from "dns";

dns.setDefaultResultOrder("ipv4first");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB();
  const app = createApp();
  const server = http.createServer(app);
  initSocket(server);

  server.listen(PORT, () => {
    console.log(`[server] Velocity Retail API running on port ${PORT}`);
  });
};

start().catch((err) => {
  console.error("[server] Failed to start:", err);
  process.exit(1);
});
