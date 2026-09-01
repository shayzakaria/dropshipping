import { cookies } from "next/headers";
import { getReadyStore } from "./store";
import type { User } from "./domain/types";

const SESSION_COOKIE = "demo_uid";

/**
 * Demo session: a signed-in user id in an httpOnly cookie. Will be replaced
 * by Supabase Auth (the cookie handling moves to @supabase/ssr) — callers
 * only ever use getCurrentUser / setSession / clearSession.
 */
export async function getCurrentUser(): Promise<User | null> {
  const jar = await cookies();
  const uid = jar.get(SESSION_COOKIE)?.value;
  if (!uid) return null;
  const store = await getReadyStore();
  return store.getUser(uid);
}

export async function setSession(userId: string): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}
