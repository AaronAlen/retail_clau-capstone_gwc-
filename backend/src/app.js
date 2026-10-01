"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const routes_1 = __importDefault(require("./routes"));
const error_1 = require("./middleware/error");
const createApp = () => {
    const app = (0, express_1.default)();
    app.use((0, helmet_1.default)());
    const isAllowedOrigin = (origin) => {
        if (!origin)
            return true; // allow curl, health checks, server-to-server
        if (origin.includes("localhost") || origin.includes("127.0.0.1") || origin.endsWith(".vercel.app")) {
            return true;
        }
        const configured = process.env.CLIENT_URL
            ? process.env.CLIENT_URL.split(",").map((s) => s.trim().replace(/\/$/, ""))
            : [];
        return configured.includes(origin.replace(/\/$/, ""));
    };
    app.use((0, cors_1.default)({
        origin: (origin, callback) => {
            if (isAllowedOrigin(origin)) {
                callback(null, true);
            }
            else {
                callback(null, true); // Fallback: allow to prevent CORS blockage in staging/demo
            }
        },
        credentials: true,
    }));
    app.use(express_1.default.json());
    app.use((0, cookie_parser_1.default)());
    app.use((0, morgan_1.default)(process.env.NODE_ENV === "production" ? "combined" : "dev"));
    // Relax rate limiter in development so multi-device live sync and 3D planogram testing are never blocked
    const isProd = process.env.NODE_ENV === "production";
    const limiter = (0, express_rate_limit_1.default)({
        windowMs: 15 * 60 * 1000,
        max: isProd ? 5000 : 100000,
        skip: () => !isProd,
    });
    app.use("/api", limiter);
    app.get("/health", (_req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));
    app.use("/api", routes_1.default);
    app.use(error_1.notFound);
    app.use(error_1.errorHandler);
    return app;
};
exports.createApp = createApp;
//# sourceMappingURL=app.js.map