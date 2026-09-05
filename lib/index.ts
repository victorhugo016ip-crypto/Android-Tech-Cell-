import { PrismaClient } from "@prisma/client";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const db = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret-change-me");

export async function createSession(userId:string) {
  const token = await new SignJWT({ userId }).setProtectedHeader({alg:"HS256"}).setIssuedAt().setExpirationTime("7d").sign(secret);
  (await cookies()).set("atc_session", token, {httpOnly:true, sameSite:"lax", secure:process.env.NODE_ENV==="production", path:"/", maxAge:60*60*24*7});
}
export async function getSession() {
  const token = (await cookies()).get("atc_session")?.value;
  if (!token) return null;
  try { return (await jwtVerify(token, secret)).payload as {userId:string}; } catch { return null; }
}
export async function requireUser() {
  const s = await getSession(); if (!s?.userId) throw new Error("UNAUTHORIZED");
  const user = await db.user.findUnique({where:{id:s.userId}});
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new Error("FORBIDDEN");
  return user;
}
