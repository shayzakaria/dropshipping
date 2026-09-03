import { NextResponse } from "next/server";
import { getAuthClient, isAuthConfigured } from "@/lib/supabase-auth";
import { getReadyStore } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * Where Supabase sends people back to: after Google, and after a password
 * reset email. Both arrive as a one-time code that has to be exchanged for a
 * session here, server-side, before anything else can happen.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");
  const home = url.origin;

  if (!isAuthConfigured() || !code) {
    return NextResponse.redirect(`${home}/login?error=link`, 302);
  }

  const supabase = await getAuthClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    // Expired, already used, or opened in a different browser than it was
    // requested from — all the same to the person holding it.
    console.error("[BOOST] auth callback failed", error.message);
    return NextResponse.redirect(`${home}/login?error=link`, 302);
  }

  // A password reset says where it wants to land, and it is never the dashboard.
  if (next === "/reset/new") return NextResponse.redirect(`${home}/reset/new`, 302);

  // Google can hand us someone who has never had a profile here. They pick a
  // role first; sending them to a dashboard that cannot tell which one to
  // render would be a dead end.
  const { data } = await supabase.auth.getUser();
  if (data.user) {
    const store = await getReadyStore();
    if (!(await store.getUserByAuthId(data.user.id))) {
      return NextResponse.redirect(`${home}/auth/complete`, 302);
    }
  }
  return NextResponse.redirect(`${home}/dashboard`, 302);
}
