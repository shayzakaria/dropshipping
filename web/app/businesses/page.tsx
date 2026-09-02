import Link from "next/link";
import type { Metadata } from "next";
import { Badge, Card } from "@/components/ui";
import { BusinessLogo } from "@/components/BusinessLogo";
import { FollowButton } from "@/components/FollowButton";
import { getCurrentUser } from "@/lib/auth";
import { getReadyStore, isDemoMode } from "@/lib/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "העסקים שאיתנו | BOOST",
  description: "העסקים שעובדים עם משפיענים דרך הפלטפורמה — מי הם, מה הם מוכרים, ואיפה קונים.",
};

/**
 * The shop window.
 *
 * Deliberately no coupon codes here. A directory that lists discounts is a
 * coupon site, and a coupon site removes every reason to follow an influencer
 * — which is the one thing this platform sells. So a card says who the
 * business is and sends you either to their shop or to the influencers
 * carrying their codes. The discount arrives through a person, always.
 */
export default async function BusinessesPage() {
  const store = await getReadyStore();
  const demoMode = isDemoMode();
  const user = await getCurrentUser();
  const listed = await store.listDirectoryBusinesses();

  // Paid placement first, then newest. A time rather than a flag, so a slot
  // that was bought for thirty days quietly stops being first on day thirty-one.
  const nowIso = new Date().toISOString();
  const isFeatured = (b: (typeof listed)[number]) => Boolean(b.featuredUntil && b.featuredUntil > nowIso);
  const businesses = [...listed].sort((a, b) => Number(isFeatured(b)) - Number(isFeatured(a)));

  // One query for every campaign, one for every code: the influencer count per
  // business is a group-by in memory rather than two queries per card.
  const campaigns = await store.listActiveCampaigns();
  const codes = await store.listCodesByCampaignIds(campaigns.map((c) => c.id));
  const campaignBusiness = new Map(campaigns.map((c) => [c.id, c.businessId]));
  const promotersByBusiness = new Map<string, Set<string>>();
  for (const code of codes) {
    const businessId = campaignBusiness.get(code.campaignId);
    if (!businessId) continue;
    const set = promotersByBusiness.get(businessId) ?? new Set<string>();
    set.add(code.influencerId);
    promotersByBusiness.set(businessId, set);
  }
  const [followerCounts, myFollows] = await Promise.all([
    store.countFollowersByBusinessIds(businesses.map((b) => b.id)),
    user?.role === "influencer" ? store.listFollowsByInfluencer(user.id) : Promise.resolve([]),
  ]);
  const followingIds = new Set(myFollows.map((f) => f.businessId));
  const liveCampaigns = new Map<string, number>();
  for (const c of campaigns) {
    liveCampaigns.set(c.businessId, (liveCampaigns.get(c.businessId) ?? 0) + 1);
  }

  const real = businesses.filter((b) => !b.isDemo);
  const allExamples = businesses.length > 0 && real.length === 0 && !demoMode;

  return (
    <div>
      <h1 className="font-display text-6xl leading-none">העסקים שאיתנו</h1>
      <p className="mt-2 max-w-2xl text-sm font-light leading-relaxed text-mut">
        עסקים שעובדים עם משפיענים דרך הפלטפורמה. ההנחה לא מתפרסמת כאן — היא מגיעה
        דרך הקוד האישי של משפיען, כי זה מה שהופך את ההמלצה שלו לשווה משהו.
      </p>

      {allExamples ? (
        <p className="mt-4 rounded-lg border border-deal-deep/40 bg-mark/30 p-3 text-sm font-medium text-ink">
          עדיין אין כאן עסקים אמיתיים. מה שמוצג למטה הוא דוגמה שממחישה איך זה ייראה.
        </p>
      ) : null}

      {businesses.length === 0 ? (
        <Card className="mt-6">
          <p className="text-sm text-mut">
            עוד לא הצטרפו עסקים.{" "}
            <Link href="/login" className="font-semibold text-deal-deep underline underline-offset-2">
              רוצים להיות הראשונים?
            </Link>
          </p>
        </Card>
      ) : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {businesses.map((b) => {
          const promoters = promotersByBusiness.get(b.id)?.size ?? 0;
          const example = b.isDemo && !demoMode;
          return (
            <Card key={b.id} className={`${example ? "border-dashed" : ""} ${isFeatured(b) ? "ring-2 ring-deal ring-offset-2 ring-offset-paper" : ""}`}>
              <div className="flex items-start gap-3">
                <BusinessLogo business={b} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-lg font-bold leading-tight">{b.name}</h2>
                    <span className="flex gap-1">
                      {isFeatured(b) ? <Badge tone="warning">מומלץ</Badge> : null}
                      {example ? <Badge tone="warning">דוגמה</Badge> : null}
                    </span>
                  </div>
                  {b.description ? (
                    <p className="mt-1 text-sm font-light leading-relaxed text-mut">{b.description}</p>
                  ) : null}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                {/*
                  A count is only shown once it means something. "0 משפיענים"
                  on a business that joined this morning advertises emptiness
                  to exactly the people whose decision depends on momentum.
                */}
                {promoters > 0 ? (
                  <Badge tone="success">
                    {promoters} {promoters === 1 ? "משפיען מקדם" : "משפיענים מקדמים"}
                  </Badge>
                ) : (
                  <Badge>חדש בפלטפורמה</Badge>
                )}
                {liveCampaigns.get(b.id) ? (
                  <Badge>
                    {liveCampaigns.get(b.id)} {liveCampaigns.get(b.id) === 1 ? "קמפיין פעיל" : "קמפיינים פעילים"}
                  </Badge>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {b.storeUrl && !example ? (
                  <a
                    href={b.storeUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="inline-flex min-h-11 items-center rounded-lg border border-ink/25 bg-label px-3 text-sm font-semibold transition hover:bg-paper"
                  >
                    לחנות של {b.name.split(/[\s—–-]+/)[0]}
                  </a>
                ) : null}
                {promoters > 0 && !example ? (
                  <Link
                    href="/campaigns"
                    className="inline-flex min-h-11 items-center rounded-lg bg-deal px-3 text-sm font-bold text-ink transition hover:bg-[#ff5a17]"
                  >
                    לקבל את ההנחה ממשפיען
                  </Link>
                ) : null}
                {user?.role === "influencer" && !example ? (
                  <FollowButton
                    businessId={b.id}
                    following={followingIds.has(b.id)}
                    followers={followerCounts.get(b.id) ?? 0}
                  />
                ) : null}
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="mt-8">
        <h2 className="font-display text-3xl leading-none">עסק שרוצה להופיע כאן?</h2>
        <p className="mt-2 text-sm font-light leading-relaxed text-mut">
          ההופעה בקטלוג היא חלק מהחשבון ולא מוצר בתשלום: אנחנו מרוויחים כשאתם
          מוכרים, אז אין לנו סיבה לגבות מכם על להיראות. פותחים חשבון, כותבים שתי
          שורות על העסק, ומופיעים.
        </p>
        <Link
          href="/login"
          className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-ink px-4 text-sm font-bold text-label transition hover:bg-ink/85"
        >
          פתיחת חשבון עסק
        </Link>
      </Card>
    </div>
  );
}
