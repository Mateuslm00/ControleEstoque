import { randomBytes, createHash } from "node:crypto";
import { prisma } from "../../db/prisma.js";
import { env } from "../../config/env.js";

const SESSION_COOKIE_NAME = "sid";

export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashToken(token: string): string {
  // O token bruto so existe no cookie do cliente; guardamos apenas o hash.
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(params: {
  userId: string;
  ip?: string;
  userAgent?: string;
}): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + env.SESSION_ABSOLUTE_TTL_HOURS * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      userId: params.userId,
      tokenHash,
      ip: params.ip,
      userAgent: params.userAgent,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

export async function revokeSession(tokenHash: string): Promise<void> {
  await prisma.session.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllUserSessions(userId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function findValidSession(token: string) {
  const tokenHash = hashToken(token);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt.getTime() < Date.now()) return null;
  if (session.user.status !== "ACTIVE") return null;

  const idleLimitMs = env.SESSION_IDLE_TTL_MINUTES * 60 * 1000;
  if (Date.now() - session.lastSeenAt.getTime() > idleLimitMs) {
    await revokeSession(tokenHash);
    return null;
  }

  // Sliding idle window: atualiza last_seen_at sem estender o TTL absoluto.
  await prisma.session.update({
    where: { id: session.id },
    data: { lastSeenAt: new Date() },
  });

  return session;
}

export const sessionCookieOptions = {
  name: SESSION_COOKIE_NAME,
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: "strict" as const,
  path: "/",
  domain: env.COOKIE_DOMAIN === "localhost" ? undefined : env.COOKIE_DOMAIN,
};

export { SESSION_COOKIE_NAME };
