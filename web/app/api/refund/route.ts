import { NextResponse } from "next/server";
import { DomainError, parseCancellationReason } from "@/lib/domain/logic";
import { cancelRedemption } from "@/lib/domain/service";
import { getReadyStore } from "@/lib/store";
import { ANON_ATTEMPTS_PER_WINDOW, callerIp, checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

function tooMany(retryAfter: number) {
  return NextResponse.json(
    { ok: false, code: "RATE_LIMITED", message: "יותר מדי בקשות. נסו שוב בעוד רגע" },
    { status: 429, headers: { "retry-after": String(retryAfter) } },
  );
}

/**
 * Called by the business's store when an order is refunded or cancelled, so
 * the commission is voided before it becomes payable. Authenticated by the
 * business's api_secret, which also identifies which business is calling.
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, code: "BAD_JSON", message: "גוף הבקשה חייב להיות JSON" },
      { status: 400 },
    );
  }

  const apiSecret = typeof body.api_secret === "string" ? body.api_secret : "";
  const externalOrderId = typeof body.order_id === "string" ? body.order_id : undefined;
  const redemptionId = typeof body.redemption_id === "string" ? body.redemption_id : undefined;
  // Unrecognised or absent falls back to "returned" — this endpoint is the
  // refund hook, so that is the truthful default rather than a guess.
  const reason = parseCancellationReason(body.reason);

  const store = await getReadyStore();

  const anon = await checkRateLimit(store, `refund:ip:${callerIp(request)}`, ANON_ATTEMPTS_PER_WINDOW);
  if (!anon.ok) return tooMany(anon.retryAfter);

  const business = apiSecret ? await store.getBusinessByApiSecret(apiSecret) : null;
  if (!business) {
    return NextResponse.json(
      { ok: false, code: "BAD_SECRET", message: "מפתח ה-API אינו מוכר" },
      { status: 401 },
    );
  }
  if (!externalOrderId && !redemptionId) {
    return NextResponse.json(
      { ok: false, code: "MISSING_ORDER", message: "צריך order_id או redemption_id" },
      { status: 400 },
    );
  }

  try {
    const r = await cancelRedemption(store, {
      businessId: business.id,
      externalOrderId,
      redemptionId,
      reason,
    });
    return NextResponse.json({
      ok: true,
      redemption: { id: r.id, status: r.status, influencer_commission: r.influencerCommission },
    });
  } catch (e) {
    if (e instanceof DomainError) {
      const status = e.code === "REDEMPTION_NOT_FOUND" ? 404 : 409;
      return NextResponse.json({ ok: false, code: e.code, message: e.message }, { status });
    }
    console.error("refund failed", e);
    return NextResponse.json({ ok: false, code: "INTERNAL", message: "שגיאה פנימית" }, { status: 500 });
  }
}
