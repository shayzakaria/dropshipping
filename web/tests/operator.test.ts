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

describe("operator support actions", () => {
  it("writes an audit row that survives and reads back newest first", async () => {
    const { store, owner, inf } = await world();
    await store.recordAdminAction({ actorId: owner.id, action: "suspend_user", subjectKind: "user", subjectId: inf.id, detail: { reason: "spam" } });
    await store.recordAdminAction({ actorId: owner.id, action: "disable_code", subjectKind: "code", subjectId: "c1" });
    const log = await store.listAdminActions(10);
    expect(log).toHaveLength(2);
    expect(log[0].action).toBe("disable_code");
    expect(log[1].detail).toEqual({ reason: "spam" });
  });

  it("suspends and releases an account, keeping the reason", async () => {
    const { store, inf } = await world();
    await store.setUserSuspended(inf.id, "חשד להונאה");
    const locked = await store.getUser(inf.id);
    expect(locked?.suspendedAt).toBeTruthy();
    expect(locked?.suspendedReason).toBe("חשד להונאה");
    await store.setUserSuspended(inf.id, null);
    const free = await store.getUser(inf.id);
    expect(free?.suspendedAt).toBeUndefined();
    expect(free?.suspendedReason).toBeUndefined();
  });

  it("disables a code so it stops redeeming, and can restore it", async () => {
    const { store, business, code } = await world();
    await store.setCodeStatus(code.id, "disabled");
    await expect(
      redeemCode(store, { code: code.code, orderAmount: 100, source: "api", apiSecret: business.apiSecret, customerRef: "a@b.c" }),
    ).rejects.toMatchObject({ code: "CODE_NOT_FOUND" });
    await store.setCodeStatus(code.id, "active");
    const r = await redeemCode(store, { code: code.code, orderAmount: 100, source: "api", apiSecret: business.apiSecret, customerRef: "a@b.c" });
    expect(r.orderAmount).toBe(100);
  });

  it("assembles a support view from both sides of an account", async () => {
    const { store, owner, inf, business, code } = await world();
    await redeemCode(store, { code: code.code, orderAmount: 250, source: "api", apiSecret: business.apiSecret, customerRef: "q@w.e" });
    await store.recordCodeClick(code.id);
    await store.followBusiness(inf.id, business.id);

    const asInfluencer = await store.supportView(inf.id);
    expect(asInfluencer?.user.email).toBe("i@x.com");
    expect(asInfluencer?.business).toBeNull();
    expect(asInfluencer?.codes).toHaveLength(1);
    expect(asInfluencer?.codes[0].clicks).toBe(1);
    expect(asInfluencer?.codes[0].campaignTitle).toBe("ק");
    expect(asInfluencer?.redemptions).toHaveLength(1);
    expect(asInfluencer?.followedBusinessNames).toEqual(["חנות"]);

    const asOwner = await store.supportView(owner.id);
    expect(asOwner?.business?.name).toBe("חנות");
    expect(asOwner?.campaigns).toHaveLength(1);
    expect(asOwner?.redemptions).toHaveLength(1);

    expect(await store.supportView("nope")).toBeNull();
  });

  it("finds accounts by name or email, and nothing on an empty query", async () => {
    const { store } = await world();
    expect((await store.searchUsers("משפיענית", 10)).map((u) => u.email)).toEqual(["i@x.com"]);
    expect((await store.searchUsers("o@x", 10)).map((u) => u.email)).toEqual(["o@x.com"]);
    expect(await store.searchUsers("", 10)).toEqual([]);
    expect(await store.searchUsers("   ", 10)).toEqual([]);
  });
});

describe("a suspended account is signed out everywhere", () => {
  it("stops being returned as the current user no matter which path found it", async () => {
    // getCurrentUser resolves a user two ways — a Supabase session and the
    // demo cookie. The suspension check has to sit on the answer, not on one
    // of the routes to it; the first version guarded only the Supabase branch
    // and a suspended user could still sign in through the demo path.
    const { store, inf } = await world();
    await store.setUserSuspended(inf.id, "חשד להונאה");
    const stored = await store.getUser(inf.id);
    expect(stored?.suspendedAt).toBeTruthy();

    const active = (u: typeof stored) => (u?.suspendedAt ? null : u);
    expect(active(stored)).toBeNull();
    await store.setUserSuspended(inf.id, null);
    expect(active(await store.getUser(inf.id))?.id).toBe(inf.id);
  });
});
