import { MemoryStore } from "./memory";
import { seed } from "./seed";
import { SupabaseStore } from "./supabase";
import type { DataStore } from "./store";

/**
 * Store selection. With Supabase credentials present the app talks to the real
 * database (already seeded, so nothing is written on boot). Without them it
 * falls back to an in-memory store with the demo world, which keeps local
 * development and the test suite runnable with no configuration.
 *
 * The instance is cached on globalThis so it survives hot reloads in dev and is
 * shared across requests within one server process.
 */
const globalForStore = globalThis as unknown as {
  __appStore?: DataStore;
  __appStoreReady?: Promise<void>;
};

const SUPABASE_URL = process.env.SUPABASE_URL || undefined;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || undefined;

export function isPersistent(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_SECRET_KEY);
}

/**
 * Demo mode opens two doors that must never stand open over real data: signing
 * in as any listed user without a password, and recording a sale from the
 * public simulator without a business's API secret.
 *
 * It is therefore tied to whether a real database is attached. Connect one and
 * both doors close by default; `DEMO_MODE` can force either answer, and
 * choosing `true` alongside a real database means accepting that anyone can
 * sign in as anyone.
 */
export function isDemoMode(): boolean {
  if (process.env.DEMO_MODE === "true") return true;
  if (process.env.DEMO_MODE === "false") return false;
  const demo = !isPersistent();
  if (demo && process.env.NODE_ENV === "production") {
    console.warn(
      "[BOOST] Running in DEMO mode in production: no database is configured, " +
        "so passwordless sign-in and the public simulator are enabled.",
    );
  }
  return demo;
}

export function getStore(): DataStore {
  if (!globalForStore.__appStore) {
    if (SUPABASE_URL && SUPABASE_SECRET_KEY) {
      globalForStore.__appStore = new SupabaseStore(SUPABASE_URL, SUPABASE_SECRET_KEY);
      globalForStore.__appStoreReady = Promise.resolve();
    } else {
      const memory = new MemoryStore();
      globalForStore.__appStore = memory;
      globalForStore.__appStoreReady = seed(memory).catch((e) => {
        console.error("Seed failed", e);
      });
    }
  }
  return globalForStore.__appStore;
}

/** Await this before serving requests so the in-memory demo data is visible */
export async function getReadyStore(): Promise<DataStore> {
  const store = getStore();
  await globalForStore.__appStoreReady;
  return store;
}
