import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * The Supabase Auth client, on the publishable key. Sessions live in cookies
 * managed by @supabase/ssr, so a signed-in visitor is identified by a token
 * Supabase issued and can verify — not by an id we chose to trust.
 *
 * The data store keeps using the secret key separately; this client only ever
 * handles identity.
 */
const AUTH_URL = process.env.SUPABASE_URL || undefined;
const AUTH_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || undefined;

export function isAuthConfigured(): boolean {
  return Boolean(AUTH_URL && AUTH_KEY);
}

/**
 * Whether to offer Google — asked of Supabase, not of an environment variable.
 *
 * The provider is turned on in the Supabase dashboard, and Supabase already
 * publishes which providers are live on its own settings endpoint. Reading it
 * means the button appears the moment the provider is enabled and disappears
 * the moment it is turned off, with nothing to remember to set somewhere else.
 * A flag would have been one more thing that can disagree with reality.
 *
 * GOOGLE_AUTH_ENABLED still forces it on, for the case where the settings
 * endpoint cannot be reached but the provider is known to be configured.
 */
let googleCache: { at: number; on: boolean } | undefined;
const SETTINGS_TTL_MS = 60_000;

export async function isGoogleAuthEnabled(): Promise<boolean> {
  if (!isAuthConfigured()) return false;
  if (process.env.GOOGLE_AUTH_ENABLED === "true") return true;

  const now = Date.now();
  if (googleCache && now - googleCache.at < SETTINGS_TTL_MS) return googleCache.on;

  try {
    const res = await fetch(`${AUTH_URL}/auth/v1/settings`, {
      headers: { apikey: AUTH_KEY! },
      // Cached for a minute in-process; flipping the provider shows up within it.
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) throw new Error(`settings ${res.status}`);
    const body = (await res.json()) as { external?: Record<string, boolean> };
    const on = body.external?.google === true;
    googleCache = { at: now, on };
    return on;
  } catch (e) {
    // A login page that renders is worth more than an accurate button, so a
    // failure here hides Google rather than breaking the page.
    console.warn("[BOOST] could not read auth settings", e instanceof Error ? e.message : e);
    googleCache = { at: now, on: false };
    return false;
  }
}

export async function getAuthClient() {
  if (!AUTH_URL || !AUTH_KEY) {
    throw new Error("Supabase Auth is not configured");
  }
  const jar = await cookies();
  return createServerClient(AUTH_URL, AUTH_KEY, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) jar.set(name, value, options);
        } catch {
          // Server Components cannot write cookies. Refresh happens in the
          // server actions and the middleware, so ignoring this is safe.
        }
      },
    },
  });
}

/** Supabase's own error text is English and terse; users get ours instead. */
export function authErrorMessage(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "אימייל או סיסמה שגויים";
  if (m.includes("already registered") || m.includes("already been registered")) {
    return "האימייל הזה כבר רשום — אפשר להתחבר";
  }
  if (m.includes("password") && m.includes("least")) return "הסיסמה קצרה מדי";
  if (m.includes("rate limit") || m.includes("too many")) {
    return "יותר מדי ניסיונות. נסו שוב בעוד כמה דקות";
  }
  if (m.includes("email not confirmed")) return "צריך לאשר את המייל שנשלח אליכם לפני הכניסה";
  return "משהו השתבש בכניסה. נסו שוב";
}
