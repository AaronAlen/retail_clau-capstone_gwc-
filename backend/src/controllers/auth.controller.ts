import { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import User from "../models/User";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt";

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) {
    res.status(400);
    throw new Error("name, email and password are required");
  }
  const exists = await User.findOne({ email });
  if (exists) {
    res.status(409);
    throw new Error("Email already registered");
  }
  const user = await User.create({ name, email, password, role: role || "staff" });
  res.status(201).json({ id: user._id, name: user.name, email: user.email, role: user.role });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select("+password");
  if (!user || !(await user.comparePassword(password))) {
    res.status(401);
    throw new Error("Invalid email or password");
  }
  const payload = { id: String(user._id), role: user.role };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  res.json({
    accessToken,
    refreshToken,
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
  });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    res.status(400);
    throw new Error("refreshToken is required");
  }
  try {
    const decoded = verifyRefreshToken(refreshToken);
    const accessToken = signAccessToken({ id: decoded.id, role: decoded.role });
    res.json({ accessToken });
  } catch {
    res.status(401);
    throw new Error("Invalid or expired refresh token");
  }
});
