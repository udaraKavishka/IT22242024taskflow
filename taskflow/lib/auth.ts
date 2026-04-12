import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Secret, SignOptions } from "jsonwebtoken";

const jwtSecret: Secret = process.env.JWT_SECRET || "dev-secret";
const jwtExpire: SignOptions["expiresIn"] =
  (process.env.TOKEN_EXPIRE_TIME as SignOptions["expiresIn"]) || "2h";

export const hashPassword = async (plain: string) => {
  return bcrypt.hash(plain, 10);
};

export const comparePassword = async (plain: string, hashed: string) => {
  return bcrypt.compare(plain, hashed);
};

export const signToken = (payload: { id: string; email: string }) => {
  return jwt.sign(payload, jwtSecret, { expiresIn: jwtExpire });
};

export const verifyToken = (token: string) => {
  return jwt.verify(token, jwtSecret) as { id: string; email: string };
};

export const extractBearerToken = (authorization?: string | null) => {
  if (!authorization) return null;
  const [scheme, token] = authorization.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
};
