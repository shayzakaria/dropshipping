import type { DataStore } from "../store/store";
import {
  computeSplit,
  DomainError,
  holdUntilFor,
  MAX_ORDER_AMOUNT_ILS,
  normalizeCode,
  tierForMonthlySales,
} from "./logic";
import type { Redemption, RedemptionSource } from "./types";

export interface RedeemInput {
  code: string;
  orderAmount: number;
  source: RedemptionSource;
  /** Buyer identifier (email/phone) reported by the store — used for fraud & new-customer checks */
  customerRef?: string;
  /** Required when source === "api": must match the business's apiSecret */
  apiSecret?: string;
  /**
   * The store's own order id. When supplied, replaying the same order returns
   * the redemption already on file instead of paying a second commission —
   * checkout webhooks retry, and a retry must not cost the business twice.
   */
  externalOrderId?: string;
  /** Injectable clock for tests */
  now?: Date;
}

/**
 * The heart of the platform: validate a coupon redemption and record the
 * money split. Throws DomainError with a stable code + Hebrew message on
 * any rejection, so both the API and the UI can surface the reason.
 */
export async function redeemCode(store: DataStore, input: RedeemInput): Promise<Redemption> {
  const now = input.now ?? new Date();

  // Authenticate before touching the code table. Looking the code up first
  // turned the endpoint into an oracle: an unauthenticated caller could tell a
  // real coupon code from a fake one by the error it got back.
  const callerBusiness =
    input.source === "api"
      ? input.apiSecret
        ? await store.getBusinessByApiSecret(input.apiSecret)
        : null
      : null;
  if (input.source === "api" && !callerBusiness) {
    throw new DomainError("BAD_SECRET", "מפתח ה-API אינו מוכר");
  }

  const code = await store.getCodeByCode(normalizeCode(input.code));
  if (!code || code.status !== "active") {
    throw new DomainError("CODE_NOT_FOUND", "קוד הקופון לא קיים או לא פעיל");
  }

  const campaign = await store.getCampaign(code.campaignId);
  if (!campaign || campaign.status !== "active") {
    throw new DomainError("CAMPAIGN_INACTIVE", "הקמפיין של הקוד הזה אינו פעיל כרגע");
  }

  const business = await store.getBusiness(campaign.businessId);
  if (!business) {
    throw new DomainError("BUSINESS_NOT_FOUND", "העסק של הקמפיין לא נמצא");
  }

  // A valid key for another business must not confirm that this code exists,
  // so it gets the same answer as a code that is simply not there.
  if (callerBusiness && callerBusiness.id !== business.id) {
    throw new DomainError("CODE_NOT_FOUND", "קוד הקופון לא קיים או לא פעיל");
  }

  if (!Number.isFinite(input.orderAmount) || input.orderAmount <= 0) {
    throw new DomainError("INVALID_AMOUNT", "סכום הזמנה חייב להיות מספר חיובי");
  }
  if (input.orderAmount > MAX_ORDER_AMOUNT_ILS) {
    throw new DomainError(
      "AMOUNT_TOO_LARGE",
      `סכום הזמנה חורג מהתקרה (${MAX_ORDER_AMOUNT_ILS} ₪)`,
    );
  }

  // Idempotency comes after the secret check so an unauthenticated caller
  // cannot probe which order ids exist.
  const externalOrderId = input.externalOrderId?.trim() || undefined;
  if (externalOrderId) {
    const already = await store.getRedemptionByExternalOrderId(business.id, externalOrderId);
    if (already) return already;
  }

  const customerRef = input.customerRef?.trim().toLowerCase() || undefined;

  // Fraud guard: an influencer redeeming their own code earns commission on
  // their own purchase — blocked outright.
  const influencer = await store.getUser(code.influencerId);
  if (customerRef && influencer && customerRef === influencer.email) {
    throw new DomainError("SELF_REDEMPTION", "משפיען לא יכול לממש את הקוד של עצמו");
  }

  // Cannibalization guard: by default coupons only apply to customers who are
  // new to this business. Only enforceable when the store reports a customerRef.
  if (campaign.newCustomersOnly && customerRef) {
    if (await store.hasCustomerBoughtBefore(campaign.businessId, customerRef)) {
      throw new DomainError("NOT_NEW_CUSTOMER", "הקופון תקף ללקוחות חדשים של העסק בלבד");
    }
  }

  if (campaign.maxRedemptionsPerMonth) {
    const used = await store.countCampaignRedemptionsInMonth(campaign.id, now);
    if (used >= campaign.maxRedemptionsPerMonth) {
      throw new DomainError("MONTHLY_CAP_REACHED", "הקמפיין הגיע לתקרת המימושים החודשית שלו");
    }
  }

  // Tier is computed from the influencer's sales this month BEFORE this sale.
  // The bonus is funded from the platform share — the business cost is unchanged.
  const monthlySales = await store.countInfluencerRedemptionsInMonth(code.influencerId, now);
  const tier = tierForMonthlySales(monthlySales);
  const split = computeSplit(input.orderAmount, campaign, tier.bonusPct);

  return store.createRedemption({
    codeId: code.id,
    campaignId: campaign.id,
    businessId: campaign.businessId,
    influencerId: code.influencerId,
    orderAmount: input.orderAmount,
    buyerDiscount: split.buyerDiscount,
    influencerCommission: split.influencerCommission,
    platformFee: split.platformFee,
    tier: tier.name,
    tierBonusPct: tier.bonusPct,
    customerRef,
    externalOrderId,
    status: "held",
    holdUntil: holdUntilFor(now),
    source: input.source,
  });
}

export interface CancelInput {
  /** The business the sale belongs to. Ownership is enforced, not assumed. */
  businessId: string;
  /** Identify the sale by our id or by the store's own order id */
  redemptionId?: string;
  externalOrderId?: string;
}

/**
 * Void the commission on a returned or fraudulent sale.
 *
 * Idempotent: cancelling an already-cancelled sale succeeds and changes
 * nothing, because a refund webhook retries like any other. A commission that
 * was already paid out cannot be cancelled here — that money has left, and
 * clawing it back is a decision a person makes, not a webhook.
 */
export async function cancelRedemption(
  store: DataStore,
  input: CancelInput,
): Promise<Redemption> {
  const found = input.redemptionId
    ? await store.getRedemption(input.redemptionId)
    : input.externalOrderId
      ? await store.getRedemptionByExternalOrderId(input.businessId, input.externalOrderId)
      : null;

  if (!found) {
    throw new DomainError("REDEMPTION_NOT_FOUND", "המכירה לא נמצאה");
  }
  // A sale is only ever cancellable by the business that made it
  if (found.businessId !== input.businessId) {
    throw new DomainError("REDEMPTION_NOT_FOUND", "המכירה לא נמצאה");
  }
  if (found.status === "cancelled") return found;
  if (found.status === "paid") {
    throw new DomainError("ALREADY_PAID", "העמלה כבר שולמה ולא ניתן לבטל אותה אוטומטית");
  }

  await store.setRedemptionStatus(found.id, "cancelled");
  return { ...found, status: "cancelled" };
}
