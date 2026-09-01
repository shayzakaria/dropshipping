import { NextResponse } from "next/server";
import { DomainError } from "@/lib/domain/logic";
import { redeemCode } from "@/lib/domain/service";
import { getReadyStore } from "@/lib/store";

export const dynamic = "force-dynamic";

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

  const store = await getReadyStore();
  try {
    const r = await redeemCode(store, {
      code,
      orderAmount,
      customerRef,
      apiSecret,
      source: "api",
    });
    return NextResponse.json({
      ok: true,
      redemption: {
        id: r.id,
        order_amount: r.orderAmount,
        buyer_discount: r.buyerDiscount,
        influencer_commission: r.influencerCommission,
        platform_fee: r.platformFee,
        tier: r.tier,
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
