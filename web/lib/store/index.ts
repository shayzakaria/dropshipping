import { MemoryStore } from "./memory";
import { seed } from "./seed";
import type { DataStore } from "./store";

/**
 * Store singleton. Kept on globalThis so it survives Next.js hot reloads in
 * dev and is shared across server components / actions within one server
 * process. NOTE: in-memory data resets on redeploy/cold start — this is the
 * demo backend; the Supabase adapter will replace this module's internals
 * without changing its interface.
 */
const globalForStore = globalThis as unknown as {
  __appStore?: MemoryStore;
  __appStoreReady?: Promise<void>;
};

export function getStore(): DataStore {
  if (!globalForStore.__appStore) {
    globalForStore.__appStore = new MemoryStore();
    globalForStore.__appStoreReady = seed(globalForStore.__appStore).catch((e) => {
      console.error("Seed failed", e);
    });
  }
  return globalForStore.__appStore;
}

/** Await this before serving requests so seeded data is visible */
export async function getReadyStore(): Promise<DataStore> {
  const store = getStore();
  await globalForStore.__appStoreReady;
  return store;
}
