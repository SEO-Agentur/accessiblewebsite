import { randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import type { AstroCookies } from 'astro';
import { users, sessions, type User } from '@accessiblewebsite/db';
import { db } from './db';

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const SESSION_RENEW_THRESHOLD_MS = SESSION_DURATION_MS / 2;
export const SESSION_COOKIE = 'session';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

export async function createSession(userId: string): Promise<{
  token: string;
  expiresAt: Date;
}> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await db().insert(sessions).values({ id: token, userId, expiresAt });
  return { token, expiresAt };
}

/**
 * Look up the session by token, return the joined user if valid. Sliding
 * expiry: if the session is more than half-spent, extend it.
 */
export async function validateSession(token: string): Promise<User | null> {
  const rows = await db()
    .select({ user: users, session: sessions })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, token))
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  if (row.session.expiresAt.getTime() < Date.now()) {
    await deleteSession(token);
    return null;
  }

  if (row.session.expiresAt.getTime() - Date.now() < SESSION_RENEW_THRESHOLD_MS) {
    const newExpiry = new Date(Date.now() + SESSION_DURATION_MS);
    await db().update(sessions).set({ expiresAt: newExpiry }).where(eq(sessions.id, token));
  }

  return row.user;
}

export async function deleteSession(token: string): Promise<void> {
  await db().delete(sessions).where(eq(sessions.id, token));
}

export function setSessionCookie(
  cookies: AstroCookies,
  token: string,
  expiresAt: Date,
): void {
  cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

export function clearSessionCookie(cookies: AstroCookies): void {
  cookies.delete(SESSION_COOKIE, { path: '/' });
}

export async function readSessionUser(cookies: AstroCookies): Promise<User | null> {
  const token = cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return validateSession(token);
}
