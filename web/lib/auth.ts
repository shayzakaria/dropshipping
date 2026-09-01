import { cookies } from "next/headers";
import { getReadyStore, isDemoMode } from "./store";
import { getAuthClient, isAuthConfigured } from "./supabase-auth";
import type { User } from "./domain/types";

const SESSION_COOKIE = "demo_uid";

/**
 * Who is making this request.
 *
 * A real Supabase session wins. The demo cookie is only honoured while demo
 * mode is on, so connecting a database closes passwordless sign-in even for
 * a visitor still holding an old cookie.
 */
export async function getCurrentUser(): Promise<User | null> {
  const store = await getReadyStore();

  if (isAuthConfigured()) {
    const supabase = await getAuthClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      return store.getUserByAuthId(data.user.id);
    }
  }

  if (!isDemoMode()) return null;
  const jar = await cookies();
  const uid = jar.get(SESSION_COOKIE)?.value;
  if (!uid) return null;
  return store.getUser(uid);
}

/** Demo sign-in only. Real sessions are established by Supabase Auth. */
export async function setSession(userId: string): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  if (isAuthConfigured()) {
    const supabase = await getAuthClient();
    await supabase.auth.signOut();
  }
}
