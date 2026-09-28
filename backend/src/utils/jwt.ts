import jwt, { SignOptions } from "jsonwebtoken";
import { JwtPayload } from "../types";

export const signAccessToken = (payload: JwtPayload): string =>
  jwt.sign(payload, process.env.JWT_ACCESS_SECRET as string, {
    expiresIn: (process.env.JWT_ACCESS_EXPIRES || "15m") as SignOptions["expiresIn"],
  });

export const signRefreshToken = (payload: JwtPayload): string =>
  jwt.sign(payload, process.env.JWT_REFRESH_SECRET as string, {
    expiresIn: (process.env.JWT_REFRESH_EXPIRES || "7d") as SignOptions["expiresIn"],
  });

export const verifyAccessToken = (token: string): JwtPayload =>
  jwt.verify(token, process.env.JWT_ACCESS_SECRET as string) as JwtPayload;

export const verifyRefreshToken = (token: string): JwtPayload =>
  jwt.verify(token, process.env.JWT_REFRESH_SECRET as string) as JwtPayload;
