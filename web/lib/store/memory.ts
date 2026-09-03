import { randomUUID } from "crypto";
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
  PoolStatus,
  Redemption,
  RedemptionStatus,
  User,
} from "../domain/types";
import { computeAdminSnapshot } from "../domain/admin";
import { generateCode, monthKey, normalizeCode, PoolEmptyError } from "../domain/logic";
import type { AdminSnapshot, DataStore, LogoFile, SupportView } from "./store";

export class MemoryStore implements DataStore {
  users = new Map<string, User>();
  businesses = new Map<string, Business>();
  campaigns = new Map<string, Campaign>();
  codes = new Map<string, CouponCode>();
  redemptions = new Map<string, Redemption>();

  private now(): string {
    return new Date().toISOString();
  }

  async createUser(input: Omit<User, "id" | "createdAt">): Promise<User> {
    const email = input.email.trim().toLowerCase();
    const existing = await this.getUserByEmail(email);
    if (existing) throw new Error("EMAIL_TAKEN");
    // Operator access is not something a caller gets to ask for. It is set on
    // the row afterwards, by a person, and never travels through this path —
    // the Supabase store does not insert it either, and the two must agree.
    const { isAdmin: _ignored, ...safe } = input as typeof input & { isAdmin?: boolean };
    void _ignored;
    const user: User = { ...safe, email, id: randomUUID(), createdAt: this.now() };
    this.users.set(user.id, user);
    return user;
  }

  async getUser(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const needle = email.trim().toLowerCase();
    for (const u of this.users.values()) if (u.email === needle) return u;
    return null;
  }

  async getUserByAuthId(authUserId: string): Promise<User | null> {
    for (const u of this.users.values()) if (u.authUserId === authUserId) return u;
    return null;
  }

  async linkAuthUser(userId: string, authUserId: string): Promise<void> {
    const u = this.users.get(userId);
    if (u) this.users.set(userId, { ...u, authUserId });
  }

  async listUsersByIds(ids: string[]): Promise<User[]> {
    const want = new Set(ids);
    return [...this.users.values()].filter((u) => want.has(u.id));
  }

  async listUsers(): Promise<User[]> {
    return [...this.users.values()];
  }

  async createBusiness(input: Omit<Business, "id" | "createdAt" | "apiSecret">): Promise<Business> {
    const business: Business = {
      ...input,
      id: randomUUID(),
      apiSecret: randomUUID(),
      createdAt: this.now(),
    };
    this.businesses.set(business.id, business);
    return business;
  }

  async updateBusinessProfile(
    id: string,
    patch: Pick<Business, "name" | "storeUrl" | "description" | "logoUrl">,
  ): Promise<void> {
    const b = this.businesses.get(id);
    if (b) this.businesses.set(id, { ...b, ...patch });
  }

  async listDirectoryBusinesses(): Promise<Business[]> {
    return [...this.businesses.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  private readonly adminLog: AdminAction[] = [];
  private readonly payoutDetails = new Map<string, PayoutDetails>();
  private readonly payoutRequests = new Map<string, PayoutRequest>();

  async getPayoutDetails(influencerId: string): Promise<PayoutDetails | null> {
    return this.payoutDetails.get(influencerId) ?? null;
  }

  async savePayoutDetails(input: Omit<PayoutDetails, "updatedAt">): Promise<void> {
    this.payoutDetails.set(input.influencerId, { ...input, updatedAt: this.now() });
  }

  async createPayoutRequest(influencerId: string, amount: number): Promise<PayoutRequest> {
    const row: PayoutRequest = {
      id: randomUUID(),
      influencerId,
      amount,
      status: "requested",
      createdAt: this.now(),
    };
    this.payoutRequests.set(row.id, row);
    return row;
  }

  async listPayoutRequests(influencerId: string): Promise<PayoutRequest[]> {
    return [...this.payoutRequests.values()]
      .filter((r) => r.influencerId === influencerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async listAllPayoutRequests(status?: PayoutStatus): Promise<PayoutRequest[]> {
    return [...this.payoutRequests.values()]
      .filter((r) => !status || r.status === status)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async setPayoutRequestStatus(id: string, status: PayoutStatus, note?: string): Promise<void> {
    const r = this.payoutRequests.get(id);
    if (r) this.payoutRequests.set(id, { ...r, status, note, settledAt: this.now() });
  }

  /**
   * The demo store has nowhere to put a file, so the image comes back as a
   * data URL. That renders identically in an <img>, which keeps the upload
   * path exercisable in local development and in tests without a bucket.
   */
  async uploadLogo(_businessId: string, file: LogoFile): Promise<string> {
    const base64 = Buffer.from(file.bytes).toString("base64");
    return `data:${file.mime};base64,${base64}`;
  }


  async setUserSuspended(userId: string, reason: string | null): Promise<void> {
    const u = this.users.get(userId);
    if (!u) return;
    this.users.set(userId, {
      ...u,
      suspendedAt: reason ? this.now() : undefined,
      suspendedReason: reason ?? undefined,
    });
  }

  async setCodeStatus(codeId: string, status: CouponCode["status"]): Promise<void> {
    const c = this.codes.get(codeId);
    if (c) this.codes.set(codeId, { ...c, status });
  }

  async recordAdminAction(input: Omit<AdminAction, "id" | "createdAt">): Promise<AdminAction> {
    const row: AdminAction = { ...input, id: randomUUID(), createdAt: this.now() };
    this.adminLog.push(row);
    return row;
  }

  async listAdminActions(limit: number): Promise<AdminAction[]> {
    return [...this.adminLog].reverse().slice(0, limit);
  }

  async searchUsers(query: string, limit: number): Promise<User[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return [...this.users.values()]
      .filter((u) => u.name.toLowerCase().includes(q) || u.email.includes(q))
      .slice(0, limit);
  }

  async supportView(userId: string): Promise<SupportView | null> {
    const user = this.users.get(userId);
    if (!user) return null;
    const business = [...this.businesses.values()].find((b) => b.ownerId === userId) ?? null;
    const campaigns = business
      ? [...this.campaigns.values()].filter((c) => c.businessId === business.id)
      : [];
    const rawCodes = [...this.codes.values()].filter((c) => c.influencerId === userId);
    const clicks = await this.countClicksByCodeIds(rawCodes.map((c) => c.id), new Date(0));
    const codes = rawCodes.map((c) => ({
      ...c,
      campaignTitle: this.campaigns.get(c.campaignId)?.title ?? "—",
      clicks: clicks.get(c.id) ?? 0,
    }));
    const redemptions = [...this.redemptions.values()].filter(
      (r) => r.influencerId === userId || (business !== null && r.businessId === business.id),
    );
    const followedBusinessNames = [...this.follows.values()]
      .filter((f) => f.influencerId === userId)
      .map((f) => this.businesses.get(f.businessId)?.name ?? "—");
    return { user, business, campaigns, codes, redemptions, followedBusinessNames };
  }

  async setBusinessFeaturedUntil(id: string, until: string | null): Promise<void> {
    const b = this.businesses.get(id);
    if (b) this.businesses.set(id, { ...b, featuredUntil: until ?? undefined });
  }

  private readonly follows = new Map<string, BusinessFollow>();
  private followKey(i: string, b: string) { return `${i}:${b}`; }

  async followBusiness(influencerId: string, businessId: string): Promise<void> {
    const k = this.followKey(influencerId, businessId);
    if (!this.follows.has(k)) this.follows.set(k, { influencerId, businessId, createdAt: this.now() });
  }

  async unfollowBusiness(influencerId: string, businessId: string): Promise<void> {
    this.follows.delete(this.followKey(influencerId, businessId));
  }

  async listFollowsByInfluencer(influencerId: string): Promise<BusinessFollow[]> {
    return [...this.follows.values()].filter((f) => f.influencerId === influencerId);
  }

  async countFollowersByBusinessIds(businessIds: string[]): Promise<Map<string, number>> {
    const out = new Map(businessIds.map((id) => [id, 0]));
    for (const f of this.follows.values()) if (out.has(f.businessId)) out.set(f.businessId, out.get(f.businessId)! + 1);
    return out;
  }

  async getBusiness(id: string): Promise<Business | null> {
    return this.businesses.get(id) ?? null;
  }

  async getBusinessByOwner(ownerId: string): Promise<Business | null> {
    for (const b of this.businesses.values()) if (b.ownerId === ownerId) return b;
    return null;
  }

  async listBusinessesByIds(ids: string[]): Promise<Business[]> {
    const want = new Set(ids);
    return [...this.businesses.values()].filter((b) => want.has(b.id));
  }

  async getBusinessByApiSecret(apiSecret: string): Promise<Business | null> {
    for (const b of this.businesses.values()) if (b.apiSecret === apiSecret) return b;
    return null;
  }

  async createCampaign(
    input: Omit<Campaign, "id" | "createdAt" | "scope" | "codeSource"> & {
      scope?: CampaignScope;
      codeSource?: CodeSource;
    },
  ): Promise<Campaign> {
    const campaign: Campaign = {
      scope: "store",
      codeSource: "pool",
      ...input,
      id: randomUUID(),
      createdAt: this.now(),
    };
    this.campaigns.set(campaign.id, campaign);
    return campaign;
  }

  async getCampaign(id: string): Promise<Campaign | null> {
    return this.campaigns.get(id) ?? null;
  }

  async listActiveCampaigns(): Promise<Campaign[]> {
    return [...this.campaigns.values()].filter((c) => c.status === "active");
  }

  async listCampaignsByIds(ids: string[]): Promise<Campaign[]> {
    const want = new Set(ids);
    return [...this.campaigns.values()].filter((c) => want.has(c.id));
  }

  async listCampaignsByBusiness(businessId: string): Promise<Campaign[]> {
    return [...this.campaigns.values()].filter((c) => c.businessId === businessId);
  }

  async setCampaignStatus(id: string, status: CampaignStatus): Promise<void> {
    const c = this.campaigns.get(id);
    if (c) this.campaigns.set(id, { ...c, status });
  }

  async createCode(input: Omit<CouponCode, "id" | "createdAt" | "code">): Promise<CouponCode> {
    const existing = await this.getCodeForInfluencerCampaign(input.influencerId, input.campaignId);
    if (existing) return existing;

    // A pool campaign hands out a code the shop already knows. Running dry is
    // a refusal, not a silent fall back to inventing one — an invented code
    // would fail at the buyer's checkout and the influencer would wear it.
    const campaign = this.campaigns.get(input.campaignId);
    let code: string;
    if (campaign?.codeSource === "pool") {
      const claimed = await this.claimPoolCode(input.campaignId, input.influencerId);
      if (!claimed) throw new PoolEmptyError();
      code = claimed;
    } else {
      code = generateCode();
      while (await this.getCodeByCode(code)) code = generateCode();
    }

    const record: CouponCode = { ...input, code, id: randomUUID(), createdAt: this.now() };
    this.codes.set(record.id, record);
    return record;
  }

  private readonly pool = new Map<string, { campaignId: string; code: string; claimedBy?: string; at: number }>();

  async addPoolCodes(campaignId: string, codes: string[]): Promise<number> {
    let added = 0;
    for (const raw of codes) {
      const code = normalizeCode(raw);
      if (!code) continue;
      const key = `${campaignId}:${code}`;
      if (this.pool.has(key)) continue;
      this.pool.set(key, { campaignId, code, at: this.pool.size });
      added++;
    }
    return added;
  }

  async claimPoolCode(campaignId: string, influencerId: string): Promise<string | null> {
    const next = [...this.pool.entries()]
      .filter(([, v]) => v.campaignId === campaignId && !v.claimedBy)
      .sort((a, b) => a[1].at - b[1].at)[0];
    if (!next) return null;
    this.pool.set(next[0], { ...next[1], claimedBy: influencerId });
    return next[1].code;
  }

  async peekPoolCode(campaignId: string): Promise<string | null> {
    const next = [...this.pool.values()]
      .filter((v) => v.campaignId === campaignId && !v.claimedBy)
      .sort((a, b) => a.at - b.at)[0];
    return next?.code ?? null;
  }

  async poolStatus(campaignId: string): Promise<PoolStatus> {
    const mine = [...this.pool.values()].filter((v) => v.campaignId === campaignId);
    return { total: mine.length, available: mine.filter((v) => !v.claimedBy).length };
  }

  async poolStatusForCampaigns(campaignIds: string[]): Promise<Map<string, PoolStatus>> {
    const out = new Map<string, PoolStatus>();
    for (const id of campaignIds) out.set(id, await this.poolStatus(id));
    return out;
  }

  async setCampaignVerified(campaignId: string, at: string | null): Promise<void> {
    const c = this.campaigns.get(campaignId);
    if (c) this.campaigns.set(campaignId, { ...c, verifiedAt: at ?? undefined });
  }

  async getCodeByCode(code: string): Promise<CouponCode | null> {
    const needle = normalizeCode(code);
    for (const c of this.codes.values()) if (c.code === needle) return c;
    return null;
  }

  async getCodeForInfluencerCampaign(
    influencerId: string,
    campaignId: string,
  ): Promise<CouponCode | null> {
    for (const c of this.codes.values()) {
      if (c.influencerId === influencerId && c.campaignId === campaignId) return c;
    }
    return null;
  }

  async listCodesByInfluencer(influencerId: string): Promise<CouponCode[]> {
    return [...this.codes.values()].filter((c) => c.influencerId === influencerId);
  }

  async listCodesByCampaign(campaignId: string): Promise<CouponCode[]> {
    return [...this.codes.values()].filter((c) => c.campaignId === campaignId);
  }

  async listCodesByCampaignIds(campaignIds: string[]): Promise<CouponCode[]> {
    const want = new Set(campaignIds);
    return [...this.codes.values()].filter((c) => want.has(c.campaignId));
  }

  /** codeId -> "YYYY-MM-DD" -> clicks */
  private readonly clicks = new Map<string, Map<string, number>>();

  async recordCodeClick(codeId: string): Promise<void> {
    const day = this.now().slice(0, 10);
    const byDay = this.clicks.get(codeId) ?? new Map<string, number>();
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
    this.clicks.set(codeId, byDay);
  }

  private readonly views = new Map<string, Map<string, number>>();

  async recordPageView(path: string): Promise<void> {
    const day = this.now().slice(0, 10);
    const byDay = this.views.get(path) ?? new Map<string, number>();
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
    this.views.set(path, byDay);
  }

  async adminSnapshot(since: Date): Promise<AdminSnapshot> {
    const fromDay = since.toISOString().slice(0, 10);
    const clicks: Array<[string, number]> = [];
    for (const byDay of this.clicks.values()) for (const [day, n] of byDay) if (day >= fromDay) clicks.push([day, n]);
    const views: Array<[string, string, number]> = [];
    for (const [path, byDay] of this.views) for (const [day, n] of byDay) if (day >= fromDay) views.push([path, day, n]);
    return computeAdminSnapshot(
      {
        users: [...this.users.values()],
        businesses: [...this.businesses.values()],
        campaigns: [...this.campaigns.values()],
        codes: [...this.codes.values()],
        followsTotal: this.follows.size,
        redemptions: [...this.redemptions.values()],
        clicks,
        views,
      },
      since,
      new Date(this.now()),
    );
  }

  async countClicksByCodeIds(codeIds: string[], since: Date): Promise<Map<string, number>> {
    const from = since.toISOString().slice(0, 10);
    const out = new Map<string, number>();
    for (const id of codeIds) {
      let total = 0;
      for (const [day, n] of this.clicks.get(id) ?? []) if (day >= from) total += n;
      out.set(id, total);
    }
    return out;
  }

  async createRedemption(input: Omit<Redemption, "id" | "createdAt">): Promise<Redemption> {
    const r: Redemption = { ...input, id: randomUUID(), createdAt: this.now() };
    this.redemptions.set(r.id, r);
    return r;
  }

  async getRedemption(id: string): Promise<Redemption | null> {
    return this.redemptions.get(id) ?? null;
  }

  async listRedemptionsByBusiness(businessId: string): Promise<Redemption[]> {
    return [...this.redemptions.values()]
      .filter((r) => r.businessId === businessId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async listRedemptionsByInfluencer(influencerId: string): Promise<Redemption[]> {
    return [...this.redemptions.values()]
      .filter((r) => r.influencerId === influencerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getRedemptionByExternalOrderId(
    businessId: string,
    externalOrderId: string,
  ): Promise<Redemption | null> {
    const needle = externalOrderId.trim();
    for (const r of this.redemptions.values()) {
      if (r.businessId === businessId && r.externalOrderId === needle) return r;
    }
    return null;
  }

  async setRedemptionStatus(
    id: string,
    status: RedemptionStatus,
    cancellation?: { at: string; reason: CancellationReason },
  ): Promise<void> {
    const r = this.redemptions.get(id);
    if (!r) return;
    this.redemptions.set(id, {
      ...r,
      status,
      cancelledAt: cancellation?.at ?? r.cancelledAt,
      cancellationReason: cancellation?.reason ?? r.cancellationReason,
    });
  }

  // Cancelled sales came back, so they must not earn a tier or eat a budget cap
  async countInfluencerRedemptionsInMonth(influencerId: string, at: Date): Promise<number> {
    const key = monthKey(at);
    return [...this.redemptions.values()].filter(
      (r) =>
        r.influencerId === influencerId &&
        r.status !== "cancelled" &&
        monthKey(new Date(r.createdAt)) === key,
    ).length;
  }

  async countCampaignRedemptionsInMonth(campaignId: string, at: Date): Promise<number> {
    const key = monthKey(at);
    return [...this.redemptions.values()].filter(
      (r) =>
        r.campaignId === campaignId &&
        r.status !== "cancelled" &&
        monthKey(new Date(r.createdAt)) === key,
    ).length;
  }

  async hasCustomerBoughtBefore(businessId: string, customerHash: string): Promise<boolean> {
    for (const r of this.redemptions.values()) {
      if (r.businessId === businessId && r.customerHash === customerHash) return true;
    }
    return false;
  }

  private readonly hits = new Map<string, number>();

  async rateLimitHit(key: string, windowSeconds: number): Promise<number> {
    // Single-process, so a Map is already atomic here. Same window arithmetic
    // as the SQL function, so a limit behaves the same in tests as in production.
    const windowStart = Math.floor(Date.now() / 1000 / windowSeconds) * windowSeconds;
    const bucket = `${key}@${windowStart}`;
    const next = (this.hits.get(bucket) ?? 0) + 1;
    this.hits.set(bucket, next);
    return next;
  }
}
