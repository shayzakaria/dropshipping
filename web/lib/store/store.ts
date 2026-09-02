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

/**
 * Data access interface. The in-memory implementation backs the app today;
 * a Supabase implementation (see db/migrations) will replace it without
 * touching the domain logic or the UI.
 */
export interface DataStore {
  // Users
  createUser(input: Omit<User, "id" | "createdAt">): Promise<User>;
  getUser(id: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  getUserByAuthId(authUserId: string): Promise<User | null>;
  listUsers(): Promise<User[]>;
  listUsersByIds(ids: string[]): Promise<User[]>;

  // Businesses
  createBusiness(input: Omit<Business, "id" | "createdAt" | "apiSecret">): Promise<Business>;
  getBusiness(id: string): Promise<Business | null>;
  getBusinessByOwner(ownerId: string): Promise<Business | null>;
  /**
   * How a store authenticates itself to the public API.
   *
   * Every lookup here takes a value straight off the wire, so a garbage
   * argument must come back as null, never as a thrown error. An
   * implementation that lets the database reject a malformed key turns a 401
   * into a 500 — and the difference between the two tells an attacker what a
   * well-formed key looks like.
   */
  getBusinessByApiSecret(apiSecret: string): Promise<Business | null>;
  /**
   * Batched lookups. A page that renders N campaigns was doing N round trips
   * for their businesses and N more for their codes; across the Atlantic that
   * is most of the page's time. One query each instead.
   */
  listBusinessesByIds(ids: string[]): Promise<Business[]>;

  // Campaigns
  createCampaign(input: Omit<Campaign, "id" | "createdAt">): Promise<Campaign>;
  getCampaign(id: string): Promise<Campaign | null>;
  listActiveCampaigns(): Promise<Campaign[]>;
  listCampaignsByBusiness(businessId: string): Promise<Campaign[]>;
  listCampaignsByIds(ids: string[]): Promise<Campaign[]>;
  setCampaignStatus(id: string, status: CampaignStatus): Promise<void>;

  // Coupon codes
  createCode(input: Omit<CouponCode, "id" | "createdAt" | "code">): Promise<CouponCode>;
  getCodeByCode(code: string): Promise<CouponCode | null>;
  getCodeForInfluencerCampaign(influencerId: string, campaignId: string): Promise<CouponCode | null>;
  listCodesByInfluencer(influencerId: string): Promise<CouponCode[]>;
  listCodesByCampaign(campaignId: string): Promise<CouponCode[]>;
  listCodesByCampaignIds(campaignIds: string[]): Promise<CouponCode[]>;

  // Clicks on an influencer's tracking link. Counted per code per day — never
  // per visitor, so there is nothing here that identifies anyone.
  recordCodeClick(codeId: string): Promise<void>;
  countClicksByCodeIds(codeIds: string[], since: Date): Promise<Map<string, number>>;

  // Redemptions
  createRedemption(input: Omit<Redemption, "id" | "createdAt">): Promise<Redemption>;
  getRedemption(id: string): Promise<Redemption | null>;
  listRedemptionsByBusiness(businessId: string): Promise<Redemption[]>;
  listRedemptionsByInfluencer(influencerId: string): Promise<Redemption[]>;
  /** Idempotency lookup: has this store's order already been recorded? */
  getRedemptionByExternalOrderId(
    businessId: string,
    externalOrderId: string,
  ): Promise<Redemption | null>;
  /**
   * Cancel a commission (order returned) or mark it paid out. Cancelling
   * carries an audit trail: the influencer is losing money and is owed both
   * a timestamp and a reason.
   */
  setRedemptionStatus(
    id: string,
    status: RedemptionStatus,
    cancellation?: { at: string; reason: CancellationReason },
  ): Promise<void>;
  countInfluencerRedemptionsInMonth(influencerId: string, at: Date): Promise<number>;
  countCampaignRedemptionsInMonth(campaignId: string, at: Date): Promise<number>;
  hasCustomerBoughtBefore(businessId: string, customerHash: string): Promise<boolean>;

  /**
   * Count one hit against `key` in the current fixed window and return the
   * running total, including this hit. Must be atomic: serverless instances
   * share no memory, so two of them reading 9 and both writing 10 is the
   * failure this exists to prevent.
   */
  rateLimitHit(key: string, windowSeconds: number): Promise<number>;
}
