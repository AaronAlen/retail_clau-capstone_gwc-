import { Request } from "express";

export type UserRole = "admin" | "manager" | "staff";

export interface JwtPayload {
  id: string;
  role: UserRole;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}
