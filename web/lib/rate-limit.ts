import { createHash } from "node:crypto";
import type { DataStore } from "./store/store";

/**
 * Throttling for the two endpoints that touch money.
 *
 * The limits are transport policy, not business rules, which is why they live
 * here and not in lib/domain — nothing about a coupon changes because a caller
 * is being noisy.
 *
 * Two tiers, because there are two different things worth stopping:
 *  - per IP, before any secret has been checked: floods, and anyone working
 *    through guesses at an api_secret.
 *  - per business, after the secret is known: a leaked key minting commissions
 *    the business will be billed for. This is the one that costs real money.
 */
export const WINDOW_SECONDS = 60;

/** Unauthenticated attempts from one address. A real store needs a handful. */
export const ANON_ATTEMPTS_PER_WINDOW = 30;

/** Calls presenting one api_secret. 120 sales a minute is a good problem. */
export const SECRET_CALLS_PER_WINDOW = 120;

export interface RateLimitResult {
  ok: boolean;
  /** Seconds until the current window rolls over — what to put in Retry-After */
  retryAfter: number;
}

const allowed: RateLimitResult = { ok: true, retryAfter: 0 };

function secondsLeftInWindow(now = Date.now()): number {
  const elapsed = Math.floor(now / 1000) % WINDOW_SECONDS;
  return WINDOW_SECONDS - elapsed;
}

/**
 * Count one hit and say whether the caller may proceed.
 *
 * Fails **open**. If the shared counter is unreachable we let the request
 * through and log it: a throttle that breaks must not stop a business from
 * recording real sales. That is a deliberate trade — an attacker who can break
 * the counter escapes the limit — and it is the right way round for an
 * endpoint whose failure mode is a shop unable to sell.
 */
export async function checkRateLimit(
  store: DataStore,
  key: string,
  limit: number,
): Promise<RateLimitResult> {
  let hits: number;
  try {
    hits = await store.rateLimitHit(key, WINDOW_SECONDS);
  } catch (e) {
    console.error("rate limit counter unavailable, allowing request", e);
    return allowed;
  }
  if (hits <= limit) return allowed;
  return { ok: false, retryAfter: secondsLeftInWindow() };
}

/**
 * The caller's address as Vercel reports it. x-forwarded-for is only
 * trustworthy because the platform sets it at the edge; behind any other proxy
 * this would be client-controlled and useless for throttling.
 */
/**
 * A bucket name for one api_secret, without a database lookup and without ever
 * writing a live secret into the rate_limits key column — that table is not
 * where credentials should end up. Throttling by secret rather than by
 * business also means the check runs before authentication, so a stolen key
 * cannot spend the budget of the business it was stolen from any faster than
 * the business itself can.
 */
export function secretBucket(apiSecret: string): string {
  return createHash("sha256").update(apiSecret).digest("hex").slice(0, 32);
}

export function callerIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}
