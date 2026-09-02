import { NextResponse } from "next/server";
import { normalizeCode } from "@/lib/domain/logic";
import { getReadyStore } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * The influencer's tracking link: /r/ABCD-1234
 *
 * Three jobs, in this order of importance:
 *
 *  1. Send the visitor to the business's shop with the coupon already
 *     attached, so a sale is not lost to someone who forgot to type a code.
 *  2. Count the visit, so the influencer can see their post working within
 *     minutes instead of learning nothing until someone buys.
 *  3. Never become tracking. We add one to a per-code, per-day counter and
 *     that is all: no visitor id, no cookie, no fingerprint, no referrer
 *     stored, nothing that can be correlated with anything else. "How many
 *     people came" does not require knowing who they were.
 *
 * Attribution is unchanged: per the terms, the code entered at checkout wins.
 * This link carries the code — it does not compete with it.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code: raw } = await params;
  const origin = new URL(request.url).origin;
  const store = await getReadyStore();

  const code = await store.getCodeByCode(normalizeCode(raw ?? ""));
  if (!code || code.status !== "active") {
    return NextResponse.redirect(`${origin}/campaigns?link=unknown`, 302);
  }

  const campaign = await store.getCampaign(code.campaignId);
  if (!campaign || campaign.status !== "active") {
    return NextResponse.redirect(`${origin}/campaigns?link=ended`, 302);
  }

  const business = await store.getBusiness(campaign.businessId);

  // Counting must never cost the visitor their click. If the counter is down,
  // they still reach the shop and the influencer still gets paid for the sale.
  try {
    await store.recordCodeClick(code.id);
  } catch (e) {
    console.error("[BOOST] click not recorded", { codeId: code.id, e });
  }

  const target = safeShopUrl(business?.storeUrl, code.code);
  if (!target) {
    // No shop address on file: show the campaign rather than a dead end.
    return NextResponse.redirect(`${origin}/campaigns?code=${encodeURIComponent(code.code)}`, 302);
  }
  return NextResponse.redirect(target, 302);
}

/**
 * Businesses type their own shop address, so it is untrusted input. Anything
 * that is not a plain http(s) URL is refused rather than turned into an open
 * redirect that would let a stored `javascript:` or a lookalike domain ride
 * out on our link and our reputation.
 */
function safeShopUrl(storeUrl: string | undefined, code: string): string | null {
  if (!storeUrl) return null;
  let url: URL;
  try {
    url = new URL(storeUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  // Most carts read a coupon from the query string; the ones that do not still
  // get the visitor, and the code is in the influencer's post either way.
  url.searchParams.set("coupon", code);
  return url.toString();
}
