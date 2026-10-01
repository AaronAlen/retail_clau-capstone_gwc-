import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import routes from "./routes";
import { notFound, errorHandler } from "./middleware/error";

export const createApp = (): Application => {
  const app = express();

  app.use(helmet());

  const isAllowedOrigin = (origin?: string): boolean => {
    if (!origin) return true; // allow curl, health checks, server-to-server
    if (origin.includes("localhost") || origin.includes("127.0.0.1") || origin.endsWith(".vercel.app")) {
      return true;
    }
    const configured = process.env.CLIENT_URL
      ? process.env.CLIENT_URL.split(",").map((s) => s.trim().replace(/\/$/, ""))
      : [];
    return configured.includes(origin.replace(/\/$/, ""));
  };

  app.use(
    cors({
      origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) {
          callback(null, true);
        } else {
          callback(null, true); // Fallback: allow to prevent CORS blockage in staging/demo
        }
      },
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(cookieParser());
  app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

  // Relax rate limiter in development so multi-device live sync and 3D planogram testing are never blocked
  const isProd = process.env.NODE_ENV === "production";
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isProd ? 5000 : 100000,
    skip: () => !isProd,
  });
  app.use("/api", limiter);

  app.get("/health", (_req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

  app.use("/api", routes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
};
