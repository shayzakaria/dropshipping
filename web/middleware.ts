import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase session cookie on every navigation. Without this the
 * access token expires and a signed-in user is silently logged out; the server
 * components that read the session cannot write cookies themselves.
 */
/** Routes that read a session and therefore need the token refreshed. */
const SESSION_ROUTES = [/^\/dashboard(\/|$)/, /^\/campaigns(\/|$)/, /^\/login$/, /^\/admin(\/|$)/];

export async function middleware(request: NextRequest) {
  // The pathname is passed down as a header because a server layout has no
  // other way to learn it, and the layout counts page views with it.
  const pathname = request.nextUrl.pathname;
  request.headers.set("x-pathname", pathname);
  let response = NextResponse.next({ request });

  // The auth refresh is a network round trip to Supabase; only pay it where a
  // session is actually read.
  if (!SESSION_ROUTES.some((re) => re.test(pathname))) return response;

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
  matcher: [
    // Every page (for the pathname header); not assets, not the key-authenticated APIs
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
