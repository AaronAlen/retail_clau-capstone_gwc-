import { Response, NextFunction } from "express";
import { AuthRequest } from "../types";
import { verifyAccessToken } from "../utils/jwt";

export const protect = (req: AuthRequest, res: Response, next: NextFunction) => {
  const cookieToken = req.cookies?.accessToken || req.cookies?.token;
  const header = req.headers.authorization;
  const bearerToken = header && header.startsWith("Bearer ") ? header.split(" ")[1] : null;
  const token = cookieToken || bearerToken;

  if (!token) {
    return res.status(401).json({ message: "Not authorized, no token provided in cookie or header" });
  }

  try {
    req.user = verifyAccessToken(token);
    next();
  } catch (err) {
    return res.status(401).json({ message: "Not authorized, token invalid or expired" });
  }
};
