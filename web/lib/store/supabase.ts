import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  Business,
  Campaign,
  CampaignStatus,
  CouponCode,
  Redemption,
  RedemptionStatus,
  TierName,
  User,
} from "../domain/types";
import { generateCode, normalizeCode } from "../domain/logic";
import type { DataStore } from "./store";

/**
 * Supabase-backed DataStore. Runs server-side only with the project's secret
 * key: every table has RLS enabled with no policies, so the anon key can read
 * nothing and all access flows through this class. Business rules live in
 * lib/domain — this file only maps rows.
 */

const num = (v: unknown) => Number(v);

type ProfileRow = {
  id: string;
  name: string;
  email: string;
  role: User["role"];
  created_at: string;
};
type BusinessRow = {
  id: string;
  owner_id: string;
  name: string;
  store_url: string | null;
  api_secret: string;
  created_at: string;
};
type CampaignRow = {
  id: string;
  business_id: string;
  title: string;
  description: string | null;
  buyer_discount_pct: number | string;
  influencer_pct: number | string;
  platform_pct: number | string;
  new_customers_only: boolean;
  max_redemptions_per_month: number | null;
  status: CampaignStatus;
  created_at: string;
};
type CodeRow = {
  id: string;
  campaign_id: string;
  influencer_id: string;
  code: string;
  status: CouponCode["status"];
  created_at: string;
};
type RedemptionRow = {
  id: string;
  code_id: string;
  campaign_id: string;
  business_id: string;
  influencer_id: string;
  order_amount: number | string;
  buyer_discount: number | string;
  influencer_commission: number | string;
  platform_fee: number | string;
  tier: TierName;
  tier_bonus_pct: number | string;
  customer_ref: string | null;
  external_order_id: string | null;
  status: RedemptionStatus;
  hold_until: string;
  source: Redemption["source"];
  created_at: string;
};

const toUser = (r: ProfileRow): User => ({
  id: r.id,
  name: r.name,
  email: r.email,
  role: r.role,
  createdAt: r.created_at,
});

const toBusiness = (r: BusinessRow): Business => ({
  id: r.id,
  ownerId: r.owner_id,
  name: r.name,
  storeUrl: r.store_url ?? undefined,
  apiSecret: r.api_secret,
  createdAt: r.created_at,
});

const toCampaign = (r: CampaignRow): Campaign => ({
  id: r.id,
  businessId: r.business_id,
  title: r.title,
  description: r.description ?? undefined,
  buyerDiscountPct: num(r.buyer_discount_pct),
  influencerPct: num(r.influencer_pct),
  platformPct: num(r.platform_pct),
  newCustomersOnly: r.new_customers_only,
  maxRedemptionsPerMonth: r.max_redemptions_per_month ?? undefined,
  status: r.status,
  createdAt: r.created_at,
});

const toCode = (r: CodeRow): CouponCode => ({
  id: r.id,
  campaignId: r.campaign_id,
  influencerId: r.influencer_id,
  code: r.code,
  status: r.status,
  createdAt: r.created_at,
});

const toRedemption = (r: RedemptionRow): Redemption => ({
  id: r.id,
  codeId: r.code_id,
  campaignId: r.campaign_id,
  businessId: r.business_id,
  influencerId: r.influencer_id,
  orderAmount: num(r.order_amount),
  buyerDiscount: num(r.buyer_discount),
  influencerCommission: num(r.influencer_commission),
  platformFee: num(r.platform_fee),
  tier: r.tier,
  tierBonusPct: num(r.tier_bonus_pct),
  customerRef: r.customer_ref ?? undefined,
  externalOrderId: r.external_order_id ?? undefined,
  status: r.status,
  holdUntil: r.hold_until,
  source: r.source,
  createdAt: r.created_at,
});

/**
 * UTC calendar-month window [start, next), the range form of monthKey() in
 * lib/domain/logic. Tier bonuses depend on this being exactly the same month
 * the in-memory store counts, so it is unit tested.
 */
export function monthWindow(at: Date): { start: string; next: string } {
  const start = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));
  const next = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 1));
  return { start: start.toISOString(), next: next.toISOString() };
}

export class SupabaseStore implements DataStore {
  private db: SupabaseClient;

  constructor(url: string, secretKey: string) {
    this.db = createClient(url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  private async one<T>(
    q: PromiseLike<{ data: T | null; error: { code?: string; message: string } | null }>,
  ): Promise<T | null> {
    const { data, error } = await q;
    // PGRST116 = no rows matched .single(); a miss, not a failure
    if (error && error.code !== "PGRST116") throw new Error(error.message);
    return data ?? null;
  }

  private async many<T>(
    q: PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  ): Promise<T[]> {
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  private async count(
    q: PromiseLike<{ count: number | null; error: { message: string } | null }>,
  ): Promise<number> {
    const { count, error } = await q;
    if (error) throw new Error(error.message);
    return count ?? 0;
  }

  // Users -------------------------------------------------------------------

  async createUser(input: Omit<User, "id" | "createdAt">): Promise<User> {
    const email = input.email.trim().toLowerCase();
    const { data, error } = await this.db
      .from("profiles")
      .insert({ name: input.name, email, role: input.role })
      .select()
      .single<ProfileRow>();
    if (error) {
      if (error.code === "23505") throw new Error("EMAIL_TAKEN");
      throw new Error(error.message);
    }
    return toUser(data!);
  }

  async getUser(id: string): Promise<User | null> {
    const r = await this.one<ProfileRow>(
      this.db.from("profiles").select().eq("id", id).maybeSingle<ProfileRow>(),
    );
    return r ? toUser(r) : null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const r = await this.one<ProfileRow>(
      this.db
        .from("profiles")
        .select()
        .eq("email", email.trim().toLowerCase())
        .maybeSingle<ProfileRow>(),
    );
    return r ? toUser(r) : null;
  }

  async listUsers(): Promise<User[]> {
    const rows = await this.many<ProfileRow>(
      this.db.from("profiles").select().order("created_at", { ascending: true }),
    );
    return rows.map(toUser);
  }

  // Businesses --------------------------------------------------------------

  async createBusiness(
    input: Omit<Business, "id" | "createdAt" | "apiSecret">,
  ): Promise<Business> {
    const { data, error } = await this.db
      .from("businesses")
      .insert({ owner_id: input.ownerId, name: input.name, store_url: input.storeUrl ?? null })
      .select()
      .single<BusinessRow>();
    if (error) throw new Error(error.message);
    return toBusiness(data!);
  }

  async getBusiness(id: string): Promise<Business | null> {
    const r = await this.one<BusinessRow>(
      this.db.from("businesses").select().eq("id", id).maybeSingle<BusinessRow>(),
    );
    return r ? toBusiness(r) : null;
  }

  async getBusinessByOwner(ownerId: string): Promise<Business | null> {
    const r = await this.one<BusinessRow>(
      this.db.from("businesses").select().eq("owner_id", ownerId).maybeSingle<BusinessRow>(),
    );
    return r ? toBusiness(r) : null;
  }

  async getBusinessByApiSecret(apiSecret: string): Promise<Business | null> {
    const r = await this.one<BusinessRow>(
      this.db.from("businesses").select().eq("api_secret", apiSecret).maybeSingle<BusinessRow>(),
    );
    return r ? toBusiness(r) : null;
  }

  // Campaigns ---------------------------------------------------------------

  async createCampaign(input: Omit<Campaign, "id" | "createdAt">): Promise<Campaign> {
    const { data, error } = await this.db
      .from("campaigns")
      .insert({
        business_id: input.businessId,
        title: input.title,
        description: input.description ?? null,
        buyer_discount_pct: input.buyerDiscountPct,
        influencer_pct: input.influencerPct,
        platform_pct: input.platformPct,
        new_customers_only: input.newCustomersOnly,
        max_redemptions_per_month: input.maxRedemptionsPerMonth ?? null,
        status: input.status,
      })
      .select()
      .single<CampaignRow>();
    if (error) throw new Error(error.message);
    return toCampaign(data!);
  }

  async getCampaign(id: string): Promise<Campaign | null> {
    const r = await this.one<CampaignRow>(
      this.db.from("campaigns").select().eq("id", id).maybeSingle<CampaignRow>(),
    );
    return r ? toCampaign(r) : null;
  }

  async listActiveCampaigns(): Promise<Campaign[]> {
    const rows = await this.many<CampaignRow>(
      this.db
        .from("campaigns")
        .select()
        .eq("status", "active")
        .order("created_at", { ascending: true }),
    );
    return rows.map(toCampaign);
  }

  async listCampaignsByBusiness(businessId: string): Promise<Campaign[]> {
    const rows = await this.many<CampaignRow>(
      this.db
        .from("campaigns")
        .select()
        .eq("business_id", businessId)
        .order("created_at", { ascending: true }),
    );
    return rows.map(toCampaign);
  }

  async setCampaignStatus(id: string, status: CampaignStatus): Promise<void> {
    const { error } = await this.db.from("campaigns").update({ status }).eq("id", id);
    if (error) throw new Error(error.message);
  }

  // Coupon codes ------------------------------------------------------------

  async createCode(input: Omit<CouponCode, "id" | "createdAt" | "code">): Promise<CouponCode> {
    const existing = await this.getCodeForInfluencerCampaign(input.influencerId, input.campaignId);
    if (existing) return existing;

    // Retry on the unique index rather than pre-checking: the DB is the authority
    for (let attempt = 0; attempt < 6; attempt++) {
      const { data, error } = await this.db
        .from("coupon_codes")
        .insert({
          campaign_id: input.campaignId,
          influencer_id: input.influencerId,
          code: generateCode(),
          status: input.status,
        })
        .select()
        .single<CodeRow>();
      if (!error) return toCode(data!);
      if (error.code !== "23505") throw new Error(error.message);
      // A concurrent request may have created this influencer's code first
      const raced = await this.getCodeForInfluencerCampaign(input.influencerId, input.campaignId);
      if (raced) return raced;
    }
    throw new Error("CODE_GENERATION_FAILED");
  }

  async getCodeByCode(code: string): Promise<CouponCode | null> {
    const r = await this.one<CodeRow>(
      this.db
        .from("coupon_codes")
        .select()
        .eq("code", normalizeCode(code))
        .maybeSingle<CodeRow>(),
    );
    return r ? toCode(r) : null;
  }

  async getCodeForInfluencerCampaign(
    influencerId: string,
    campaignId: string,
  ): Promise<CouponCode | null> {
    const r = await this.one<CodeRow>(
      this.db
        .from("coupon_codes")
        .select()
        .eq("influencer_id", influencerId)
        .eq("campaign_id", campaignId)
        .maybeSingle<CodeRow>(),
    );
    return r ? toCode(r) : null;
  }

  async listCodesByInfluencer(influencerId: string): Promise<CouponCode[]> {
    const rows = await this.many<CodeRow>(
      this.db
        .from("coupon_codes")
        .select()
        .eq("influencer_id", influencerId)
        .order("created_at", { ascending: true }),
    );
    return rows.map(toCode);
  }

  async listCodesByCampaign(campaignId: string): Promise<CouponCode[]> {
    const rows = await this.many<CodeRow>(
      this.db.from("coupon_codes").select().eq("campaign_id", campaignId),
    );
    return rows.map(toCode);
  }

  // Redemptions -------------------------------------------------------------

  async createRedemption(input: Omit<Redemption, "id" | "createdAt">): Promise<Redemption> {
    const { data, error } = await this.db
      .from("redemptions")
      .insert({
        code_id: input.codeId,
        campaign_id: input.campaignId,
        business_id: input.businessId,
        influencer_id: input.influencerId,
        order_amount: input.orderAmount,
        buyer_discount: input.buyerDiscount,
        influencer_commission: input.influencerCommission,
        platform_fee: input.platformFee,
        tier: input.tier,
        tier_bonus_pct: input.tierBonusPct,
        customer_ref: input.customerRef ?? null,
        external_order_id: input.externalOrderId ?? null,
        status: input.status,
        hold_until: input.holdUntil,
        source: input.source,
      })
      .select()
      .single<RedemptionRow>();
    if (error) throw new Error(error.message);
    return toRedemption(data!);
  }

  async getRedemption(id: string): Promise<Redemption | null> {
    const r = await this.one<RedemptionRow>(
      this.db.from("redemptions").select().eq("id", id).maybeSingle<RedemptionRow>(),
    );
    return r ? toRedemption(r) : null;
  }

  async listRedemptionsByBusiness(businessId: string): Promise<Redemption[]> {
    const rows = await this.many<RedemptionRow>(
      this.db
        .from("redemptions")
        .select()
        .eq("business_id", businessId)
        .order("created_at", { ascending: false }),
    );
    return rows.map(toRedemption);
  }

  async listRedemptionsByInfluencer(influencerId: string): Promise<Redemption[]> {
    const rows = await this.many<RedemptionRow>(
      this.db
        .from("redemptions")
        .select()
        .eq("influencer_id", influencerId)
        .order("created_at", { ascending: false }),
    );
    return rows.map(toRedemption);
  }

  async getRedemptionByExternalOrderId(
    businessId: string,
    externalOrderId: string,
  ): Promise<Redemption | null> {
    const r = await this.one<RedemptionRow>(
      this.db
        .from("redemptions")
        .select()
        .eq("business_id", businessId)
        .eq("external_order_id", externalOrderId.trim())
        .maybeSingle<RedemptionRow>(),
    );
    return r ? toRedemption(r) : null;
  }

  async setRedemptionStatus(id: string, status: RedemptionStatus): Promise<void> {
    const { error } = await this.db.from("redemptions").update({ status }).eq("id", id);
    if (error) throw new Error(error.message);
  }

  async countInfluencerRedemptionsInMonth(influencerId: string, at: Date): Promise<number> {
    const { start, next } = monthWindow(at);
    return this.count(
      this.db
        .from("redemptions")
        .select("*", { count: "exact", head: true })
        .eq("influencer_id", influencerId)
        .neq("status", "cancelled")
        .gte("created_at", start)
        .lt("created_at", next),
    );
  }

  async countCampaignRedemptionsInMonth(campaignId: string, at: Date): Promise<number> {
    const { start, next } = monthWindow(at);
    return this.count(
      this.db
        .from("redemptions")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", campaignId)
        .neq("status", "cancelled")
        .gte("created_at", start)
        .lt("created_at", next),
    );
  }

  async hasCustomerBoughtBefore(businessId: string, customerRef: string): Promise<boolean> {
    const n = await this.count(
      this.db
        .from("redemptions")
        .select("*", { count: "exact", head: true })
        .eq("business_id", businessId)
        // customer_ref is always written lowercased by the redeem service
        .eq("customer_ref", customerRef.trim().toLowerCase()),
    );
    return n > 0;
  }
}
