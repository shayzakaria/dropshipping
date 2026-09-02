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
  /**
   * Seeded example data, not a real person or business. Every screen that can
   * show one has to say so: the site is public, and a visitor who cannot tell
   * an example from a customer is being misled about how busy the platform is.
   */
  isDemo?: boolean;
  createdAt: string;
}

export interface Business {
  id: string;
  ownerId: string;
  name: string;
  storeUrl?: string;
  /** One or two lines the business writes about itself, for its directory card */
  description?: string;
  /** Absolute http(s) URL to a logo. Always rendered with a fallback. */
  logoUrl?: string;
  /** Secret used by the business's store (plugin/webhook) to authenticate redemption API calls */
  apiSecret: string;
  /** Seeded example data — see User.isDemo */
  isDemo?: boolean;
  createdAt: string;
}

/**
 * Pausing is a switch; closing is a door.
 *
 * A paused campaign is coming back — the business is out of stock, or the
 * month's budget is spent. A closed one is finished, and keeping it in the
 * same bucket as paused meant a dashboard where a campaign from March sat
 * looking like something you might switch on tonight. Closing cannot be
 * undone, which is exactly why it is worth being a separate state rather
 * than a convention.
 */
export type CampaignStatus = "active" | "paused" | "closed";

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

/** The reasons a business may void a commission. Deliberately short. */
export type CancellationReason = "returned" | "unpaid" | "fraud" | "error";

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
  /**
   * Fingerprint of the buyer identifier the store reported — never the value
   * itself. Used only for the equality checks in `lib/domain/privacy.ts`.
   */
  customerHash?: string;
  /** The store's own order id. Makes a retried checkout call idempotent. */
  externalOrderId?: string;
  status: RedemptionStatus;
  /** Commission is payable only from this moment on — the buyer's return window */
  holdUntil: string;
  /** When the commission was voided. Absent unless status is "cancelled". */
  cancelledAt?: string;
  /**
   * Why it was voided. An influencer watching money disappear from their
   * dashboard is owed an answer, and "the business clicked a button" is not one.
   */
  cancellationReason?: CancellationReason;
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
