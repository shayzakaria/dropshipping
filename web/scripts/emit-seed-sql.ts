/**
 * Emits the demo world as plain INSERT statements.
 *
 * The rows are produced by running the real seed through the real domain
 * logic against an in-memory store, so the money splits and tier progression
 * in the SQL are exactly what redeemCode() computes — the SQL carries data,
 * never a second copy of the rules.
 *
 * Run: npx vitest run scripts/emit-seed-sql.ts  (vitest compiles the TS)
 */
import { writeFileSync } from "node:fs";
import { MemoryStore } from "../lib/store/memory";
import { seed } from "../lib/store/seed";

const q = (v: string | null | undefined) =>
  v === null || v === undefined ? "null" : `'${v.replace(/'/g, "''")}'`;

export async function emit(outPath: string): Promise<string> {
  const store = new MemoryStore();
  await seed(store);

  const lines: string[] = ["begin;"];

  for (const u of store.users.values()) {
    lines.push(
      `insert into public.profiles (id, name, email, role, created_at) values (${q(u.id)}, ${q(u.name)}, ${q(u.email)}, ${q(u.role)}, ${q(u.createdAt)});`,
    );
  }
  for (const b of store.businesses.values()) {
    lines.push(
      `insert into public.businesses (id, owner_id, name, store_url, api_secret, created_at) values (${q(b.id)}, ${q(b.ownerId)}, ${q(b.name)}, ${q(b.storeUrl)}, ${q(b.apiSecret)}, ${q(b.createdAt)});`,
    );
  }
  for (const c of store.campaigns.values()) {
    lines.push(
      `insert into public.campaigns (id, business_id, title, description, buyer_discount_pct, influencer_pct, platform_pct, new_customers_only, max_redemptions_per_month, status, created_at) values (${q(c.id)}, ${q(c.businessId)}, ${q(c.title)}, ${q(c.description)}, ${c.buyerDiscountPct}, ${c.influencerPct}, ${c.platformPct}, ${c.newCustomersOnly}, ${c.maxRedemptionsPerMonth ?? "null"}, ${q(c.status)}, ${q(c.createdAt)});`,
    );
  }
  for (const c of store.codes.values()) {
    lines.push(
      `insert into public.coupon_codes (id, campaign_id, influencer_id, code, status, created_at) values (${q(c.id)}, ${q(c.campaignId)}, ${q(c.influencerId)}, ${q(c.code)}, ${q(c.status)}, ${q(c.createdAt)});`,
    );
  }
  for (const r of store.redemptions.values()) {
    lines.push(
      `insert into public.redemptions (id, code_id, campaign_id, business_id, influencer_id, order_amount, buyer_discount, influencer_commission, platform_fee, tier, tier_bonus_pct, customer_hash, source, created_at) values (${q(r.id)}, ${q(r.codeId)}, ${q(r.campaignId)}, ${q(r.businessId)}, ${q(r.influencerId)}, ${r.orderAmount}, ${r.buyerDiscount}, ${r.influencerCommission}, ${r.platformFee}, ${q(r.tier)}, ${r.tierBonusPct}, ${q(r.customerHash)}, ${q(r.source)}, ${q(r.createdAt)});`,
    );
  }

  lines.push("commit;");
  const sql = lines.join("\n");
  writeFileSync(outPath, sql);
  return sql;
}
