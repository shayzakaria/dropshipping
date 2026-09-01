"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { clearSession, getCurrentUser, setSession } from "@/lib/auth";
import { DomainError, validateCampaignSplit } from "@/lib/domain/logic";
import { redeemCode } from "@/lib/domain/service";
import { getReadyStore } from "@/lib/store";
import type { Role } from "@/lib/domain/types";

export interface FormState {
  error?: string;
  ok?: boolean;
  result?: {
    orderAmount: number;
    buyerDiscount: number;
    influencerCommission: number;
    platformFee: number;
    tier: string;
    tierBonusPct: number;
    code: string;
  };
}

export async function loginAs(userId: string): Promise<void> {
  const store = await getReadyStore();
  const user = await store.getUser(userId);
  if (!user) redirect("/login");
  await setSession(userId);
  redirect("/dashboard");
}

export async function logout(): Promise<void> {
  await clearSession();
  redirect("/");
}

export async function register(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "") as Role;
  const businessName = String(formData.get("businessName") ?? "").trim();
  const storeUrl = String(formData.get("storeUrl") ?? "").trim();

  if (!name || !email.includes("@")) return { error: "צריך שם מלא ואימייל תקין" };
  if (role !== "business" && role !== "influencer") return { error: "בחרו תפקיד: עסק או משפיען" };
  if (role === "business" && !businessName) return { error: "לעסק צריך שם עסק" };

  const store = await getReadyStore();
  let userId: string;
  try {
    const user = await store.createUser({ name, email, role });
    if (role === "business") {
      await store.createBusiness({
        ownerId: user.id,
        name: businessName,
        storeUrl: storeUrl || undefined,
      });
    }
    userId = user.id;
  } catch (e) {
    if (e instanceof Error && e.message === "EMAIL_TAKEN") {
      return { error: "האימייל הזה כבר רשום — התחברו מלמעלה" };
    }
    throw e;
  }
  await setSession(userId);
  redirect("/dashboard");
}

export async function createCampaign(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user || user.role !== "business") redirect("/login");
  const store = await getReadyStore();
  const business = await store.getBusinessByOwner(user.id);
  if (!business) return { error: "לא נמצא עסק למשתמש הזה" };

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const buyerDiscountPct = Number(formData.get("buyerDiscountPct"));
  const influencerPct = Number(formData.get("influencerPct"));
  const platformPct = Number(formData.get("platformPct"));
  const newCustomersOnly = formData.get("newCustomersOnly") === "on";
  const maxRaw = String(formData.get("maxRedemptionsPerMonth") ?? "").trim();
  const maxRedemptionsPerMonth = maxRaw ? Number(maxRaw) : undefined;

  if (!title) return { error: "לקמפיין צריך שם" };
  if (maxRedemptionsPerMonth !== undefined && (!Number.isInteger(maxRedemptionsPerMonth) || maxRedemptionsPerMonth < 1)) {
    return { error: "תקרת מימושים חודשית חייבת להיות מספר שלם חיובי" };
  }
  try {
    validateCampaignSplit({ buyerDiscountPct, influencerPct, platformPct });
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message };
    throw e;
  }

  await store.createCampaign({
    businessId: business.id,
    title,
    description: description || undefined,
    buyerDiscountPct,
    influencerPct,
    platformPct,
    newCustomersOnly,
    maxRedemptionsPerMonth,
    status: "active",
  });
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function joinCampaign(campaignId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "influencer") redirect("/dashboard");
  const store = await getReadyStore();
  const campaign = await store.getCampaign(campaignId);
  if (!campaign || campaign.status !== "active") return;
  await store.createCode({ campaignId, influencerId: user.id, status: "active" });
  revalidatePath("/campaigns");
  revalidatePath("/dashboard");
}

export async function toggleCampaign(campaignId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.role !== "business") redirect("/login");
  const store = await getReadyStore();
  const business = await store.getBusinessByOwner(user.id);
  const campaign = await store.getCampaign(campaignId);
  if (!business || !campaign || campaign.businessId !== business.id) return;
  await store.setCampaignStatus(campaignId, campaign.status === "active" ? "paused" : "active");
  revalidatePath("/dashboard");
}

export async function simulatePurchase(_prev: FormState, formData: FormData): Promise<FormState> {
  const code = String(formData.get("code") ?? "").trim();
  const orderAmount = Number(formData.get("orderAmount"));
  const customerRef = String(formData.get("customerRef") ?? "").trim();
  if (!code) return { error: "צריך להזין קוד קופון" };

  const store = await getReadyStore();
  try {
    const r = await redeemCode(store, {
      code,
      orderAmount,
      source: "simulator",
      customerRef: customerRef || undefined,
    });
    revalidatePath("/dashboard");
    return {
      ok: true,
      result: {
        orderAmount: r.orderAmount,
        buyerDiscount: r.buyerDiscount,
        influencerCommission: r.influencerCommission,
        platformFee: r.platformFee,
        tier: r.tier,
        tierBonusPct: r.tierBonusPct,
        code,
      },
    };
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message };
    throw e;
  }
}
