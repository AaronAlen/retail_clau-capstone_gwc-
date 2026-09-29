"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUser = exports.updateUserRole = exports.listUsers = void 0;
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const User_1 = __importDefault(require("../models/User"));
exports.listUsers = (0, express_async_handler_1.default)(async (req, res) => {
    const users = await User_1.default.find().select("-password");
    res.json(users);
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