import type { Campaign, CommissionState, Redemption, Split, Tier } from "./types";

export class DomainError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

/**
 * Influencer tiers. Bonuses are funded from the PLATFORM share, never from the
 * business — the business's total cost per sale is constant by design.
 * Ordered from highest to lowest so the first match wins.
 */
export const TIERS: Tier[] = [
  { name: "GOLD", label: "זהב", minMonthlySales: 30, bonusPct: 2 },
  { name: "SILVER", label: "כסף", minMonthlySales: 10, bonusPct: 1 },
  { name: "BRONZE", label: "ברונזה", minMonthlySales: 0, bonusPct: 0 },
];

export function tierForMonthlySales(salesCount: number): Tier {
  return TIERS.find((t) => salesCount >= t.minMonthlySales)!;
}

/** The next tier above the current sales count, or null when already at the top */
export function nextTier(salesCount: number): Tier | null {
  const sorted = [...TIERS].sort((a, b) => a.minMonthlySales - b.minMonthlySales);
  return sorted.find((t) => t.minMonthlySales > salesCount) ?? null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Split a single order between buyer discount, influencer commission and
 * platform fee. Invariants:
 *  - businessTotalCost = orderAmount * (buyerDiscountPct + influencerPct + platformPct) / 100
 *    and is NOT affected by tier bonuses.
 *  - buyerDiscount + influencerCommission + platformFee === businessTotalCost, to the agora.
 *  - The tier bonus moves money from the platform share to the influencer share,
 *    capped so the platform share never goes below zero.
 */
export function computeSplit(
  orderAmount: number,
  campaign: Pick<Campaign, "buyerDiscountPct" | "influencerPct" | "platformPct">,
  tierBonusPct = 0,
): Split {
  if (!Number.isFinite(orderAmount) || orderAmount <= 0) {
    throw new DomainError("INVALID_AMOUNT", "סכום הזמנה חייב להיות מספר חיובי");
  }
  const bonus = Math.max(0, Math.min(tierBonusPct, campaign.platformPct));
  const totalPct = campaign.buyerDiscountPct + campaign.influencerPct + campaign.platformPct;
  const businessTotalCost = round2((orderAmount * totalPct) / 100);
  const buyerDiscount = round2((orderAmount * campaign.buyerDiscountPct) / 100);
  const influencerCommission = round2((orderAmount * (campaign.influencerPct + bonus)) / 100);
  // Platform takes the remainder so the three parts always sum exactly to the business cost
  const platformFee = round2(businessTotalCost - buyerDiscount - influencerCommission);
  return { buyerDiscount, influencerCommission, platformFee, businessTotalCost };
}

export interface CampaignSplitInput {
  buyerDiscountPct: number;
  influencerPct: number;
  platformPct: number;
}

/** Validates the economics of a campaign before it is created */
export function validateCampaignSplit(input: CampaignSplitInput): void {
  const { buyerDiscountPct, influencerPct, platformPct } = input;
  for (const [label, v] of [
    ["הנחת קונה", buyerDiscountPct],
    ["עמלת משפיען", influencerPct],
    ["דמי פלטפורמה", platformPct],
  ] as const) {
    if (!Number.isFinite(v)) {
      throw new DomainError("INVALID_PCT", `אחוז לא תקין עבור ${label}`);
    }
  }
  if (buyerDiscountPct < 1) {
    throw new DomainError("DISCOUNT_TOO_LOW", "הנחת הקונה חייבת להיות לפחות 1% כדי שלקוד יהיה ערך");
  }
  if (influencerPct < 1) {
    throw new DomainError("COMMISSION_TOO_LOW", "עמלת המשפיען חייבת להיות לפחות 1% כדי שיהיה תמריץ לשווק");
  }
  if (platformPct < 1) {
    throw new DomainError("PLATFORM_TOO_LOW", "דמי הפלטפורמה חייבים להיות לפחות 1%");
  }
  const total = buyerDiscountPct + influencerPct + platformPct;
  if (total > 50) {
    throw new DomainError("TOTAL_TOO_HIGH", "סך ההטבה עולה על 50% מהמכירה — זה כנראה לא כלכלי לעסק");
  }
}

/** Unambiguous alphabet: no 0/O, 1/I/L to keep codes easy to read aloud and type */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateCode(rand: () => number = Math.random): string {
  const pick = () => CODE_ALPHABET[Math.floor(rand() * CODE_ALPHABET.length)];
  const group = (n: number) => Array.from({ length: n }, pick).join("");
  return `${group(4)}-${group(4)}`;
}

export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * How long a commission is held before it can be paid out. Israeli consumer
 * law gives a distance-selling buyer 14 days to cancel a purchase, so paying
 * earlier risks paying commission on a sale that comes back.
 */
export const COMMISSION_HOLD_DAYS = 14;

/** Nothing is paid out below this amount, to keep transfer costs sane */
export const MIN_PAYOUT_ILS = 100;

export function holdUntilFor(soldAt: Date): string {
  const until = new Date(soldAt.getTime());
  until.setUTCDate(until.getUTCDate() + COMMISSION_HOLD_DAYS);
  return until.toISOString();
}

/**
 * What the influencer actually sees for one sale. Availability is derived from
 * the clock rather than flipped by a scheduled job, so there is never a window
 * in which the stored state disagrees with reality.
 */
export function commissionState(
  redemption: Pick<Redemption, "status" | "holdUntil">,
  now: Date = new Date(),
): CommissionState {
  if (redemption.status === "cancelled") return "cancelled";
  if (redemption.status === "paid") return "paid";
  return now.toISOString() >= redemption.holdUntil ? "available" : "pending";
}
