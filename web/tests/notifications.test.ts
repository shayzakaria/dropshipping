import { describe, expect, it } from "vitest";
import { MemoryStore } from "../lib/store/memory";
import { templates } from "../lib/email/templates";

const SITE = "https://boost.example";
let seq = 0;
const someone = (store: MemoryStore, role: "influencer" | "business" = "influencer") =>
  store.createUser({ name: "רון", email: `u${seq++}@x.co`, role });

const claim = (store: MemoryStore, recipientId: string, dedupeKey: string) =>
  store.claimNotification({
    recipientId,
    kind: "sale",
    dedupeKey,
    subject: "נושא",
    body: "גוף",
  });

describe("never telling the same person the same thing twice", () => {
  it("claims a notification once", async () => {
    const store = new MemoryStore();
    const u = await someone(store);
    expect(await claim(store, u.id, "sale:abc")).not.toBeNull();
  });

  it("refuses a second claim on the same event", async () => {
    const store = new MemoryStore();
    const u = await someone(store);
    await claim(store, u.id, "sale:abc");
    // A retried action, a double-clicked button, two instances racing.
    expect(await claim(store, u.id, "sale:abc")).toBeNull();
  });

  it("still allows a different event", async () => {
    const store = new MemoryStore();
    const u = await someone(store);
    await claim(store, u.id, "sale:abc");
    expect(await claim(store, u.id, "sale:def")).not.toBeNull();
  });

  it("sends nothing at all to someone who opted out", async () => {
    const store = new MemoryStore();
    const u = await someone(store);
    await store.setEmailOptOut(u.id, true);

    // No row either — a queued row would claim an email is on its way.
    expect(await claim(store, u.id, "sale:abc")).toBeNull();
    expect(await store.listNotifications(u.id)).toHaveLength(0);
  });

  it("resumes once they opt back in", async () => {
    const store = new MemoryStore();
    const u = await someone(store);
    await store.setEmailOptOut(u.id, true);
    await claim(store, u.id, "sale:abc");
    await store.setEmailOptOut(u.id, false);
    expect(await claim(store, u.id, "sale:abc")).not.toBeNull();
  });

  it("records a failure instead of losing it", async () => {
    const store = new MemoryStore();
    const u = await someone(store);
    const n = (await claim(store, u.id, "sale:abc"))!;
    await store.markNotificationSent(n.id, "resend 429 rate limited");

    const [after] = await store.listNotifications(u.id);
    expect(after.status).toBe("failed");
    expect(after.error).toContain("429");
    expect(after.sentAt).toBeUndefined();
  });

  it("records a success", async () => {
    const store = new MemoryStore();
    const u = await someone(store);
    const n = (await claim(store, u.id, "sale:abc"))!;
    await store.markNotificationSent(n.id);

    const [after] = await store.listNotifications(u.id);
    expect(after.status).toBe("sent");
    expect(after.sentAt).toBeTruthy();
  });
});

describe("what the emails say", () => {
  it("puts the amount in the subject, because that is all most people read", () => {
    const t = templates.sale({ name: "רון", amount: 35, businessName: "סטודיו", siteUrl: SITE });
    expect(t.subject).toContain("35");
  });

  it("explains the hold rather than just imposing it", () => {
    const t = templates.sale({ name: "רון", amount: 35, businessName: "סטודיו", siteUrl: SITE });
    expect(t.text).toContain("14");
    expect(t.text).toContain("חלון הביטול");
  });

  it("gives a cancelled commission its amount and its reason", () => {
    const t = templates.commission_cancelled({
      name: "רון",
      amount: 21,
      businessName: "סטודיו",
      reason: "ההזמנה הוחזרה",
      siteUrl: SITE,
    });
    expect(t.subject).toContain("21");
    expect(t.text).toContain("ההזמנה הוחזרה");
  });

  it("says there is no minimum, since there is not one", () => {
    const t = templates.commission_released({ name: "רון", amount: 139.44, count: 6, siteUrl: SITE });
    expect(t.text).toContain("אין סכום מינימום");
  });

  it("breaks a statement into the two things it is made of", () => {
    const t = templates.statement_issued({
      businessName: "סטודיו",
      total: 191.73,
      commissions: 139.44,
      platformFees: 52.29,
      period: "2026-08",
      salesCount: 6,
      siteUrl: SITE,
    });
    expect(t.text).toContain("139.44");
    expect(t.text).toContain("52.29");
    expect(t.subject).toContain("2026-08");
  });

  it("carries a way to stop them in every message", () => {
    const all = [
      templates.sale({ name: "א", amount: 1, businessName: "ב", siteUrl: SITE }),
      templates.commission_released({ name: "א", amount: 1, count: 1, siteUrl: SITE }),
      templates.payout_paid({ name: "א", amount: 1, siteUrl: SITE }),
      templates.pool_low({ campaignTitle: "ק", codesLeft: 1, siteUrl: SITE }),
    ];
    for (const t of all) expect(t.text).toContain("/settings/notifications");
  });
});

describe("announcing released money", () => {
  it("finds nothing when nothing has been released", async () => {
    const store = new MemoryStore();
    expect(await store.findNewlyReleased()).toHaveLength(0);
  });

  it("stops announcing a standing balance once it has been announced", async () => {
    const store = new MemoryStore();
    const inf = await someone(store);
    const owner = await someone(store, "business");
    const business = await store.createBusiness({ ownerId: owner.id, name: "ח" });
    const campaign = await store.createCampaign({
      businessId: business.id,
      title: "ק",
      buyerDiscountPct: 10,
      influencerPct: 7,
      platformPct: 3,
      newCustomersOnly: false,
      status: "active",
      codeSource: "generated",
    });
    const code = await store.createCode({ campaignId: campaign.id, influencerId: inf.id, status: "active" });
    await store.createRedemption({
      codeId: code.id,
      campaignId: campaign.id,
      businessId: business.id,
      influencerId: inf.id,
      orderAmount: 300,
      buyerDiscount: 30,
      influencerCommission: 21,
      platformFee: 9,
      tier: "BRONZE",
      tierBonusPct: 0,
      status: "held",
      holdUntil: "2020-01-15T00:00:00.000Z",
      source: "api",
    });

    const first = await store.findNewlyReleased();
    expect(first).toHaveLength(1);
    expect(first[0].amount).toBe(21);

    // Telling them is what makes it old news.
    await store.claimNotification({
      recipientId: inf.id,
      kind: "commission_released",
      dedupeKey: "released:x",
      subject: "s",
      body: "b",
    });
    expect(await store.findNewlyReleased()).toHaveLength(0);
  });
});
