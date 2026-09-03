import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getReadyStore } from "@/lib/store";
import { notifyReleases } from "@/lib/email/events";

/**
 * Tells influencers their money became withdrawable.
 *
 * The only notification with no user action behind it: a commission is
 * released because fourteen days passed, and nothing happens in the app at
 * that moment, so something has to come looking. Runs daily from the schedule
 * in vercel.json.
 *
 * Safe to run more often than daily, or twice at once: the dedupe key is one
 * per influencer per day, claimed in the database, so extra runs mail nobody
 * a second time.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    // Vercel Cron signs its own requests with this header. Without the
    // check the route is a free way for anyone to make us send mail.
    const auth = (await headers()).get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  } else {
    console.warn("[BOOST] CRON_SECRET is not set — the releases cron is unauthenticated");
  }

  const store = await getReadyStore();
  const queued = await notifyReleases(store);
  return NextResponse.json({ ok: true, queued });
}
