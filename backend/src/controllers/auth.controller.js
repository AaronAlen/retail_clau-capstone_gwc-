"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.refresh = exports.login = exports.register = void 0;
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const User_1 = __importDefault(require("../models/User"));
const jwt_1 = require("../utils/jwt");
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
    res.status(201).json({ id: user._id, name: user.name, email: user.email, role: user.role });
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
    res.json({
        accessToken,
        refreshToken,
        user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
});
exports.refresh = (0, express_async_handler_1.default)(async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
        res.status(400);
        throw new Error("refreshToken is required");
    }
    try {
        const decoded = (0, jwt_1.verifyRefreshToken)(refreshToken);
        const accessToken = (0, jwt_1.signAccessToken)({ id: decoded.id, role: decoded.role });
        res.json({ accessToken });
    }
    catch {
        res.status(401);
        throw new Error("Invalid or expired refresh token");
    }
});
//# sourceMappingURL=auth.controller.js.map