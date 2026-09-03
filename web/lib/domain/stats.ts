import { commissionState, monthKey, RECOMMENDED_PAYOUT_ILS } from "./logic";
import type { Redemption } from "./types";

export interface BusinessStats {
  monthCount: number;
  monthRevenue: number;
  monthBuyerDiscounts: number;
  monthCommissions: number;
  monthPlatformFees: number;
  monthTotalCost: number;
  /** Marketing cost as % of revenue generated through the platform */
  costPctOfRevenue: number;
}

export interface InfluencerStats {
  monthCount: number;
  monthEarnings: number;
  totalEarnings: number;
  totalCount: number;
}

export interface WalletStats {
  /** Commission still inside the buyer's return window */
  pending: number;
  /** Commission past its hold and payable now */
  available: number;
  paid: number;
  /** Commission voided because the order came back */
  cancelled: number;
  /** When the earliest pending commission becomes payable */
  nextReleaseAt?: string;
  /** True whenever there is any released money at all */
  canWithdraw: boolean;
  /** Withdrawable, but small enough that transfer fees will be felt */
  isSmallPayout: boolean;
  recommendedPayout: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** A cancelled sale is a returned order: it is not revenue and not a cost */
const live = (rs: Redemption[]) => rs.filter((r) => r.status !== "cancelled");

/**
 * The influencer's money, split by what they can actually withdraw today.
 * Showing one lump sum would promise money that a return could still take back.
 */
export function walletStats(redemptions: Redemption[], now: Date = new Date()): WalletStats {
  let pending = 0;
  let available = 0;
  let paid = 0;
  let cancelled = 0;
  let nextReleaseAt: string | undefined;

  for (const r of redemptions) {
    switch (commissionState(r, now)) {
      case "pending":
        pending += r.influencerCommission;
        if (!nextReleaseAt || r.holdUntil < nextReleaseAt) nextReleaseAt = r.holdUntil;
        break;
      case "available":
        available += r.influencerCommission;
        break;
      case "paid":
        paid += r.influencerCommission;
        break;
      case "cancelled":
        cancelled += r.influencerCommission;
        break;
    }
  }

  return {
    pending: round2(pending),
    available: round2(available),
    paid: round2(paid),
    cancelled: round2(cancelled),
    nextReleaseAt,
    canWithdraw: round2(available) > 0,
    isSmallPayout: round2(available) > 0 && round2(available) < RECOMMENDED_PAYOUT_ILS,
    recommendedPayout: RECOMMENDED_PAYOUT_ILS,
  };
}

export function businessStats(redemptions: Redemption[], at: Date): BusinessStats {
  const key = monthKey(at);
  const month = live(redemptions).filter((r) => monthKey(new Date(r.createdAt)) === key);
  const sum = (f: (r: Redemption) => number) => round2(month.reduce((acc, r) => acc + f(r), 0));
  const monthRevenue = sum((r) => r.orderAmount);
  const monthBuyerDiscounts = sum((r) => r.buyerDiscount);
  const monthCommissions = sum((r) => r.influencerCommission);
  const monthPlatformFees = sum((r) => r.platformFee);
  const monthTotalCost = round2(monthBuyerDiscounts + monthCommissions + monthPlatformFees);
  return {
    monthCount: month.length,
    monthRevenue,
    monthBuyerDiscounts,
    monthCommissions,
    monthPlatformFees,
    monthTotalCost,
    costPctOfRevenue: monthRevenue > 0 ? round2((monthTotalCost / monthRevenue) * 100) : 0,
  };
}

export function influencerStats(redemptions: Redemption[], at: Date): InfluencerStats {
  const key = monthKey(at);
  const earned = live(redemptions);
  const month = earned.filter((r) => monthKey(new Date(r.createdAt)) === key);
  return {
    monthCount: month.length,
    monthEarnings: round2(month.reduce((acc, r) => acc + r.influencerCommission, 0)),
    totalEarnings: round2(earned.reduce((acc, r) => acc + r.influencerCommission, 0)),
    totalCount: earned.length,
  };
}
