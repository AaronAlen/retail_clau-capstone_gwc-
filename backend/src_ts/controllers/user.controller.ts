import { Response } from "express";
import asyncHandler from "express-async-handler";
import User from "../models/User";
import { AuthRequest } from "../types";

export const listUsers = asyncHandler(async (req: AuthRequest, res: Response) => {
  const users = await User.find().select("-password");
  res.json(users);
});

export const createUser = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) {
    res.status(400);
    throw new Error("Name, email, and password are required");
  }
  const exists = await User.findOne({ email });
  if (exists) {
    res.status(409);
    throw new Error("Email is already registered");
  }
  const user = await User.create({ name, email, password, role: role || "staff" });
  res.status(201).json({ _id: user._id, id: user._id, name: user.name, email: user.email, role: user.role });
});

export const updateUserRole = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { role } = req.body;
  const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select("-password");
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }
  res.json(user);
});

export const deleteUser = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }
  res.json({ message: "User deleted" });
});
