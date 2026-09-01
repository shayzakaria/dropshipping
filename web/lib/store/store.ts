import type {
  Business,
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

  // Campaigns
  createCampaign(input: Omit<Campaign, "id" | "createdAt">): Promise<Campaign>;
  getCampaign(id: string): Promise<Campaign | null>;
  listActiveCampaigns(): Promise<Campaign[]>;
  listCampaignsByBusiness(businessId: string): Promise<Campaign[]>;
  setCampaignStatus(id: string, status: CampaignStatus): Promise<void>;

  // Coupon codes
  createCode(input: Omit<CouponCode, "id" | "createdAt" | "code">): Promise<CouponCode>;
  getCodeByCode(code: string): Promise<CouponCode | null>;
  getCodeForInfluencerCampaign(influencerId: string, campaignId: string): Promise<CouponCode | null>;
  listCodesByInfluencer(influencerId: string): Promise<CouponCode[]>;
  listCodesByCampaign(campaignId: string): Promise<CouponCode[]>;

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
  /** Cancel a commission (order returned) or mark it paid out */
  setRedemptionStatus(id: string, status: RedemptionStatus): Promise<void>;
  countInfluencerRedemptionsInMonth(influencerId: string, at: Date): Promise<number>;
  countCampaignRedemptionsInMonth(campaignId: string, at: Date): Promise<number>;
  hasCustomerBoughtBefore(businessId: string, customerHash: string): Promise<boolean>;
}
