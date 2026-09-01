import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase session cookie on every navigation. Without this the
 * access token expires and a signed-in user is silently logged out; the server
 * components that read the session cannot write cookies themselves.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Touching getUser() is what performs the refresh
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: [
    // Everything except static assets and the redeem/refund APIs, which are
    // authenticated by a business's key rather than by a user session.
    "/((?!_next/static|_next/image|favicon.ico|api/redeem|api/refund|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
