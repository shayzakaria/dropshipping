import { monthKey } from "./logic";
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

const round2 = (n: number) => Math.round(n * 100) / 100;

export function businessStats(redemptions: Redemption[], at: Date): BusinessStats {
  const key = monthKey(at);
  const month = redemptions.filter((r) => monthKey(new Date(r.createdAt)) === key);
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
  const month = redemptions.filter((r) => monthKey(new Date(r.createdAt)) === key);
  const round = (n: number) => round2(n);
  return {
    monthCount: month.length,
    monthEarnings: round(month.reduce((acc, r) => acc + r.influencerCommission, 0)),
    totalEarnings: round(redemptions.reduce((acc, r) => acc + r.influencerCommission, 0)),
    totalCount: redemptions.length,
  };
}
