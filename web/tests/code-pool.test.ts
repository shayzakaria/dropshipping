import { describe, expect, it } from "vitest";
import { MemoryStore } from "../lib/store/memory";
import { PoolEmptyError } from "../lib/domain/logic";
import { parseCodeListClient } from "../lib/domain/codes";

let seq = 0;

async function campaign(store: MemoryStore, codeSource: "pool" | "generated" = "pool") {
  const owner = await store.createUser({ name: "ד", email: `o${seq++}@x.co`, role: "business" });
  const business = await store.createBusiness({ ownerId: owner.id, name: "חנות" });
  return store.createCampaign({
    businessId: business.id,
    title: "ק",
    buyerDiscountPct: 10,
    influencerPct: 7,
    platformPct: 3,
    newCustomersOnly: false,
    status: "active",
    codeSource,
  });
}

const influencer = (store: MemoryStore, n: number) =>
  store.createUser({ name: `מ${n}`, email: `i${n}@x.co`, role: "influencer" });

describe("reading a pasted list of codes", () => {
  it("takes one per line, which is how a shop exports them", () => {
    expect(parseCodeListClient("A-1\nA-2\nA-3")).toEqual(["A-1", "A-2", "A-3"]);
  });

  it("takes commas and semicolons too", () => {
    expect(parseCodeListClient("A-1, A-2; A-3")).toEqual(["A-1", "A-2", "A-3"]);
  });

  it("survives the blank lines and stray spaces of a spreadsheet column", () => {
    expect(parseCodeListClient("  A-1  \n\n\n  A-2 \n ")).toEqual(["A-1", "A-2"]);
  });

  it("drops repeats inside one paste", () => {
    expect(parseCodeListClient("A-1\nA-1\nA-2")).toEqual(["A-1", "A-2"]);
  });

  it("finds nothing in an empty paste", () => {
    expect(parseCodeListClient("   \n \n")).toEqual([]);
  });
});

describe("handing out codes the shop created", () => {
  it("gives an influencer a code from the pool, not an invented one", async () => {
    const store = new MemoryStore();
    const c = await campaign(store);
    await store.addPoolCodes(c.id, ["DANA-01", "DANA-02"]);
    const inf = await influencer(store, 1);

    const code = await store.createCode({ campaignId: c.id, influencerId: inf.id, status: "active" });
    expect(["DANA-01", "DANA-02"]).toContain(code.code);
  });

  it("never gives the same code to two influencers", async () => {
    const store = new MemoryStore();
    const c = await campaign(store);
    await store.addPoolCodes(c.id, ["A-1", "A-2", "A-3"]);

    const codes = [];
    for (let i = 0; i < 3; i++) {
      const inf = await influencer(store, i);
      codes.push((await store.createCode({ campaignId: c.id, influencerId: inf.id, status: "active" })).code);
    }
    expect(new Set(codes).size).toBe(3);
  });

  it("refuses the join when the pool is empty rather than inventing a code", async () => {
    const store = new MemoryStore();
    const c = await campaign(store);
    await store.addPoolCodes(c.id, ["ONLY-1"]);

    const first = await influencer(store, 1);
    await store.createCode({ campaignId: c.id, influencerId: first.id, status: "active" });

    // An invented code would not exist at the shop's checkout, so the buyer
    // would be told "invalid code" and the influencer would take the blame.
    const second = await influencer(store, 2);
    await expect(
      store.createCode({ campaignId: c.id, influencerId: second.id, status: "active" }),
    ).rejects.toThrow(PoolEmptyError);
  });

  it("gives a returning influencer the code they already hold", async () => {
    const store = new MemoryStore();
    const c = await campaign(store);
    await store.addPoolCodes(c.id, ["A-1", "A-2"]);
    const inf = await influencer(store, 1);

    const first = await store.createCode({ campaignId: c.id, influencerId: inf.id, status: "active" });
    const again = await store.createCode({ campaignId: c.id, influencerId: inf.id, status: "active" });
    expect(again.code).toBe(first.code);
    // and joining twice did not burn a second code
    expect((await store.poolStatus(c.id)).available).toBe(1);
  });

  it("still generates for a campaign whose shop validates codes with us", async () => {
    const store = new MemoryStore();
    const c = await campaign(store, "generated");
    const inf = await influencer(store, 1);
    const code = await store.createCode({ campaignId: c.id, influencerId: inf.id, status: "active" });
    expect(code.code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  });
});

describe("keeping the pool stocked", () => {
  it("counts what is left as codes are taken", async () => {
    const store = new MemoryStore();
    const c = await campaign(store);
    await store.addPoolCodes(c.id, ["A-1", "A-2", "A-3"]);
    expect(await store.poolStatus(c.id)).toEqual({ total: 3, available: 3 });

    const inf = await influencer(store, 1);
    await store.createCode({ campaignId: c.id, influencerId: inf.id, status: "active" });
    expect(await store.poolStatus(c.id)).toEqual({ total: 3, available: 2 });
  });

  it("skips codes already in the pool instead of failing the whole paste", async () => {
    const store = new MemoryStore();
    const c = await campaign(store);
    await store.addPoolCodes(c.id, ["A-1", "A-2"]);
    // A business pasting a second batch usually overlaps with the first.
    const added = await store.addPoolCodes(c.id, ["A-2", "A-3", "A-4"]);
    expect(added).toBe(2);
    expect((await store.poolStatus(c.id)).total).toBe(4);
  });

  it("shows a code to try without taking it out of circulation", async () => {
    const store = new MemoryStore();
    const c = await campaign(store);
    await store.addPoolCodes(c.id, ["A-1"]);

    expect(await store.peekPoolCode(c.id)).toBe("A-1");
    // Peeking is not claiming: the one code is still there for an influencer.
    expect((await store.poolStatus(c.id)).available).toBe(1);
  });

  it("has nothing to show when the pool is dry", async () => {
    const store = new MemoryStore();
    const c = await campaign(store);
    expect(await store.peekPoolCode(c.id)).toBeNull();
  });

  it("keeps each campaign's codes to itself", async () => {
    const store = new MemoryStore();
    const a = await campaign(store);
    const b = await campaign(store);
    await store.addPoolCodes(a.id, ["SHARED-1"]);

    expect(await store.peekPoolCode(b.id)).toBeNull();
    expect((await store.poolStatus(b.id)).total).toBe(0);
  });
});

describe("a campaign is not offered until a code has been tried", () => {
  it("starts unverified", async () => {
    const store = new MemoryStore();
    const c = await campaign(store);
    expect(c.verifiedAt).toBeUndefined();
  });

  it("records when the business confirmed it works", async () => {
    const store = new MemoryStore();
    const c = await campaign(store);
    await store.setCampaignVerified(c.id, "2026-09-03T00:00:00.000Z");
    expect((await store.getCampaign(c.id))?.verifiedAt).toBe("2026-09-03T00:00:00.000Z");
  });

  it("can be withdrawn again if the code stops working", async () => {
    const store = new MemoryStore();
    const c = await campaign(store);
    await store.setCampaignVerified(c.id, "2026-09-03T00:00:00.000Z");
    await store.setCampaignVerified(c.id, null);
    expect((await store.getCampaign(c.id))?.verifiedAt).toBeUndefined();
  });
});
