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
