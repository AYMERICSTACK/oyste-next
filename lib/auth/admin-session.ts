import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db/prisma";

const COOKIE_NAME = "oyste_admin_session";
const SESSION_DURATION = 60 * 60 * 12;
type Payload = { adminId: string; expiresAt: number };

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET est manquante.");
  return value;
}
function encode(payload: Payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${createHmac("sha256", secret()).update(body).digest("base64url")}`;
}
function decode(token: string): Payload | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = createHmac("sha256", secret()).update(body).digest("base64url");
  const a = Buffer.from(signature); const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as Payload;
    return payload.adminId && payload.expiresAt > Math.floor(Date.now() / 1000) ? payload : null;
  } catch { return null; }
}
export async function createAdminSession(adminId: string) {
  const store = await cookies();
  store.set(COOKIE_NAME, encode({ adminId, expiresAt: Math.floor(Date.now() / 1000) + SESSION_DURATION }), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_DURATION });
}
export async function clearAdminSession() {
  const store = await cookies();
  store.set(COOKIE_NAME, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
}
export async function getCurrentAdmin() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  const payload = token ? decode(token) : null;
  if (!payload) return null;
  return prisma.adminUser.findUnique({ where: { id: payload.adminId }, select: { id: true, email: true, firstName: true, lastName: true, role: true, status: true, lastLoginAt: true } });
}
