"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIO = exports.initSocket = void 0;
const socket_io_1 = require("socket.io");
let io = null;
const initSocket = (httpServer) => {
    io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: (origin, callback) => {
                // Allow all origins for real-time WebSocket updates across Vercel and local
                callback(null, true);
            },
            methods: ["GET", "POST"],
            credentials: true,
        },
    });
    io.on("connection", (socket) => {
        console.log(`[socket] client connected: ${socket.id}`);
        socket.on("disconnect", () => console.log(`[socket] client disconnected: ${socket.id}`));
    });
    return io;
};
exports.initSocket = initSocket;
const getIO = () => {
    if (!io)
        throw new Error("Socket.io not initialized");
    return io;
};
exports.getIO = getIO;
//# sourceMappingURL=index.js.map