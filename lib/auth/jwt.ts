import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-key";

export interface JwtPayload {
  userId: string;
  email: string;
  role: "editor" | "reviewer" | "admin";
  iat: number;
  exp: number;
}

export function generateToken(payload: Omit<JwtPayload, "iat" | "exp">) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "24h" });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

export function extractToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7);
}

export function verifyRequest(request: NextRequest): JwtPayload | null {
  const token = extractToken(request);
  if (!token) return null;
  return verifyToken(token);
}
