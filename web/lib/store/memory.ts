import { randomUUID } from "crypto";
import type {
  Business,
  CancellationReason,
  Campaign,
  CampaignStatus,
  CouponCode,
  Redemption,
  RedemptionStatus,
  User,
} from "../domain/types";
import { generateCode, monthKey, normalizeCode } from "../domain/logic";
import type { DataStore } from "./store";

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
    const user: User = { ...input, email, id: randomUUID(), createdAt: this.now() };
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

  async createCampaign(input: Omit<Campaign, "id" | "createdAt">): Promise<Campaign> {
    const campaign: Campaign = { ...input, id: randomUUID(), createdAt: this.now() };
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
    let code = generateCode();
    while (await this.getCodeByCode(code)) code = generateCode();
    const record: CouponCode = { ...input, code, id: randomUUID(), createdAt: this.now() };
    this.codes.set(record.id, record);
    return record;
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
