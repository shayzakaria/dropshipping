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
  /*
   * Only the routes that actually read a session.
   *
   * This ran on every request, and each run is a network call to Supabase Auth
   * to refresh the token — from Vercel to Ireland and back. The landing page,
   * the legal pages and the simulator do not care who you are, so they were
   * paying an auth round trip for nothing on every navigation. The redeem and
   * refund APIs authenticate with a business key, not a session, and are out
   * for the same reason.
   */
  matcher: ["/dashboard/:path*", "/campaigns/:path*", "/login"],
};
