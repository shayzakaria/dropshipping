import { MemoryStore } from "./memory";
import { redeemCode } from "../domain/service";

/**
 * Seeds a believable demo world so the deployed app is fully explorable:
 * one business with two campaigns, two influencers with codes, and a month
 * of redemptions that puts one influencer in the SILVER tier.
 *
 * Every account it creates is flagged isDemo, because the deployed site is
 * public. A visitor who reads "סטודיו דנה" as a real customer is being told
 * the platform is busier than it is, and that is the one lie a marketplace
 * cannot afford to tell the first businesses it is courting.
 */
export async function seed(store: MemoryStore): Promise<void> {
  const dana = await store.createUser({
    name: "דנה לוי",
    email: "dana@demo.co.il",
    role: "business",
    isDemo: true,
  });
  const noa = await store.createUser({
    name: "נועה מזרחי",
    email: "noa@demo.co.il",
    role: "influencer",
    isDemo: true,
  });
  const omer = await store.createUser({
    name: "עומר אזולאי",
    email: "omer@demo.co.il",
    role: "influencer",
    isDemo: true,
  });

  const business = await store.createBusiness({
    ownerId: dana.id,
    name: "סטודיו דנה — אופנה ישראלית",
    storeUrl: "https://dana-fashion.example",
    description: "אופנה ישראלית בעבודת יד, בסדרות קטנות. עסק לדוגמה בלבד.",
    isDemo: true,
  });

  const fall = await store.createCampaign({
    businessId: business.id,
    title: "קולקציית סתיו 2026",
    description: "10% הנחה לקונים חדשים על כל הקולקציה החדשה",
    buyerDiscountPct: 10,
    influencerPct: 7,
    platformPct: 3,
    newCustomersOnly: true,
    status: "active",
  });

  await store.createCampaign({
    businessId: business.id,
    title: "מבצע אקססוריז",
    description: "12% הנחה על תיקים וצעיפים — פתוח גם ללקוחות חוזרים",
    buyerDiscountPct: 12,
    influencerPct: 5,
    platformPct: 3,
    newCustomersOnly: false,
    maxRedemptionsPerMonth: 200,
    status: "active",
  });

  const noaCode = await store.createCode({
    campaignId: fall.id,
    influencerId: noa.id,
    status: "active",
  });
  const omerCode = await store.createCode({
    campaignId: fall.id,
    influencerId: omer.id,
    status: "active",
  });

  // A month of activity: 12 sales for Noa (reaches SILVER mid-month), 3 for Omer
  const amounts = [189, 249, 320, 149, 410, 275, 199, 350, 229, 179, 299, 260];
  for (let i = 0; i < amounts.length; i++) {
    await redeemCode(store, {
      code: noaCode.code,
      orderAmount: amounts[i],
      source: "api",
      apiSecret: business.apiSecret,
      customerRef: `buyer${i + 1}@example.com`,
    });
  }
  for (const [i, amount] of [219, 340, 185].entries()) {
    await redeemCode(store, {
      code: omerCode.code,
      orderAmount: amount,
      source: "api",
      apiSecret: business.apiSecret,
      customerRef: `friend${i + 1}@example.com`,
    });
  }
}
