"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { clearSession, getCurrentUser, setSession } from "@/lib/auth";
import {
  DomainError,
  PLATFORM_PCT,
  PoolEmptyError,
  commissionState,
  parseCancellationReason,
  validateCampaignSplit,
} from "@/lib/domain/logic";
import { cancelRedemption, redeemCode } from "@/lib/domain/service";
import { walletStats } from "@/lib/domain/stats";
import { parseCodeListClient } from "@/lib/domain/codes";
import { getReadyStore, isDemoMode } from "@/lib/store";
import { authErrorMessage, getAuthClient, isAuthConfigured } from "@/lib/supabase-auth";
import type { CampaignScope, CampaignStatus, CodeSource, Role } from "@/lib/domain/types";
import type { DataStore } from "@/lib/store/store";
import { MAX_LOGO_BYTES, sniffLogo } from "@/lib/domain/images";

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
  const logoFile = formData.get("logoFile");

  if (!name) return { error: "לעסק צריך שם" };
  if (description.length > 300) return { error: "התיאור ארוך מדי — עד 300 תווים" };
  // These two end up in a redirect target and an <img src>, so anything that
  // is not a plain http(s) URL is refused rather than stored and rendered.
  if (storeUrl && !isHttpUrl(storeUrl)) return { error: "כתובת החנות צריכה להתחיל ב-https" };
  if (logoUrl && !isHttpUrl(logoUrl)) return { error: "כתובת הלוגו צריכה להתחיל ב-https" };

  // The link field is the state of the logo: emptying it removes the logo.
  // A picked file wins over it, being the more deliberate of the two actions.
  let nextLogo: string | undefined = logoUrl || undefined;
  if (logoFile instanceof File && logoFile.size > 0) {
    const uploaded = await storeLogo(store, business.id, logoFile);
    if (uploaded.error) return { error: uploaded.error };
    nextLogo = uploaded.url;
  }

  await store.updateBusinessProfile(business.id, {
    name,
    storeUrl: storeUrl || undefined,
    description: description || undefined,
    logoUrl: nextLogo || undefined,
  });
  revalidatePath("/dashboard");
  revalidatePath("/businesses");
  return { ok: true, notice: "הפרופיל עודכן" };
}

/**
 * Reads an uploaded logo, checks it really is one, and stores it.
 *
 * Size is checked before the bytes are read into memory, and the format is
 * decided by the bytes rather than by the content type the browser declared —
 * the file becomes a public URL rendered in an <img>, so "the uploader said
 * it was a PNG" is not good enough.
 */
async function storeLogo(
  store: DataStore,
  businessId: string,
  file: File,
): Promise<{ url?: string; error?: string }> {
  if (file.size > MAX_LOGO_BYTES) {
    return { error: "הקובץ גדול מדי — עד 2MB" };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffLogo(bytes);
  if (!kind) {
    return { error: "אפשר להעלות רק תמונת PNG, JPG או WebP" };
  }
  try {
    return { url: await store.uploadLogo(businessId, { bytes, ...kind }) };
  } catch (e) {
    console.error("[BOOST] logo upload failed", e);
    return { error: "העלאת הלוגו נכשלה. אפשר לנסות שוב או להדביק קישור לתמונה." };
  }
}

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/** Where Supabase should send someone back to after an email link or Google. */
async function siteOrigin(): Promise<string> {
  const h = await headers();
  const explicit = process.env.SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Send a password reset link.
 *
 * Always answers the same way, whether or not the address is registered.
 * A form that says "no such user" is a free membership check for anyone who
 * wants to know which of their contacts is on the platform.
 */
export async function requestPasswordReset(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const sent = {
    notice:
      "אם הכתובת רשומה אצלנו, שלחנו אליה קישור לבחירת סיסמה חדשה. הקישור תקף לשעה.",
  };
  if (!email.includes("@")) return { error: "צריך כתובת אימייל תקינה" };
  if (!isAuthConfigured()) return { error: "איפוס סיסמה עוד לא זמין" };

  const supabase = await getAuthClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await siteOrigin()}/auth/callback?next=/reset/new`,
  });
  // Rate limiting is worth surfacing — it is about us, not about them.
  if (error && /rate limit|too many/i.test(error.message)) {
    return { error: authErrorMessage(error.message) };
  }
  if (error) console.error("[BOOST] reset email failed", error.message);
  return sent;
}

/** Set a new password. Only reachable while holding a recovery session. */
export async function setNewPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `הסיסמה צריכה להיות באורך ${MIN_PASSWORD_LENGTH} תווים לפחות` };
  }
  if (password !== confirm) return { error: "שתי הסיסמאות לא זהות" };
  if (!isAuthConfigured()) return { error: "איפוס סיסמה עוד לא זמין" };

  const supabase = await getAuthClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return { error: "הקישור פג או כבר נוצל. אפשר לבקש קישור חדש." };
  }
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: authErrorMessage(error.message) };
  redirect("/dashboard");
}

/** Start the Google flow. Supabase handles the round trip. */
export async function signInWithGoogle(): Promise<void> {
  if (!isAuthConfigured()) redirect("/login?error=auth");
  const supabase = await getAuthClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await siteOrigin()}/auth/callback` },
  });
  if (error || !data.url) {
    console.error("[BOOST] google sign-in unavailable", error?.message);
    redirect("/login?error=google");
  }
  redirect(data.url);
}

/**
 * Finish a Google sign-up.
 *
 * Google tells us who someone is, not what they came to do. An account with
 * no role would land on a dashboard that cannot decide what to render, so the
 * profile is created here, once, after they choose.
 */
export async function completeOAuthProfile(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isAuthConfigured()) return { error: "לא זמין" };
  const supabase = await getAuthClient();
  const { data } = await supabase.auth.getUser();
  const authUser = data.user;
  if (!authUser?.email) return { error: "צריך להתחבר מחדש" };

  const store = await getReadyStore();
  if (await store.getUserByAuthId(authUser.id)) redirect("/dashboard");

  const role = String(formData.get("role") ?? "") as Role;
  const businessName = String(formData.get("businessName") ?? "").trim();
  const name =
    String(formData.get("name") ?? "").trim() ||
    (authUser.user_metadata?.full_name as string | undefined) ||
    authUser.email.split("@")[0];
  if (role !== "business" && role !== "influencer") return { error: "בחרו תפקיד: עסק או משפיען" };
  if (role === "business" && !businessName) return { error: "לעסק צריך שם עסק" };

  const email = authUser.email.toLowerCase();
  const existing = await store.getUserByEmail(email);
  if (existing) {
    // Someone signed up with a password and is now arriving through Google on
    // the same address. Same person, same account — link, do not duplicate.
    await store.linkAuthUser(existing.id, authUser.id);
    redirect("/dashboard");
  }

  const user = await store.createUser({ name, email, role, authUserId: authUser.id });
  if (role === "business") {
    await store.createBusiness({ ownerId: user.id, name: businessName });
  }
  redirect("/dashboard");
}

/**
 * Where to send the money.
 *
 * Asked for at the moment it is needed and not a second before: signing up
 * stays a name and an email, because a bank account is irrelevant until there
 * is something to put in it, and asking up front is how you lose people at
 * the door.
 */
export async function savePayoutDetails(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "influencer") return { error: "פרטי תשלום רלוונטיים למשפיענים" };

  const legalName = String(formData.get("legalName") ?? "").trim();
  const nationalId = String(formData.get("nationalId") ?? "").replace(/\D/g, "");
  const bankName = String(formData.get("bankName") ?? "").trim();
  const branch = String(formData.get("branch") ?? "").replace(/\D/g, "");
  const accountNumber = String(formData.get("accountNumber") ?? "").replace(/\D/g, "");
  const taxStatus = String(formData.get("taxStatus") ?? "");

  if (!legalName) return { error: "צריך שם מלא כפי שהוא מופיע בבנק" };
  if (nationalId.length < 8 || nationalId.length > 9) {
    return { error: "מספר תעודת זהות צריך להיות 9 ספרות" };
  }
  if (!bankName) return { error: "צריך לבחור בנק" };
  if (!branch) return { error: "צריך מספר סניף" };
  if (!accountNumber) return { error: "צריך מספר חשבון" };
  if (taxStatus !== "exempt" && taxStatus !== "licensed" && taxStatus !== "none") {
    return { error: "צריך לבחור מעמד לצורכי מס" };
  }

  const store = await getReadyStore();
  await store.savePayoutDetails({
    influencerId: user.id,
    legalName,
    nationalId,
    bankName,
    branch,
    accountNumber,
    taxStatus,
  });
  revalidatePath("/dashboard");
  return { ok: true, notice: "פרטי התשלום נשמרו. אפשר לבקש משיכה." };
}

/**
 * Ask for the available balance.
 *
 * The amount is frozen at the moment of asking. A sale that lands tomorrow,
 * or a return that voids one, must not silently change a figure both sides
 * already agreed on.
 */
export async function requestPayout(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "influencer") return refuse("requestPayout", { role: user.role });

  const store = await getReadyStore();
  const [details, redemptions, open] = await Promise.all([
    store.getPayoutDetails(user.id),
    store.listRedemptionsByInfluencer(user.id),
    store.listPayoutRequests(user.id),
  ]);
  if (!details) return refuse("requestPayout", { reason: "no payout details" });
  // One open request at a time, or the same balance gets claimed twice.
  if (open.some((r) => r.status === "requested")) {
    return refuse("requestPayout", { reason: "already pending" });
  }

  const wallet = walletStats(redemptions, new Date());
  if (!wallet.canWithdraw) return refuse("requestPayout", { available: wallet.available });

  await store.createPayoutRequest(user.id, wallet.available);
  revalidatePath("/dashboard");
}

/** Operator marks a transfer done, or declines it with a reason. */
export async function settlePayout(requestId: string, formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const store = await getReadyStore();
  const status = formData.get("status") === "paid" ? "paid" : "rejected";
  const note = String(formData.get("note") ?? "").trim() || undefined;
  await store.recordAdminAction({
    actorId: admin.id,
    action: status === "paid" ? "mark_payout_paid" : "reject_payout",
    subjectKind: "user",
    subjectId: requestId,
    detail: { note: note ?? null },
  });
  await store.setPayoutRequestStatus(requestId, status, note);

  // Paying out has to consume the commissions it covered. Without this the
  // same released money stays "available" after the transfer and can be
  // requested again — the influencer is paid twice and nothing in the data
  // says otherwise. Oldest first, because those are the ones the frozen
  // amount was computed from; anything released since the request stays
  // available, which is correct.
  if (status === "paid") {
    const req = (await store.listAllPayoutRequests()).find((r) => r.id === requestId);
    if (req) await consumeCommissions(store, req.influencerId, req.amount);
  }

  revalidatePath("/admin/payouts");
  revalidatePath("/dashboard");
}

/** Flips released commissions to `paid`, oldest first, until `amount` is covered. */
async function consumeCommissions(
  store: DataStore,
  influencerId: string,
  amount: number,
): Promise<void> {
  const released = (await store.listRedemptionsByInfluencer(influencerId))
    .filter((r) => commissionState(r) === "available")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  let left = amount;
  for (const r of released) {
    // Half a commission cannot be paid, so stop before overshooting rather
    // than marking a sale paid that the transfer did not actually cover.
    if (r.influencerCommission > left + 0.001) break;
    await store.setRedemptionStatus(r.id, "paid");
    left -= r.influencerCommission;
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

  const codeSource: CodeSource = formData.get("codeSource") === "generated" ? "generated" : "pool";
  const pastedCodes = parseCodeListClient(String(formData.get("poolCodes") ?? ""));
  if (codeSource === "pool" && pastedCodes.length === 0) {
    return {
      error:
        "צריך להדביק לפחות קוד אחד שיצרת בחנות שלך. בלי זה הקוד שהמשפיען יפרסם לא יעבוד בקופה.",
    };
  }

  const campaign = await store.createCampaign({
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
    codeSource,
  });
  if (pastedCodes.length) await store.addPoolCodes(campaign.id, pastedCodes);
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

/** Adds more codes to a campaign that is running low. */
export async function addPoolCodes(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user || user.role !== "business") redirect("/login");
  const store = await getReadyStore();
  const business = await store.getBusinessByOwner(user.id);
  const campaignId = String(formData.get("campaignId") ?? "");
  const campaign = await store.getCampaign(campaignId);
  if (!business || !campaign || campaign.businessId !== business.id) {
    refuse("addPoolCodes", { campaignId });
    return { error: "לא נמצא קמפיין" };
  }

  const codes = parseCodeListClient(String(formData.get("poolCodes") ?? ""));
  if (!codes.length) return { error: "לא זוהו קודים בטקסט שהודבק" };
  const added = await store.addPoolCodes(campaignId, codes);
  revalidatePath("/dashboard");
  return {
    ok: true,
    notice:
      added === codes.length
        ? `נוספו ${added} קודים.`
        : `נוספו ${added} קודים. ${codes.length - added} כבר היו במאגר ולא נוספו שוב.`,
  };
}

/**
 * The business confirms a code actually worked at its own checkout.
 *
 * Until this happens the campaign is not offered to influencers. Publishing an
 * untested code costs the influencer their credibility in front of their own
 * audience, which is not ours to spend.
 */
export async function setCampaignVerified(campaignId: string, formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.role !== "business") redirect("/login");
  const store = await getReadyStore();
  const business = await store.getBusinessByOwner(user.id);
  const campaign = await store.getCampaign(campaignId);
  if (!business || !campaign || campaign.businessId !== business.id) {
    return refuse("setCampaignVerified", { campaignId });
  }
  const verified = formData.get("verified") === "yes";
  await store.setCampaignVerified(campaignId, verified ? new Date().toISOString() : null);
  revalidatePath("/dashboard");
  revalidatePath("/campaigns");
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
  // A campaign whose codes were never tried at a real checkout is not offered
  // and not joinable, however someone arrived at this action.
  if (!campaign.verifiedAt) {
    return refuse("joinCampaign", { campaignId, reason: "unverified" });
  }

  try {
    await store.createCode({ campaignId, influencerId: user.id, status: "active" });
  } catch (e) {
    // The pool ran dry between the page rendering and the click. There is
    // nothing to hand out, and inventing a code would hand over one that
    // fails at checkout, so the join simply does not happen.
    if (e instanceof PoolEmptyError) {
      return refuse("joinCampaign", { campaignId, reason: "pool_empty" });
    }
    throw e;
  }
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

/**
 * Operator support actions.
 *
 * Every one of these touches someone else's account, so each writes to the
 * audit log *before* it acts. If the action then fails we have logged an
 * attempt that did not happen, which is recoverable; logging afterwards
 * would mean a failure between the two leaves a change nobody can trace,
 * which is not.
 *
 * There is deliberately no "sign in as this user". It is the tool support
 * teams always want, and it turns the log into a lie: every action would be
 * recorded as the user's own, money could move under their name, and nothing
 * afterwards could tell the difference.
 */
async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) redirect("/dashboard");
  return user;
}

/** Lock an account, or unlock it. An empty reason unlocks. */
export async function adminSetSuspended(userId: string, formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const store = await getReadyStore();
  const reason = String(formData.get("reason") ?? "").trim();
  const target = await store.getUser(userId);
  if (!target) return refuse("adminSetSuspended", { userId });
  // An operator locking themselves out would need database access to undo.
  if (target.id === admin.id) return refuse("adminSetSuspended", { reason: "self" });

  await store.recordAdminAction({
    actorId: admin.id,
    action: reason ? "suspend_user" : "unsuspend_user",
    subjectKind: "user",
    subjectId: userId,
    detail: { email: target.email, reason: reason || null },
  });
  await store.setUserSuspended(userId, reason || null);
  revalidatePath("/admin");
}

/** Disable a coupon code, or put it back. Used when a code is being abused. */
export async function adminSetCodeStatus(codeId: string, formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const store = await getReadyStore();
  const status = formData.get("status") === "active" ? "active" : "disabled";
  await store.recordAdminAction({
    actorId: admin.id,
    action: status === "active" ? "enable_code" : "disable_code",
    subjectKind: "code",
    subjectId: codeId,
  });
  await store.setCodeStatus(codeId, status);
  revalidatePath("/admin");
}

/**
 * Fix a business profile for an owner who cannot. The operator changes what
 * the business could have changed itself — nothing about money.
 */
export async function adminUpdateBusiness(businessId: string, formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const store = await getReadyStore();
  const business = await store.getBusiness(businessId);
  if (!business) return refuse("adminUpdateBusiness", { businessId });

  const name = String(formData.get("name") ?? "").trim() || business.name;
  const description = String(formData.get("description") ?? "").trim();
  const storeUrl = String(formData.get("storeUrl") ?? "").trim();
  const logoUrl = String(formData.get("logoUrl") ?? "").trim();
  if (storeUrl && !isHttpUrl(storeUrl)) return refuse("adminUpdateBusiness", { field: "storeUrl" });
  if (logoUrl && !isHttpUrl(logoUrl)) return refuse("adminUpdateBusiness", { field: "logoUrl" });

  await store.recordAdminAction({
    actorId: admin.id,
    action: "edit_business_profile",
    subjectKind: "business",
    subjectId: businessId,
    detail: { before: { name: business.name, description: business.description ?? null } },
  });
  await store.updateBusinessProfile(businessId, {
    name,
    description: description || undefined,
    storeUrl: storeUrl || undefined,
    logoUrl: logoUrl || undefined,
  });
  revalidatePath("/admin");
  revalidatePath("/businesses");
}

/**
 * Void a commission on behalf of a business that cannot reach its own
 * dashboard. Same domain rule as the business's own button — an operator
 * gets no extra power over money, only a way to press it for someone.
 */
export async function adminCancelRedemption(redemptionId: string, formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const store = await getReadyStore();
  const redemption = await store.getRedemption(redemptionId);
  if (!redemption) return refuse("adminCancelRedemption", { redemptionId });
  const reason = parseCancellationReason(formData.get("reason"));

  await store.recordAdminAction({
    actorId: admin.id,
    action: "cancel_redemption",
    subjectKind: "redemption",
    subjectId: redemptionId,
    detail: { reason, amount: redemption.influencerCommission, influencerId: redemption.influencerId },
  });
  try {
    await cancelRedemption(store, { businessId: redemption.businessId, redemptionId, reason });
  } catch (e) {
    if (!(e instanceof DomainError)) throw e;
    refuse("adminCancelRedemption", { redemptionId, code: e.code });
  }
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

/** Change a campaign's state for a business that asked us to. */
export async function adminSetCampaignState(campaignId: string, formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const store = await getReadyStore();
  const campaign = await store.getCampaign(campaignId);
  if (!campaign || campaign.status === "closed") {
    return refuse("adminSetCampaignState", { campaignId, status: campaign?.status });
  }
  const raw = String(formData.get("status") ?? "");
  const next: CampaignStatus = raw === "paused" ? "paused" : raw === "closed" ? "closed" : "active";
  await store.recordAdminAction({
    actorId: admin.id,
    action: "set_campaign_state",
    subjectKind: "campaign",
    subjectId: campaignId,
    detail: { from: campaign.status, to: next },
  });
  await store.setCampaignStatus(campaignId, next);
  revalidatePath("/admin");
  revalidatePath("/campaigns");
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

/**
 * A sale reported by hand, for a shop with no automated checkout.
 *
 * The honest alternative to the API for businesses that close orders over
 * WhatsApp or in person: without it, those businesses cannot use the platform
 * at all until someone writes code inside their store.
 *
 * The commission it creates is real money owed to an influencer, so it is
 * treated as a real redemption in every respect — same guards, same hold
 * window, same cancellation path — and marked `manual` so the source is never
 * in doubt when the numbers are audited.
 */
export async function reportManualSale(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user || user.role !== "business") redirect("/login");
  const store = await getReadyStore();
  const business = await store.getBusinessByOwner(user.id);
  if (!business) return { error: "לא נמצא עסק למשתמש הזה" };

  const code = String(formData.get("code") ?? "").trim();
  const orderAmount = Number(formData.get("orderAmount"));
  const customerRef = String(formData.get("customerRef") ?? "").trim();
  const externalOrderId = String(formData.get("externalOrderId") ?? "").trim();
  if (!code) return { error: "צריך את הקוד שהקונה מסר" };

  try {
    const r = await redeemCode(store, {
      code,
      orderAmount,
      source: "manual",
      actingBusinessId: business.id,
      customerRef: customerRef || undefined,
      externalOrderId: externalOrderId || undefined,
    });
    revalidatePath("/dashboard");
    return {
      ok: true,
      notice: `נרשמה מכירה על ${r.orderAmount} ₪. עמלת המשפיען: ${r.influencerCommission} ₪, דמי פלטפורמה: ${r.platformFee} ₪.`,
    };
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message };
    console.error("[BOOST] manual sale failed", e);
    return { error: "רישום המכירה נכשל. אפשר לנסות שוב." };
  }
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
  // redeemCode enforces the ownership itself; this only decides who is acting.
  let actingBusinessId: string | undefined;
  if (isDemoMode()) {
    // In the demo world anyone may play, acting as whoever owns the code.
    const found = await store.getCodeByCode(code);
    const campaign = found ? await store.getCampaign(found.campaignId) : null;
    actingBusinessId = campaign?.businessId;
  } else {
    const user = await getCurrentUser();
    if (!user || user.role !== "business") {
      return { error: "הסימולטור פתוח רק לבעלי עסק מחוברים" };
    }
    actingBusinessId = (await store.getBusinessByOwner(user.id))?.id;
  }
  try {
    const r = await redeemCode(store, {
      code,
      orderAmount,
      source: "simulator",
      actingBusinessId,
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
