import { Server as HTTPServer } from "http";
import { Server, Socket } from "socket.io";

let io: Server | null = null;

export const initSocket = (httpServer: HTTPServer): Server => {
  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        // Allow all origins for real-time WebSocket updates across Vercel and local
        callback(null, true);
      },
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket: Socket) => {
    console.log(`[socket] client connected: ${socket.id}`);
    socket.on("disconnect", () => console.log(`[socket] client disconnected: ${socket.id}`));
  });

  return io;
};

export const getIO = (): Server => {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
};
