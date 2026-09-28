import { Response } from "express";
import asyncHandler from "express-async-handler";
import User from "../models/User";
import { AuthRequest } from "../types";

export const listUsers = asyncHandler(async (req: AuthRequest, res: Response) => {
  const users = await User.find().select("-password");
  res.json(users);
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
