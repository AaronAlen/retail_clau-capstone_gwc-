"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMe = exports.logout = exports.refresh = exports.login = exports.register = exports.getCookieOptions = void 0;
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const User_1 = __importDefault(require("../models/User"));
const jwt_1 = require("../utils/jwt");

const getCookieOptions = () => {
    const isProd = process.env.NODE_ENV === "production";
    return {
        httpOnly: true, // Prevents XSS script access
        secure: isProd, // Transmitted only over HTTPS in production
        sameSite: isProd ? "none" : "lax", // Allows cross-origin Vercel-to-Render in prod
        path: "/",
    };
};
exports.getCookieOptions = getCookieOptions;

exports.register = (0, express_async_handler_1.default)(async (req, res) => {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
        res.status(400);
        throw new Error("name, email and password are required");
    }
    const exists = await User_1.default.findOne({ email });
    if (exists) {
        res.status(409);
        throw new Error("Email already registered");
    }
    const user = await User_1.default.create({ name, email, password, role: role || "staff" });
    const payload = { id: String(user._id), role: user.role };
    const accessToken = (0, jwt_1.signAccessToken)(payload);
    const refreshToken = (0, jwt_1.signRefreshToken)(payload);

    const cookieOptions = (0, exports.getCookieOptions)();
    res.cookie("accessToken", accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
    res.cookie("refreshToken", refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });

    res.status(201).json({
        message: "User registered successfully",
        accessToken,
        refreshToken,
        user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
});

exports.login = (0, express_async_handler_1.default)(async (req, res) => {
    const { email, password } = req.body;
    const user = await User_1.default.findOne({ email }).select("+password");
    if (!user || !(await user.comparePassword(password))) {
        res.status(401);
        throw new Error("Invalid email or password");
    }
    const payload = { id: String(user._id), role: user.role };
    const accessToken = (0, jwt_1.signAccessToken)(payload);
    const refreshToken = (0, jwt_1.signRefreshToken)(payload);

    const cookieOptions = (0, exports.getCookieOptions)();
    res.cookie("accessToken", accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 }); // 15 mins
    res.cookie("refreshToken", refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 }); // 7 days

    res.json({
        message: "Login successful",
        accessToken,
        refreshToken,
        user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
});

exports.refresh = (0, express_async_handler_1.default)(async (req, res) => {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!token) {
        res.status(400);
        throw new Error("refreshToken is required in cookie or body");
    }
    try {
        const decoded = (0, jwt_1.verifyRefreshToken)(token);
        const newAccessToken = (0, jwt_1.signAccessToken)({ id: decoded.id, role: decoded.role });

        const cookieOptions = (0, exports.getCookieOptions)();
        res.cookie("accessToken", newAccessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 });

        res.json({ accessToken: newAccessToken, message: "Token refreshed successfully" });
    }
    catch {
        res.status(401);
        throw new Error("Invalid or expired refresh token");
    }
});

exports.logout = (0, express_async_handler_1.default)(async (_req, res) => {
    const cookieOptions = (0, exports.getCookieOptions)();
    res.clearCookie("accessToken", cookieOptions);
    res.clearCookie("refreshToken", cookieOptions);
    res.json({ message: "Logged out successfully. Secure cookies cleared." });
});

exports.getMe = (0, express_async_handler_1.default)(async (req, res) => {
    const user = await User_1.default.findById(req.user?.id).select("-password");
    if (!user) {
        res.status(404);
        throw new Error("User not found");
    }
    res.json({ user: { id: user._id, name: user.name, email: user.email, role: user.role } });
});
//# sourceMappingURL=auth.controller.js.map