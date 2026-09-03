import { NextResponse } from "next/server";
import { notifySale } from "@/lib/email/events";
import { DomainError } from "@/lib/domain/logic";
import { redeemCode } from "@/lib/domain/service";
import { getReadyStore } from "@/lib/store";
import {
  ANON_ATTEMPTS_PER_WINDOW,
  SECRET_CALLS_PER_WINDOW,
  secretBucket,
  callerIp,
  checkRateLimit,
} from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

function tooMany(retryAfter: number) {
  return NextResponse.json(
    { ok: false, code: "RATE_LIMITED", message: "יותר מדי בקשות. נסו שוב בעוד רגע" },
    { status: 429, headers: { "retry-after": String(retryAfter) } },
  );
}

/**
 * The store-integration endpoint: a business's e-commerce checkout calls this
 * to validate a coupon and record the sale. Authenticated per business via
 * api_secret (issued at business creation, shown in the business dashboard).
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, code: "BAD_JSON", message: "גוף הבקשה חייב להיות JSON" }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code : "";
  const orderAmount = Number(body.order_amount);
  const customerRef = typeof body.customer_ref === "string" ? body.customer_ref : undefined;
  const apiSecret = typeof body.api_secret === "string" ? body.api_secret : undefined;
  // Optional but strongly recommended: with it, a retried webhook is harmless
  const externalOrderId = typeof body.order_id === "string" ? body.order_id : undefined;

  const store = await getReadyStore();

  // Before the secret is looked at, so guessing at one costs the guesser.
  const anon = await checkRateLimit(store, `redeem:ip:${callerIp(request)}`, ANON_ATTEMPTS_PER_WINDOW);
  if (!anon.ok) return tooMany(anon.retryAfter);

  // And per key, because a leaked secret is the expensive case: every call it
  // makes bills a real business for a real commission. Keyed by a hash, so no
  // extra lookup and no live secret in the counter table.
  if (apiSecret) {
    const perSecret = await checkRateLimit(
      store,
      `redeem:key:${secretBucket(apiSecret)}`,
      SECRET_CALLS_PER_WINDOW,
    );
    if (!perSecret.ok) return tooMany(perSecret.retryAfter);
  }

  try {
    const r = await redeemCode(store, {
      code,
      orderAmount,
      customerRef,
      apiSecret,
      externalOrderId,
      source: "api",
    });
    await notifySale(store, r);
    return NextResponse.json({
      ok: true,
      redemption: {
        id: r.id,
        order_amount: r.orderAmount,
        buyer_discount: r.buyerDiscount,
        influencer_commission: r.influencerCommission,
        platform_fee: r.platformFee,
        tier: r.tier,
        status: r.status,
        commission_available_at: r.holdUntil,
        created_at: r.createdAt,
      },
    });
  } catch (e) {
    if (e instanceof DomainError) {
      const status = e.code === "BAD_SECRET" ? 401 : 400;
      return NextResponse.json({ ok: false, code: e.code, message: e.message }, { status });
    }
    console.error("redeem failed", e);
    return NextResponse.json({ ok: false, code: "INTERNAL", message: "שגיאה פנימית" }, { status: 500 });
  }
}
