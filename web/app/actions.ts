"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { clearSession, getCurrentUser, setSession } from "@/lib/auth";
import {
  DomainError,
  PLATFORM_PCT,
  parseCancellationReason,
  validateCampaignSplit,
} from "@/lib/domain/logic";
import { cancelRedemption, redeemCode } from "@/lib/domain/service";
import { getReadyStore, isDemoMode } from "@/lib/store";
import { authErrorMessage, getAuthClient, isAuthConfigured } from "@/lib/supabase-auth";
import type { CampaignScope, CampaignStatus, Role } from "@/lib/domain/types";

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

/**
 * An action that declines to act, on the record.
 *
 * These guards all protect ownership, so they must not tell the caller which
 * condition failed. But returning in silence meant a click that did nothing,
 * no error anywhere, and no way to tell a refused action from one that ran —
 * precisely the state that made the paused-campaign report undiagnosable. The
 * reason goes to the server log, where we can read it and a visitor cannot.
 */
function refuse(action: string, detail: Record<string, unknown>): void {
  console.warn(`[BOOST] ${action} refused`, detail);
}

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

/**
 * The business edits its own directory card. Ownership is enforced here, not
 * assumed from the form: the id comes from the session, never the request.
 */
export async function updateBusinessProfile(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user || user.role !== "business") redirect("/login");
  const store = await getReadyStore();
  const business = await store.getBusinessByOwner(user.id);
  if (!business) return { error: "לא נמצא עסק למשתמש הזה" };

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const storeUrl = String(formData.get("storeUrl") ?? "").trim();
  const logoUrl = String(formData.get("logoUrl") ?? "").trim();

  if (!name) return { error: "לעסק צריך שם" };
  if (description.length > 300) return { error: "התיאור ארוך מדי — עד 300 תווים" };
  // These two end up in a redirect target and an <img src>, so anything that
  // is not a plain http(s) URL is refused rather than stored and rendered.
  if (storeUrl && !isHttpUrl(storeUrl)) return { error: "כתובת החנות צריכה להתחיל ב-https" };
  if (logoUrl && !isHttpUrl(logoUrl)) return { error: "כתובת הלוגו צריכה להתחיל ב-https" };

  await store.updateBusinessProfile(business.id, {
    name,
    storeUrl: storeUrl || undefined,
    description: description || undefined,
    logoUrl: logoUrl || undefined,
  });
  revalidatePath("/dashboard");
  revalidatePath("/businesses");
  return { ok: true, notice: "הפרופיל עודכן" };
}

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
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
  const scope: CampaignScope = formData.get("scope") === "product" ? "product" : "store";
  const productName = String(formData.get("productName") ?? "").trim();
  const productUrl = String(formData.get("productUrl") ?? "").trim();
  if (scope === "product" && !productName) {
    return { error: "קמפיין למוצר ספציפי צריך את שם המוצר — זה מה שהמשפיען יגיד לקהל שלו" };
  }
  if (productUrl && !isHttpUrl(productUrl)) return { error: "קישור המוצר צריך להתחיל ב-https" };
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
    scope,
    productName: scope === "product" ? productName : undefined,
    productUrl: scope === "product" && productUrl ? productUrl : undefined,
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
  if (!campaign || campaign.status !== "active") {
    return refuse("joinCampaign", { campaignId, found: Boolean(campaign), status: campaign?.status });
  }
  await store.createCode({ campaignId, influencerId: user.id, status: "active" });
  revalidatePath("/campaigns");
  revalidatePath("/dashboard");
}

/**
 * Move a campaign between active, paused and closed.
 *
 * Closing is one-way: a closed campaign cannot be reopened here, because the
 * influencers who held its codes were told it had ended. Reopening would
 * silently make their codes live again without anyone telling them.
 */
export async function setCampaignState(campaignId: string, next: CampaignStatus): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.role !== "business") redirect("/login");
  const store = await getReadyStore();
  const business = await store.getBusinessByOwner(user.id);
  const campaign = await store.getCampaign(campaignId);
  if (!business || !campaign || campaign.businessId !== business.id) {
    return refuse("setCampaignState", { campaignId, userId: user.id, next });
  }
  if (campaign.status === "closed") {
    return refuse("setCampaignState", { campaignId, reason: "already closed" });
  }
  await store.setCampaignStatus(campaignId, next);
  const after = await store.getCampaign(campaignId);
  if (after?.status !== next) {
    console.error("[BOOST] setCampaignState wrote nothing", { campaignId, wanted: next, got: after?.status ?? null });
  }
  revalidatePath("/dashboard");
  revalidatePath("/campaigns");
}

/**
 * An influencer follows a business to hear about its next campaign. The
 * relationship is with the business; every deal is still per campaign, so a
 * follower is shown each new campaign's percentages and opts in — nothing
 * moves them onto new terms silently.
 */
export async function toggleFollow(businessId: string, formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "influencer") return refuse("toggleFollow", { role: user.role });
  const store = await getReadyStore();
  const business = await store.getBusiness(businessId);
  if (!business) return refuse("toggleFollow", { businessId });
  if (formData.get("intent") === "unfollow") await store.unfollowBusiness(user.id, businessId);
  else await store.followBusiness(user.id, businessId);
  revalidatePath("/businesses");
  revalidatePath("/dashboard");
}

/**
 * Operator only: paid placement in the directory. Billing is manual until a
 * payment provider exists, so this is the whole mechanism — a date.
 */
export async function setFeatured(businessId: string, formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return refuse("setFeatured", { userId: user?.id ?? null });
  const store = await getReadyStore();
  const days = Number(formData.get("days"));
  const until =
    Number.isFinite(days) && days > 0
      ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
      : null;
  await store.setBusinessFeaturedUntil(businessId, until);
  revalidatePath("/businesses");
  revalidatePath("/admin");
}

/** The business voids a commission after a return. Ownership is enforced. */
export async function cancelSale(redemptionId: string, formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.role !== "business") redirect("/login");
  const store = await getReadyStore();
  const business = await store.getBusinessByOwner(user.id);
  if (!business) return refuse("cancelSale", { userId: user.id, redemptionId });
  const reason = parseCancellationReason(formData.get("reason"));
  try {
    await cancelRedemption(store, { businessId: business.id, redemptionId, reason });
  } catch (e) {
    // A sale that is missing, already paid, or not this business's stays as it is
    if (!(e instanceof DomainError)) throw e;
    refuse("cancelSale", { redemptionId, code: e.code });
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
