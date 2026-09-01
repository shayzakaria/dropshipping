export type Role = "business" | "influencer";

export type TierName = "BRONZE" | "SILVER" | "GOLD";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  /**
   * The Supabase Auth user this profile belongs to. Absent on demo profiles,
   * which therefore cannot sign in once demo mode is off.
   */
  authUserId?: string;
  createdAt: string;
}

export interface Business {
  id: string;
  ownerId: string;
  name: string;
  storeUrl?: string;
  /** Secret used by the business's store (plugin/webhook) to authenticate redemption API calls */
  apiSecret: string;
  createdAt: string;
}

export type CampaignStatus = "active" | "paused";

export interface Campaign {
  id: string;
  businessId: string;
  title: string;
  description?: string;
  /** Percent of the order that the buyer gets off */
  buyerDiscountPct: number;
  /** Base percent of the order paid to the influencer */
  influencerPct: number;
  /** Percent of the order paid to the platform (tier bonuses are funded from this share) */
  platformPct: number;
  /** If true, the coupon is only valid for customers who never bought from this business before */
  newCustomersOnly: boolean;
  /** Optional safety cap on total redemptions per calendar month */
  maxRedemptionsPerMonth?: number;
  status: CampaignStatus;
  createdAt: string;
}

export interface CouponCode {
  id: string;
  campaignId: string;
  influencerId: string;
  code: string;
  status: "active" | "disabled";
  createdAt: string;
}

export type RedemptionSource = "api" | "manual" | "simulator";

/**
 * Stored lifecycle of a redemption's commission.
 *  - "held"      the normal state: money is set aside during the return window
 *  - "cancelled" the order came back or the sale was voided; no commission is owed
 *  - "paid"      the commission was actually paid out to the influencer
 */
export type RedemptionStatus = "held" | "cancelled" | "paid";

/** What the influencer sees, derived from status + the hold deadline + the clock */
export type CommissionState = "pending" | "available" | "cancelled" | "paid";

export interface Redemption {
  id: string;
  codeId: string;
  campaignId: string;
  businessId: string;
  influencerId: string;
  orderAmount: number;
  buyerDiscount: number;
  influencerCommission: number;
  platformFee: number;
  tier: TierName;
  tierBonusPct: number;
  /** Buyer identifier (email/phone) as reported by the store, used for fraud & new-customer checks */
  customerRef?: string;
  /** The store's own order id. Makes a retried checkout call idempotent. */
  externalOrderId?: string;
  status: RedemptionStatus;
  /** Commission is payable only from this moment on — the buyer's return window */
  holdUntil: string;
  source: RedemptionSource;
  createdAt: string;
}

export interface Split {
  buyerDiscount: number;
  influencerCommission: number;
  platformFee: number;
  /** Always buyerDiscount + influencerCommission + platformFee — fixed for the business regardless of tier */
  businessTotalCost: number;
}

export interface Tier {
  name: TierName;
  label: string;
  minMonthlySales: number;
  bonusPct: number;
}
