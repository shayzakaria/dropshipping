import { describe, expect, it } from "vitest";
import { MemoryStore } from "@/lib/store/memory";
import { redeemCode } from "@/lib/domain/service";

async function world() {
  const store = new MemoryStore();
  const owner = await store.createUser({ name: "בעלים", email: "o@x.com", role: "business" });
  const inf = await store.createUser({ name: "משפיענית", email: "i@x.com", role: "influencer" });
  const business = await store.createBusiness({ ownerId: owner.id, name: "חנות" });
  const campaign = await store.createCampaign({
    businessId: business.id, title: "ק", buyerDiscountPct: 10, influencerPct: 7, platformPct: 3,
    newCustomersOnly: false, status: "active",
  });
  const code = await store.createCode({ campaignId: campaign.id, influencerId: inf.id, status: "active" });
  return { store, owner, inf, business, campaign, code };
}

describe("operator access", () => {
  it("is never granted by creating an account", async () => {
    const store = new MemoryStore();
    const u = await store.createUser({ name: "מישהו", email: "a@x.com", role: "business" });
    expect(u.isAdmin).toBeFalsy();
    // Even an account that asks for it in the input does not get it: the flag
    // is not part of what createUser accepts from callers.
    const v = await store.createUser({ name: "ערמומי", email: "b@x.com", role: "business", isAdmin: true } as never);
    expect((await store.getUser(v.id))?.isAdmin ?? false).toBe(false);
  });
});

describe("campaign scope", () => {
  it("defaults to the whole store", async () => {
    const { campaign } = await world();
    expect(campaign.scope).toBe("store");
    expect(campaign.productName).toBeUndefined();
  });

  it("keeps the product name when a campaign is for one product", async () => {
    const { store, business } = await world();
    const c = await store.createCampaign({
      businessId: business.id, title: "אגרטל", buyerDiscountPct: 10, influencerPct: 7, platformPct: 3,
      newCustomersOnly: false, status: "active", scope: "product", productName: "אגרטל שחור",
    });
    expect(c.scope).toBe("product");
    expect(c.productName).toBe("אגרטל שחור");
  });
});

describe("following a business", () => {
  it("is idempotent and reversible", async () => {
    const { store, inf, business } = await world();
    await store.followBusiness(inf.id, business.id);
    await store.followBusiness(inf.id, business.id);
    expect((await store.listFollowsByInfluencer(inf.id))).toHaveLength(1);
    expect((await store.countFollowersByBusinessIds([business.id])).get(business.id)).toBe(1);
    await store.unfollowBusiness(inf.id, business.id);
    expect((await store.listFollowsByInfluencer(inf.id))).toHaveLength(0);
    expect((await store.countFollowersByBusinessIds([business.id])).get(business.id)).toBe(0);
  });
});

describe("featured placement", () => {
  it("is a moment in time, and clearing it works", async () => {
    const { store, business } = await world();
    const until = new Date(Date.now() + 86_400_000).toISOString();
    await store.setBusinessFeaturedUntil(business.id, until);
    expect((await store.getBusiness(business.id))?.featuredUntil).toBe(until);
    await store.setBusinessFeaturedUntil(business.id, null);
    expect((await store.getBusiness(business.id))?.featuredUntil).toBeUndefined();
  });
});

describe("the operator's snapshot", () => {
  it("adds up the money the same way the dashboards do", async () => {
    const { store, business, code, inf } = await world();
    await redeemCode(store, { code: code.code, orderAmount: 300, source: "api", apiSecret: business.apiSecret, customerRef: "a@b.c" });
    await redeemCode(store, { code: code.code, orderAmount: 100, source: "api", apiSecret: business.apiSecret, customerRef: "d@e.f" });
    await store.recordCodeClick(code.id);
    await store.recordCodeClick(code.id);
    await store.recordPageView("/");
    await store.recordPageView("/");
    await store.recordPageView("/businesses");
    await store.followBusiness(inf.id, business.id);

    const s = await store.adminSnapshot(new Date(Date.now() - 7 * 86_400_000));
    expect(s.redemptions.count).toBe(2);
    expect(s.redemptions.gmv).toBe(400);
    expect(s.redemptions.buyerDiscounts).toBe(40);
    expect(s.redemptions.influencerCommissions).toBe(28);
    expect(s.redemptions.platformFees).toBe(12);
    // discount + commission + fee is exactly the business's fixed cost
    expect(s.redemptions.buyerDiscounts + s.redemptions.influencerCommissions + s.redemptions.platformFees).toBe(80);
    expect(s.clicks.total).toBe(2);
    expect(s.pageViews.total).toBe(3);
    expect(s.pageViews.byPath[0]).toEqual({ path: "/", views: 2 });
    expect(s.follows.total).toBe(1);
    expect(s.users.total).toBe(2);
    expect(s.codes.total).toBe(1);
    expect(s.topBusinesses[0]).toMatchObject({ name: "חנות", sales: 2, gmv: 400 });
    expect(s.topInfluencers[0]).toMatchObject({ name: "משפיענית", sales: 2, commission: 28 });
    expect(s.series.sales.reduce((a, p) => a + p.value, 0)).toBe(2);
  });

  it("leaves a cancelled sale out of revenue but counts it as cancelled", async () => {
    const { store, business, code } = await world();
    const r = await redeemCode(store, { code: code.code, orderAmount: 200, source: "api", apiSecret: business.apiSecret, customerRef: "z@z.z" });
    await store.setRedemptionStatus(r.id, "cancelled", { at: new Date().toISOString(), reason: "returned" });
    const s = await store.adminSnapshot(new Date(Date.now() - 86_400_000));
    expect(s.redemptions.count).toBe(0);
    expect(s.redemptions.cancelled).toBe(1);
    expect(s.redemptions.platformFees).toBe(0);
  });
});
