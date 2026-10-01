"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUser = exports.updateUserRole = exports.createUser = exports.listUsers = void 0;
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const User_1 = __importDefault(require("../models/User"));

exports.listUsers = (0, express_async_handler_1.default)(async (req, res) => {
    const users = await User_1.default.find().select("-password");
    res.json(users);
});

exports.createUser = (0, express_async_handler_1.default)(async (req, res) => {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
        res.status(400);
        throw new Error("Name, email, and password are required");
    }
    const exists = await User_1.default.findOne({ email });
    if (exists) {
        res.status(409);
        throw new Error("Email is already registered");
    }
    const user = await User_1.default.create({ name, email, password, role: role || "staff" });
    res.status(201).json({ _id: user._id, id: user._id, name: user.name, email: user.email, role: user.role });
});

exports.updateUserRole = (0, express_async_handler_1.default)(async (req, res) => {
    const { role } = req.body;
    const user = await User_1.default.findByIdAndUpdate(req.params.id, { role }, { new: true }).select("-password");
    if (!user) {
        res.status(404);
        throw new Error("User not found");
    }
    res.json(user);
});

exports.deleteUser = (0, express_async_handler_1.default)(async (req, res) => {
    const user = await User_1.default.findByIdAndDelete(req.params.id);
    if (!user) {
        res.status(404);
        throw new Error("User not found");
    }
    res.json({ message: "User deleted" });
});
//# sourceMappingURL=user.controller.js.map