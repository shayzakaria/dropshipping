import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  AdminAction,
  Business,
  BusinessFollow,
  CancellationReason,
  Campaign,
  CampaignScope,
  CodeSource,
  CampaignStatus,
  CouponCode,
  PayoutDetails,
  PayoutRequest,
  PayoutStatus,
  Settlement,
  SettlementStatus,
  PoolStatus,
  Redemption,
  RedemptionStatus,
  TierName,
  User,
} from "../domain/types";
import { generateCode, normalizeCode, PoolEmptyError } from "../domain/logic";
import { computeAdminSnapshot } from "../domain/admin";
import type { AdminSnapshot, DataStore, LogoFile, SupportView } from "./store";

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
  auth_user_id: string | null;
  is_demo: boolean | null;
  is_admin: boolean | null;
  suspended_at: string | null;
  suspended_reason: string | null;
  created_at: string;
};
type BusinessRow = {
  id: string;
  owner_id: string;
  name: string;
  store_url: string | null;
  api_secret: string;
  description: string | null;
  logo_url: string | null;
  featured_until: string | null;
  is_demo: boolean | null;
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
  scope: CampaignScope | null;
  product_name: string | null;
  product_url: string | null;
  status: CampaignStatus;
  code_source: CodeSource | null;
  verified_at: string | null;
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
  customer_hash: string | null;
  cancelled_at: string | null;
  cancellation_reason: CancellationReason | null;
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
  authUserId: r.auth_user_id ?? undefined,
  isDemo: r.is_demo ?? false,
  isAdmin: r.is_admin ?? false,
  suspendedAt: r.suspended_at ?? undefined,
  suspendedReason: r.suspended_reason ?? undefined,
  createdAt: r.created_at,
});

const toBusiness = (r: BusinessRow): Business => ({
  id: r.id,
  ownerId: r.owner_id,
  name: r.name,
  storeUrl: r.store_url ?? undefined,
  apiSecret: r.api_secret,
  description: r.description ?? undefined,
  logoUrl: r.logo_url ?? undefined,
  featuredUntil: r.featured_until ?? undefined,
  isDemo: r.is_demo ?? false,
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
  scope: r.scope ?? "store",
  productName: r.product_name ?? undefined,
  productUrl: r.product_url ?? undefined,
  status: r.status,
  codeSource: r.code_source ?? "generated",
  verifiedAt: r.verified_at ?? undefined,
  createdAt: r.created_at,
});

type SettlementRow = {
  id: string;
  business_id: string;
  period_start: string;
  period_end: string;
  commissions: number | string;
  platform_fees: number | string;
  total: number | string;
  sales_count: number;
  status: SettlementStatus;
  note: string | null;
  issued_at: string;
  paid_at: string | null;
};

const toSettlement = (r: SettlementRow): Settlement => ({
  id: r.id,
  businessId: r.business_id,
  periodStart: r.period_start,
  periodEnd: r.period_end,
  commissions: num(r.commissions),
  platformFees: num(r.platform_fees),
  total: num(r.total),
  salesCount: r.sales_count,
  status: r.status,
  note: r.note ?? undefined,
  issuedAt: r.issued_at,
  paidAt: r.paid_at ?? undefined,
});

type AdminActionRow = {
  id: string;
  actor_id: string;
  action: string;
  subject_kind: AdminAction["subjectKind"];
  subject_id: string;
  detail: Record<string, unknown> | null;
  created_at: string;
};

const toAdminAction = (r: AdminActionRow): AdminAction => ({
  id: r.id,
  actorId: r.actor_id,
  action: r.action,
  subjectKind: r.subject_kind,
  subjectId: r.subject_id,
  detail: r.detail ?? undefined,
  createdAt: r.created_at,
});

type PayoutDetailsRow = {
  influencer_id: string;
  legal_name: string;
  national_id: string;
  bank_name: string;
  branch: string;
  account_number: string;
  tax_status: PayoutDetails["taxStatus"];
  updated_at: string;
};

const toPayoutDetails = (r: PayoutDetailsRow): PayoutDetails => ({
  influencerId: r.influencer_id,
  legalName: r.legal_name,
  nationalId: r.national_id,
  bankName: r.bank_name,
  branch: r.branch,
  accountNumber: r.account_number,
  taxStatus: r.tax_status,
  updatedAt: r.updated_at,
});

type PayoutRequestRow = {
  id: string;
  influencer_id: string;
  amount: number | string;
  status: PayoutStatus;
  note: string | null;
  created_at: string;
  settled_at: string | null;
};

const toPayoutRequest = (r: PayoutRequestRow): PayoutRequest => ({
  id: r.id,
  influencerId: r.influencer_id,
  amount: num(r.amount),
  status: r.status,
  note: r.note ?? undefined,
  createdAt: r.created_at,
  settledAt: r.settled_at ?? undefined,
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
  customerHash: r.customer_hash ?? undefined,
  cancelledAt: r.cancelled_at ?? undefined,
  cancellationReason: r.cancellation_reason ?? undefined,
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

  /**
   * Codes Postgres reports for a lookup that found nothing, as opposed to one
   * that went wrong:
   *  - PGRST116  no rows matched .single()
   *  - 22P02     invalid text representation, e.g. "nope" compared to a uuid
   *              column. A value that cannot even be a uuid matches no row, so
   *              "not found" is the honest answer. Without this, an API caller
   *              sending a malformed key got a 500 while a well-formed wrong
   *              key got a 401 — which told them the shape of a valid key.
   */
  private static readonly MISS_CODES = new Set(["PGRST116", "22P02"]);

  private async one<T>(
    q: PromiseLike<{ data: T | null; error: { code?: string; message: string } | null }>,
  ): Promise<T | null> {
    const { data, error } = await q;
    if (error && !SupabaseStore.MISS_CODES.has(error.code ?? "")) {
      throw new Error(error.message);
    }
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
      .insert({
        name: input.name,
        email,
        role: input.role,
        auth_user_id: input.authUserId ?? null,
        is_demo: input.isDemo ?? false,
      })
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

  async getUserByAuthId(authUserId: string): Promise<User | null> {
    const r = await this.one<ProfileRow>(
      this.db.from("profiles").select().eq("auth_user_id", authUserId).maybeSingle<ProfileRow>(),
    );
    return r ? toUser(r) : null;
  }

  async linkAuthUser(userId: string, authUserId: string): Promise<void> {
    const { error } = await this.db
      .from("profiles")
      .update({ auth_user_id: authUserId })
      .eq("id", userId);
    if (error) throw new Error(error.message);
  }

  async listUsersByIds(ids: string[]): Promise<User[]> {
    if (ids.length === 0) return [];
    const rows = await this.many<ProfileRow>(this.db.from("profiles").select().in("id", ids));
    return rows.map(toUser);
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
      .insert({
        owner_id: input.ownerId,
        name: input.name,
        store_url: input.storeUrl ?? null,
        description: input.description ?? null,
        logo_url: input.logoUrl ?? null,
        is_demo: input.isDemo ?? false,
      })
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

  async updateBusinessProfile(
    id: string,
    patch: Pick<Business, "name" | "storeUrl" | "description" | "logoUrl">,
  ): Promise<void> {
    const { error } = await this.db
      .from("businesses")
      .update({
        name: patch.name,
        store_url: patch.storeUrl ?? null,
        description: patch.description ?? null,
        logo_url: patch.logoUrl ?? null,
      })
      .eq("id", id);
    if (error) throw new Error(error.message);
  }

  async listDirectoryBusinesses(): Promise<Business[]> {
    const rows = await this.many<BusinessRow>(
      this.db.from("businesses").select().order("created_at", { ascending: false }),
    );
    return rows.map(toBusiness);
  }

  async setUserSuspended(userId: string, reason: string | null): Promise<void> {
    const { error } = await this.db
      .from("profiles")
      .update({ suspended_at: reason ? new Date().toISOString() : null, suspended_reason: reason })
      .eq("id", userId);
    if (error) throw new Error(error.message);
  }

  async setCodeStatus(codeId: string, status: CouponCode["status"]): Promise<void> {
    const { error } = await this.db.from("coupon_codes").update({ status }).eq("id", codeId);
    if (error) throw new Error(error.message);
  }

  async recordAdminAction(input: Omit<AdminAction, "id" | "createdAt">): Promise<AdminAction> {
    const { data, error } = await this.db
      .from("admin_actions")
      .insert({
        actor_id: input.actorId,
        action: input.action,
        subject_kind: input.subjectKind,
        subject_id: input.subjectId,
        detail: input.detail ?? null,
      })
      .select()
      .single<AdminActionRow>();
    if (error) throw new Error(error.message);
    return toAdminAction(data!);
  }

  async getPayoutDetails(influencerId: string): Promise<PayoutDetails | null> {
    const r = await this.one<PayoutDetailsRow>(
      this.db.from("payout_details").select().eq("influencer_id", influencerId).maybeSingle<PayoutDetailsRow>(),
    );
    return r ? toPayoutDetails(r) : null;
  }

  async savePayoutDetails(input: Omit<PayoutDetails, "updatedAt">): Promise<void> {
    const { error } = await this.db.from("payout_details").upsert(
      {
        influencer_id: input.influencerId,
        legal_name: input.legalName,
        national_id: input.nationalId,
        bank_name: input.bankName,
        branch: input.branch,
        account_number: input.accountNumber,
        tax_status: input.taxStatus,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "influencer_id" },
    );
    if (error) throw new Error(error.message);
  }

  async createPayoutRequest(influencerId: string, amount: number): Promise<PayoutRequest> {
    const { data, error } = await this.db
      .from("payout_requests")
      .insert({ influencer_id: influencerId, amount })
      .select()
      .single<PayoutRequestRow>();
    if (error) throw new Error(error.message);
    return toPayoutRequest(data!);
  }

  async listPayoutRequests(influencerId: string): Promise<PayoutRequest[]> {
    const rows = await this.many<PayoutRequestRow>(
      this.db.from("payout_requests").select().eq("influencer_id", influencerId).order("created_at", { ascending: false }),
    );
    return rows.map(toPayoutRequest);
  }

  async listAllPayoutRequests(status?: PayoutStatus): Promise<PayoutRequest[]> {
    let q = this.db.from("payout_requests").select().order("created_at", { ascending: false });
    if (status) q = q.eq("status", status);
    return (await this.many<PayoutRequestRow>(q)).map(toPayoutRequest);
  }

  async unbilledTotals(businessId: string) {
    const rows = await this.many<{ influencer_commission: number | string; platform_fee: number | string }>(
      this.db
        .from("redemptions")
        .select("influencer_commission, platform_fee")
        .eq("business_id", businessId)
        .is("settlement_id", null)
        .neq("status", "cancelled")
        .lte("hold_until", new Date().toISOString()),
    );
    const sum = (pick: (r: (typeof rows)[number]) => number | string) =>
      Math.round(rows.reduce((t, r) => t + num(pick(r)), 0) * 100) / 100;
    return {
      commissions: sum((r) => r.influencer_commission),
      platformFees: sum((r) => r.platform_fee),
      count: rows.length,
    };
  }

  async issueSettlements(period: { start: string; end: string }): Promise<Settlement[]> {
    // One statement, in one statement. Doing this in application code would
    // mean a window between reading the billable sales and stamping them, in
    // which a new sale could be counted by one run and stamped by the next.
    const { data, error } = await this.db.rpc("issue_settlements", {
      p_period_start: period.start,
      p_period_end: period.end,
    });
    if (error) throw new Error(error.message);
    return ((data ?? []) as SettlementRow[]).map(toSettlement);
  }

  async listSettlementsForBusiness(businessId: string): Promise<Settlement[]> {
    const rows = await this.many<SettlementRow>(
      this.db
        .from("settlements")
        .select()
        .eq("business_id", businessId)
        .order("period_start", { ascending: false }),
    );
    return rows.map(toSettlement);
  }

  async listSettlements(status?: SettlementStatus): Promise<Settlement[]> {
    let q = this.db.from("settlements").select().order("period_start", { ascending: false });
    if (status) q = q.eq("status", status);
    return (await this.many<SettlementRow>(q)).map(toSettlement);
  }

  async getSettlement(id: string): Promise<Settlement | null> {
    const r = await this.one<SettlementRow>(
      this.db.from("settlements").select().eq("id", id).maybeSingle<SettlementRow>(),
    );
    return r ? toSettlement(r) : null;
  }

  async setSettlementStatus(id: string, status: SettlementStatus, note?: string): Promise<void> {
    const { error } = await this.db
      .from("settlements")
      .update({
        status,
        note: note ?? null,
        paid_at: status === "paid" ? new Date().toISOString() : null,
      })
      .eq("id", id);
    if (error) throw new Error(error.message);

    // A cancelled statement releases its sales back onto the next one, so a
    // mistaken bill does not swallow the money it covered.
    if (status === "cancelled") {
      const { error: e2 } = await this.db
        .from("redemptions")
        .update({ settlement_id: null })
        .eq("settlement_id", id);
      if (e2) throw new Error(e2.message);
    }
  }

  async setPayoutRequestStatus(id: string, status: PayoutStatus, note?: string): Promise<void> {
    const { error } = await this.db
      .from("payout_requests")
      .update({ status, note: note ?? null, settled_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);
  }

  /**
   * Puts the logo in the public `logos` bucket under the business's own folder
   * and returns its URL.
   *
   * The filename carries a timestamp rather than being overwritten in place:
   * a public bucket sits behind a CDN, and reusing the path means a business
   * replaces its logo and keeps seeing the old one. Previous files in the
   * folder are removed after the new one is safely up, so a failed upload
   * never leaves a business with no logo at all.
   */
  async uploadLogo(businessId: string, file: LogoFile): Promise<string> {
    const bucket = this.db.storage.from("logos");
    const path = `${businessId}/logo-${Date.now()}.${file.ext}`;

    const { error } = await bucket.upload(path, file.bytes, {
      contentType: file.mime,
      cacheControl: "public, max-age=31536000, immutable",
    });
    if (error) throw new Error(error.message);

    const { data: existing } = await bucket.list(businessId);
    const stale = (existing ?? [])
      .map((f) => `${businessId}/${f.name}`)
      .filter((p) => p !== path);
    if (stale.length) await bucket.remove(stale);

    return bucket.getPublicUrl(path).data.publicUrl;
  }

  async listAdminActions(limit: number): Promise<AdminAction[]> {
    const rows = await this.many<AdminActionRow>(
      this.db.from("admin_actions").select().order("created_at", { ascending: false }).limit(limit),
    );
    return rows.map(toAdminAction);
  }

  async searchUsers(query: string, limit: number): Promise<User[]> {
    const q = query.trim();
    if (!q) return [];
    // Escape PostgREST's or() separators so a comma or paren in the query
    // cannot break out of the filter it is embedded in.
    const safe = q.replace(/[,()\\*]/g, " ").trim();
    if (!safe) return [];
    const rows = await this.many<ProfileRow>(
      this.db.from("profiles").select().or(`name.ilike.%${safe}%,email.ilike.%${safe}%`).limit(limit),
    );
    return rows.map(toUser);
  }

  async supportView(userId: string): Promise<SupportView | null> {
    const profile = await this.one<ProfileRow>(
      this.db.from("profiles").select().eq("id", userId).maybeSingle<ProfileRow>(),
    );
    if (!profile) return null;
    const user = toUser(profile);
    const businessRow = await this.one<BusinessRow>(
      this.db.from("businesses").select().eq("owner_id", userId).maybeSingle<BusinessRow>(),
    );
    const business = businessRow ? toBusiness(businessRow) : null;

    const [campaignRows, codeRows, mine, theirs, follows] = await Promise.all([
      business
        ? this.many<CampaignRow>(this.db.from("campaigns").select().eq("business_id", business.id))
        : Promise.resolve([]),
      this.many<CodeRow>(this.db.from("coupon_codes").select().eq("influencer_id", userId)),
      this.many<RedemptionRow>(this.db.from("redemptions").select().eq("influencer_id", userId)),
      business
        ? this.many<RedemptionRow>(this.db.from("redemptions").select().eq("business_id", business.id))
        : Promise.resolve([]),
      this.listFollowsByInfluencer(userId),
    ]);

    const campaignTitles = new Map(campaignRows.map((c) => [c.id, c.title]));
    const missing = codeRows.map((c) => c.campaign_id).filter((id) => !campaignTitles.has(id));
    if (missing.length > 0) {
      for (const c of await this.listCampaignsByIds([...new Set(missing)])) {
        campaignTitles.set(c.id, c.title);
      }
    }
    const clicks = await this.countClicksByCodeIds(codeRows.map((c) => c.id), new Date(0));
    const followedBusinesses = await this.listBusinessesByIds(follows.map((f) => f.businessId));

    // A business owner who is also an influencer would otherwise see a sale twice
    const seen = new Set<string>();
    const redemptions = [...mine, ...theirs]
      .filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)))
      .map(toRedemption);

    return {
      user,
      business,
      campaigns: campaignRows.map(toCampaign),
      codes: codeRows.map((c) => ({
        ...toCode(c),
        campaignTitle: campaignTitles.get(c.campaign_id) ?? "—",
        clicks: clicks.get(c.id) ?? 0,
      })),
      redemptions,
      followedBusinessNames: followedBusinesses.map((b) => b.name),
    };
  }

  async setBusinessFeaturedUntil(id: string, until: string | null): Promise<void> {
    const { error } = await this.db.from("businesses").update({ featured_until: until }).eq("id", id);
    if (error) throw new Error(error.message);
  }

  async followBusiness(influencerId: string, businessId: string): Promise<void> {
    const { error } = await this.db
      .from("business_follows")
      .upsert({ influencer_id: influencerId, business_id: businessId }, { onConflict: "influencer_id,business_id", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }

  async unfollowBusiness(influencerId: string, businessId: string): Promise<void> {
    const { error } = await this.db
      .from("business_follows")
      .delete()
      .eq("influencer_id", influencerId)
      .eq("business_id", businessId);
    if (error) throw new Error(error.message);
  }

  async listFollowsByInfluencer(influencerId: string): Promise<BusinessFollow[]> {
    const rows = await this.many<{ influencer_id: string; business_id: string; created_at: string }>(
      this.db.from("business_follows").select().eq("influencer_id", influencerId),
    );
    return rows.map((r) => ({ influencerId: r.influencer_id, businessId: r.business_id, createdAt: r.created_at }));
  }

  async countFollowersByBusinessIds(businessIds: string[]): Promise<Map<string, number>> {
    const out = new Map(businessIds.map((id) => [id, 0]));
    if (businessIds.length === 0) return out;
    const rows = await this.many<{ business_id: string }>(
      this.db.from("business_follows").select("business_id").in("business_id", businessIds),
    );
    for (const r of rows) out.set(r.business_id, (out.get(r.business_id) ?? 0) + 1);
    return out;
  }

  async recordPageView(path: string): Promise<void> {
    const { error } = await this.db.rpc("record_page_view", { p_path: path });
    if (error) throw new Error(error.message);
  }

  async adminSnapshot(since: Date): Promise<AdminSnapshot> {
    const fromDay = since.toISOString().slice(0, 10);
    // Eight independent reads in one wave. The pilot's tables are small enough
    // to aggregate in memory; when they are not, this is the method to revisit.
    const [users, businesses, campaigns, codes, follows, redemptions, clicks, views] = await Promise.all([
      this.many<ProfileRow>(this.db.from("profiles").select()),
      this.many<BusinessRow>(this.db.from("businesses").select()),
      this.many<CampaignRow>(this.db.from("campaigns").select()),
      this.many<CodeRow>(this.db.from("coupon_codes").select()),
      this.count(this.db.from("business_follows").select("*", { count: "exact", head: true })),
      this.many<RedemptionRow>(this.db.from("redemptions").select()),
      this.many<{ day: string; clicks: number }>(this.db.from("code_clicks").select("day, clicks").gte("day", fromDay)),
      this.many<{ path: string; day: string; views: number }>(this.db.from("page_views").select("path, day, views").gte("day", fromDay)),
    ]);
    return computeAdminSnapshot(
      {
        users: users.map(toUser),
        businesses: businesses.map(toBusiness),
        campaigns: campaigns.map(toCampaign),
        codes: codes.map(toCode),
        followsTotal: follows,
        redemptions: redemptions.map(toRedemption),
        clicks: clicks.map((c) => [c.day, Number(c.clicks)]),
        views: views.map((v) => [v.path, v.day, Number(v.views)]),
      },
      since,
      new Date(),
    );
  }

  async listBusinessesByIds(ids: string[]): Promise<Business[]> {
    if (ids.length === 0) return [];
    const rows = await this.many<BusinessRow>(
      this.db.from("businesses").select().in("id", ids),
    );
    return rows.map(toBusiness);
  }

  async getBusinessByApiSecret(apiSecret: string): Promise<Business | null> {
    const r = await this.one<BusinessRow>(
      this.db.from("businesses").select().eq("api_secret", apiSecret).maybeSingle<BusinessRow>(),
    );
    return r ? toBusiness(r) : null;
  }

  // Campaigns ---------------------------------------------------------------

  async createCampaign(
    input: Omit<Campaign, "id" | "createdAt" | "scope" | "codeSource"> & {
      scope?: CampaignScope;
      codeSource?: CodeSource;
    },
  ): Promise<Campaign> {
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
        scope: input.scope ?? "store",
        product_name: input.productName ?? null,
        product_url: input.productUrl ?? null,
        status: input.status,
        code_source: input.codeSource ?? "pool",
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

  async listCampaignsByIds(ids: string[]): Promise<Campaign[]> {
    if (ids.length === 0) return [];
    const rows = await this.many<CampaignRow>(this.db.from("campaigns").select().in("id", ids));
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

    // A pool campaign deals a code the shop already recognises; running dry
    // refuses the join rather than inventing one that fails at checkout.
    const campaign = await this.getCampaign(input.campaignId);
    if (campaign?.codeSource === "pool") {
      const claimed = await this.claimPoolCode(input.campaignId, input.influencerId);
      if (!claimed) throw new PoolEmptyError();
      const { data, error } = await this.db
        .from("coupon_codes")
        .insert({
          campaign_id: input.campaignId,
          influencer_id: input.influencerId,
          code: claimed,
          status: input.status,
        })
        .select()
        .single<CodeRow>();
      if (!error) return toCode(data!);
      if (error.code !== "23505") throw new Error(error.message);
      const raced = await this.getCodeForInfluencerCampaign(input.influencerId, input.campaignId);
      if (raced) return raced;
      throw new Error(error.message);
    }

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

  async addPoolCodes(campaignId: string, codes: string[]): Promise<number> {
    const rows = [...new Set(codes.map(normalizeCode).filter(Boolean))].map((code) => ({
      campaign_id: campaignId,
      code,
    }));
    if (!rows.length) return 0;
    // A second paste usually overlaps the first, so a repeat is skipped rather
    // than failing the whole batch.
    const { data, error } = await this.db
      .from("campaign_code_pool")
      .upsert(rows, { onConflict: "campaign_id,code", ignoreDuplicates: true })
      .select("id");
    if (error) throw new Error(error.message);
    return data?.length ?? 0;
  }

  async claimPoolCode(campaignId: string, influencerId: string): Promise<string | null> {
    // A function, not a select-then-update: two influencers joining at the
    // same instant must never be handed the same code, and `for update skip
    // locked` inside claim_pool_code is what guarantees it.
    const { data, error } = await this.db.rpc("claim_pool_code", {
      p_campaign_id: campaignId,
      p_influencer_id: influencerId,
    });
    if (error) throw new Error(error.message);
    return (data as string | null) ?? null;
  }

  async peekPoolCode(campaignId: string): Promise<string | null> {
    const row = await this.one<{ code: string }>(
      this.db
        .from("campaign_code_pool")
        .select("code")
        .eq("campaign_id", campaignId)
        .is("claimed_by", null)
        .order("created_at")
        .limit(1)
        .maybeSingle<{ code: string }>(),
    );
    return row?.code ?? null;
  }

  async poolStatus(campaignId: string): Promise<PoolStatus> {
    return (await this.poolStatusForCampaigns([campaignId])).get(campaignId) ?? { total: 0, available: 0 };
  }

  async poolStatusForCampaigns(campaignIds: string[]): Promise<Map<string, PoolStatus>> {
    const out = new Map<string, PoolStatus>();
    if (!campaignIds.length) return out;
    for (const id of campaignIds) out.set(id, { total: 0, available: 0 });

    const rows = await this.many<{ campaign_id: string; claimed_by: string | null }>(
      this.db.from("campaign_code_pool").select("campaign_id, claimed_by").in("campaign_id", campaignIds),
    );
    for (const r of rows) {
      const cur = out.get(r.campaign_id) ?? { total: 0, available: 0 };
      cur.total++;
      if (!r.claimed_by) cur.available++;
      out.set(r.campaign_id, cur);
    }
    return out;
  }

  async setCampaignVerified(campaignId: string, at: string | null): Promise<void> {
    const { error } = await this.db.from("campaigns").update({ verified_at: at }).eq("id", campaignId);
    if (error) throw new Error(error.message);
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

  async recordCodeClick(codeId: string): Promise<void> {
    const { error } = await this.db.rpc("record_code_click", { p_code_id: codeId });
    if (error) throw new Error(error.message);
  }

  async countClicksByCodeIds(codeIds: string[], since: Date): Promise<Map<string, number>> {
    const out = new Map<string, number>(codeIds.map((id) => [id, 0]));
    if (codeIds.length === 0) return out;
    const rows = await this.many<{ code_id: string; clicks: number }>(
      this.db
        .from("code_clicks")
        .select("code_id, clicks")
        .in("code_id", codeIds)
        .gte("day", since.toISOString().slice(0, 10)),
    );
    for (const r of rows) out.set(r.code_id, (out.get(r.code_id) ?? 0) + Number(r.clicks));
    return out;
  }

  async listCodesByCampaignIds(campaignIds: string[]): Promise<CouponCode[]> {
    if (campaignIds.length === 0) return [];
    const rows = await this.many<CodeRow>(
      this.db.from("coupon_codes").select().in("campaign_id", campaignIds),
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
        customer_hash: input.customerHash ?? null,
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

  async setRedemptionStatus(
    id: string,
    status: RedemptionStatus,
    cancellation?: { at: string; reason: CancellationReason },
  ): Promise<void> {
    const patch: Record<string, unknown> = { status };
    if (cancellation) {
      patch.cancelled_at = cancellation.at;
      patch.cancellation_reason = cancellation.reason;
    }
    const { error } = await this.db.from("redemptions").update(patch).eq("id", id);
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

  async rateLimitHit(key: string, windowSeconds: number): Promise<number> {
    const { data, error } = await this.db.rpc("rate_limit_hit", {
      p_key: key,
      p_window_seconds: windowSeconds,
    });
    if (error) throw new Error(error.message);
    return Number(data);
  }

  async hasCustomerBoughtBefore(businessId: string, customerHash: string): Promise<boolean> {
    const n = await this.count(
      this.db
        .from("redemptions")
        .select("*", { count: "exact", head: true })
        .eq("business_id", businessId)
        .eq("customer_hash", customerHash),
    );
    return n > 0;
  }
}
