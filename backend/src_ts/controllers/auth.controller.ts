import { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import User from "../models/User";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt";

export const getCookieOptions = () => {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true, // Prevents XSS script access
    secure: isProd, // Transmitted only over HTTPS in production
    sameSite: (isProd ? "none" : "lax") as "none" | "lax", // Allows cross-origin Vercel-to-Render in prod
    path: "/",
  };
};

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
  const payload = { id: String(user._id), role: user.role };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  const cookieOptions = getCookieOptions();
  res.cookie("accessToken", accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
  res.cookie("refreshToken", refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });

  res.status(201).json({
    message: "User registered successfully",
    accessToken,
    refreshToken,
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
  });
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

  const cookieOptions = getCookieOptions();
  res.cookie("accessToken", accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 }); // 15 mins
  res.cookie("refreshToken", refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 }); // 7 days

  res.json({
    message: "Login successful",
    accessToken,
    refreshToken,
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
  });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.refreshToken || req.body?.refreshToken;
  if (!token) {
    res.status(400);
    throw new Error("refreshToken is required in cookie or body");
  }
  try {
    const decoded = verifyRefreshToken(token);
    const newAccessToken = signAccessToken({ id: decoded.id, role: decoded.role });

    const cookieOptions = getCookieOptions();
    res.cookie("accessToken", newAccessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 });

    res.json({ accessToken: newAccessToken, message: "Token refreshed successfully" });
  } catch {
    res.status(401);
    throw new Error("Invalid or expired refresh token");
  }
});

export const logout = asyncHandler(async (_req: Request, res: Response) => {
  const cookieOptions = getCookieOptions();
  res.clearCookie("accessToken", cookieOptions);
  res.clearCookie("refreshToken", cookieOptions);
  res.json({ message: "Logged out successfully. Secure cookies cleared." });
});

export const getMe = asyncHandler(async (req: any, res: Response) => {
  const user = await User.findById(req.user?.id).select("-password");
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }
  res.json({ user: { id: user._id, name: user.name, email: user.email, role: user.role } });
});
