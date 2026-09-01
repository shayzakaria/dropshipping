"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { clearSession, getCurrentUser, setSession } from "@/lib/auth";
import { DomainError, PLATFORM_PCT, validateCampaignSplit } from "@/lib/domain/logic";
import { cancelRedemption, redeemCode } from "@/lib/domain/service";
import { getReadyStore, isDemoMode } from "@/lib/store";
import { authErrorMessage, getAuthClient, isAuthConfigured } from "@/lib/supabase-auth";
import type { Role } from "@/lib/domain/types";

export interface FormState {
  error?: string;
  /** A neutral message that is not a failure, e.g. "confirm your email" */
  notice?: string;
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

const MIN_PASSWORD_LENGTH = 8;

export async function register(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "") as Role;
  const password = String(formData.get("password") ?? "");
  const businessName = String(formData.get("businessName") ?? "").trim();
  const storeUrl = String(formData.get("storeUrl") ?? "").trim();

  if (!name || !email.includes("@")) return { error: "צריך שם מלא ואימייל תקין" };
  if (role !== "business" && role !== "influencer") return { error: "בחרו תפקיד: עסק או משפיען" };
  if (role === "business" && !businessName) return { error: "לעסק צריך שם עסק" };

  const store = await getReadyStore();
  const withPassword = isAuthConfigured();
  if (withPassword && password.length < MIN_PASSWORD_LENGTH) {
    return { error: `הסיסמה צריכה להיות באורך ${MIN_PASSWORD_LENGTH} תווים לפחות` };
  }

  // Reject a taken email before creating an auth user, so a failed sign-up
  // never leaves an identity with no profile behind it.
  if (await store.getUserByEmail(email)) {
    return { error: "האימייל הזה כבר רשום — אפשר להתחבר" };
  }

  let authUserId: string | undefined;
  let hasSession = true;
  if (withPassword) {
    const supabase = await getAuthClient();
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: authErrorMessage(error.message) };
    if (!data.user) return { error: "ההרשמה לא הושלמה. נסו שוב" };
    authUserId = data.user.id;
    // With email confirmation on, Supabase returns a user but no session yet
    hasSession = Boolean(data.session);
  }

  let userId: string;
  try {
    const user = await store.createUser({ name, email, role, authUserId });
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
      return { error: "האימייל הזה כבר רשום — אפשר להתחבר" };
    }
    throw e;
  }

  if (!withPassword) await setSession(userId);
  if (!hasSession) {
    return { notice: "שלחנו לכם מייל לאישור הכתובת. אחרי האישור אפשר להיכנס." };
  }
  redirect("/dashboard");
}

/** Sign in with email and password. Available once Supabase Auth is configured. */
export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email.includes("@") || !password) return { error: "צריך אימייל וסיסמה" };
  if (!isAuthConfigured()) return { error: "הכניסה עם סיסמה עוד לא זמינה" };

  const supabase = await getAuthClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: authErrorMessage(error.message) };
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
  // Never taken from the request: a readOnly input is a browser-side courtesy,
  // not a control. The platform's own share is set here.
  const platformPct = PLATFORM_PCT;
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

/** The business voids a commission after a return. Ownership is enforced. */
export async function cancelSale(redemptionId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.role !== "business") redirect("/login");
  const store = await getReadyStore();
  const business = await store.getBusinessByOwner(user.id);
  if (!business) return;
  try {
    await cancelRedemption(store, { businessId: business.id, redemptionId });
  } catch (e) {
    // A sale that is missing, already paid, or not this business's stays as it is
    if (!(e instanceof DomainError)) throw e;
  }
  revalidatePath("/dashboard");
}

export async function simulatePurchase(_prev: FormState, formData: FormData): Promise<FormState> {
  const code = String(formData.get("code") ?? "").trim();
  const orderAmount = Number(formData.get("orderAmount"));
  const customerRef = String(formData.get("customerRef") ?? "").trim();
  if (!code) return { error: "צריך להזין קוד קופון" };

  const store = await getReadyStore();

  // The simulator writes real redemptions, so outside demo mode it is a tool
  // for a business to test its own integration — never an open endpoint that
  // an anonymous visitor can use to mint commissions on someone else's code.
  if (!isDemoMode()) {
    const user = await getCurrentUser();
    if (!user || user.role !== "business") {
      return { error: "הסימולטור פתוח רק לבעלי עסק מחוברים" };
    }
    const business = await store.getBusinessByOwner(user.id);
    const found = await store.getCodeByCode(code);
    const campaign = found ? await store.getCampaign(found.campaignId) : null;
    if (!business || !campaign || campaign.businessId !== business.id) {
      return { error: "אפשר לבדוק רק קודים של הקמפיינים שלכם" };
    }
  }
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
