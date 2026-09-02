import type { AdminSnapshot, DailyPoint } from "../store/store";
import type { Business, Campaign, CouponCode, Redemption, User } from "./types";

/**
 * The operator's numbers, computed in one place.
 *
 * Both stores hand in raw rows and get the same snapshot back, so the admin
 * dashboard cannot drift between the in-memory demo and production — the
 * arithmetic that says what "revenue" means lives here once.
 */
export interface AdminRaw {
  users: User[];
  businesses: Business[];
  campaigns: Campaign[];
  codes: CouponCode[];
  followsTotal: number;
  redemptions: Redemption[];
  /** [day, clicks] already filtered to the window */
  clicks: Array<[string, number]>;
  /** [path, day, views] already filtered to the window */
  views: Array<[string, string, number]>;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function bucket(pairs: Array<[string, number]>): DailyPoint[] {
  const m = new Map<string, number>();
  for (const [day, v] of pairs) m.set(day, (m.get(day) ?? 0) + v);
  return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, value]) => ({ day, value }));
}

export function computeAdminSnapshot(raw: AdminRaw, since: Date, now: Date): AdminSnapshot {
  const from = since.toISOString();
  const nowIso = now.toISOString();
  const live = raw.redemptions.filter((r) => r.status !== "cancelled");
  const inWindow = live.filter((r) => r.createdAt >= from);

  const salesByBusiness = new Map<string, { sales: number; gmv: number }>();
  const salesByInfluencer = new Map<string, { sales: number; commission: number }>();
  for (const r of live) {
    const b = salesByBusiness.get(r.businessId) ?? { sales: 0, gmv: 0 };
    b.sales++;
    b.gmv += r.orderAmount;
    salesByBusiness.set(r.businessId, b);
    const i = salesByInfluencer.get(r.influencerId) ?? { sales: 0, commission: 0 };
    i.sales++;
    i.commission += r.influencerCommission;
    salesByInfluencer.set(r.influencerId, i);
  }
  const userName = new Map(raw.users.map((u) => [u.id, u.name]));
  const bizName = new Map(raw.businesses.map((b) => [b.id, b.name]));

  const byPath = new Map<string, number>();
  let viewsTotal = 0;
  for (const [path, , n] of raw.views) {
    viewsTotal += n;
    byPath.set(path, (byPath.get(path) ?? 0) + n);
  }

  return {
    users: {
      total: raw.users.length,
      businesses: raw.users.filter((u) => u.role === "business").length,
      influencers: raw.users.filter((u) => u.role === "influencer").length,
      demo: raw.users.filter((u) => u.isDemo).length,
      newSince: raw.users.filter((u) => u.createdAt >= from).length,
    },
    businesses: {
      total: raw.businesses.length,
      withProfile: raw.businesses.filter((b) => Boolean(b.description)).length,
      featured: raw.businesses.filter((b) => b.featuredUntil && b.featuredUntil > nowIso).length,
    },
    campaigns: {
      active: raw.campaigns.filter((c) => c.status === "active").length,
      paused: raw.campaigns.filter((c) => c.status === "paused").length,
      closed: raw.campaigns.filter((c) => c.status === "closed").length,
    },
    codes: { total: raw.codes.length },
    follows: { total: raw.followsTotal },
    redemptions: {
      count: inWindow.length,
      cancelled: raw.redemptions.filter((r) => r.status === "cancelled" && r.createdAt >= from).length,
      gmv: round2(inWindow.reduce((a, r) => a + r.orderAmount, 0)),
      buyerDiscounts: round2(inWindow.reduce((a, r) => a + r.buyerDiscount, 0)),
      influencerCommissions: round2(inWindow.reduce((a, r) => a + r.influencerCommission, 0)),
      platformFees: round2(inWindow.reduce((a, r) => a + r.platformFee, 0)),
    },
    clicks: { total: raw.clicks.reduce((a, [, n]) => a + n, 0) },
    pageViews: {
      total: viewsTotal,
      byPath: [...byPath.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)
        .map(([path, views]) => ({ path, views })),
    },
    series: {
      sales: bucket(inWindow.map((r) => [r.createdAt.slice(0, 10), 1])),
      clicks: bucket(raw.clicks),
      views: bucket(raw.views.map(([, day, n]) => [day, n])),
    },
    topBusinesses: [...salesByBusiness.entries()]
      .sort((a, b) => b[1].gmv - a[1].gmv)
      .slice(0, 5)
      .map(([id, v]) => ({ id, name: bizName.get(id) ?? "—", sales: v.sales, gmv: round2(v.gmv) })),
    topInfluencers: [...salesByInfluencer.entries()]
      .sort((a, b) => b[1].commission - a[1].commission)
      .slice(0, 5)
      .map(([id, v]) => ({ id, name: userName.get(id) ?? "—", sales: v.sales, commission: round2(v.commission) })),
    recent: [...raw.redemptions].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 12),
  };
}
