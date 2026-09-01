import { describe, expect, it, vi } from "vitest";
import {
  ANON_ATTEMPTS_PER_WINDOW,
  callerIp,
  checkRateLimit,
  secretBucket,
  WINDOW_SECONDS,
} from "@/lib/rate-limit";
import { MemoryStore } from "@/lib/store/memory";

describe("checkRateLimit", () => {
  it("allows exactly the limit and refuses the next one", async () => {
    const store = new MemoryStore();
    for (let i = 0; i < 5; i++) {
      expect((await checkRateLimit(store, "k", 5)).ok).toBe(true);
    }
    const over = await checkRateLimit(store, "k", 5);
    expect(over.ok).toBe(false);
    expect(over.retryAfter).toBeGreaterThan(0);
    expect(over.retryAfter).toBeLessThanOrEqual(WINDOW_SECONDS);
  });

  it("counts each key separately", async () => {
    const store = new MemoryStore();
    for (let i = 0; i < 3; i++) await checkRateLimit(store, "a", 3);
    expect((await checkRateLimit(store, "a", 3)).ok).toBe(false);
    expect((await checkRateLimit(store, "b", 3)).ok).toBe(true);
  });

  it("starts a fresh budget in the next window", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-09-01T12:00:00Z"));
      const store = new MemoryStore();
      for (let i = 0; i < 2; i++) await checkRateLimit(store, "k", 2);
      expect((await checkRateLimit(store, "k", 2)).ok).toBe(false);

      vi.setSystemTime(new Date(`2026-09-01T12:00:00Z`).getTime() + WINDOW_SECONDS * 1000);
      expect((await checkRateLimit(store, "k", 2)).ok).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("fails open when the shared counter is unreachable", async () => {
    // A throttle that breaks must not stop a shop from recording real sales.
    const store = new MemoryStore();
    store.rateLimitHit = async () => {
      throw new Error("database is down");
    };
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect((await checkRateLimit(store, "k", 1)).ok).toBe(true);
      expect((await checkRateLimit(store, "k", 1)).ok).toBe(true);
      expect(spy).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});

describe("secretBucket", () => {
  it("never contains the secret it buckets", () => {
    const secret = "07ba260f-f843-4095-a812-7b00d7dfa39b";
    const bucket = secretBucket(secret);
    expect(bucket).not.toContain(secret);
    expect(bucket).not.toContain("07ba260f");
    expect(bucket).toMatch(/^[0-9a-f]{32}$/);
  });

  it("is stable, and different for different secrets", () => {
    expect(secretBucket("a")).toBe(secretBucket("a"));
    expect(secretBucket("a")).not.toBe(secretBucket("b"));
  });
});

describe("callerIp", () => {
  it("takes the first hop of x-forwarded-for", () => {
    const r = new Request("https://x.test", {
      headers: { "x-forwarded-for": "203.0.113.7, 70.41.3.18" },
    });
    expect(callerIp(r)).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip, then to a constant", () => {
    expect(callerIp(new Request("https://x.test", { headers: { "x-real-ip": "198.51.100.2" } })))
      .toBe("198.51.100.2");
    expect(callerIp(new Request("https://x.test"))).toBe("unknown");
  });

  it("shares one bucket across callers it cannot tell apart", async () => {
    // "unknown" is a single bucket on purpose: an address we cannot identify
    // should not get an unlimited budget by being unidentifiable.
    const store = new MemoryStore();
    const key = `redeem:ip:${callerIp(new Request("https://x.test"))}`;
    for (let i = 0; i < ANON_ATTEMPTS_PER_WINDOW; i++) {
      expect((await checkRateLimit(store, key, ANON_ATTEMPTS_PER_WINDOW)).ok).toBe(true);
    }
    expect((await checkRateLimit(store, key, ANON_ATTEMPTS_PER_WINDOW)).ok).toBe(false);
  });
});
