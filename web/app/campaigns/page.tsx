import Link from "next/link";
import { Badge, Card, btnPrimary } from "@/components/ui";
import { CopyButton } from "@/components/CopyButton";
import { getCurrentUser } from "@/lib/auth";
import { tierForMonthlySales } from "@/lib/domain/logic";
import { getReadyStore, isDemoMode } from "@/lib/store";
import { joinCampaign } from "../actions";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const store = await getReadyStore();
  const user = await getCurrentUser();
  const demoMode = isDemoMode();
  const campaigns = await store.listActiveCampaigns();

  // Everything below depends only on the campaign list, so it goes out in one
  // wave of three queries rather than two-per-campaign in sequence. On a page
  // whose database is a continent away, the number of round trips is the page.
  const campaignIds = campaigns.map((c) => c.id);
  const [businesses, codes, monthlySales] = await Promise.all([
    store.listBusinessesByIds([...new Set(campaigns.map((c) => c.businessId))]),
    store.listCodesByCampaignIds(campaignIds),
    user ? store.countInfluencerRedemptionsInMonth(user.id, new Date()) : Promise.resolve(0),
  ]);

  const businessById = new Map(businesses.map((b) => [b.id, b]));
  const codesByCampaign = new Map<string, typeof codes>();
  for (const code of codes) {
    const list = codesByCampaign.get(code.campaignId);
    if (list) list.push(code);
    else codesByCampaign.set(code.campaignId, [code]);
  }

  const tier = tierForMonthlySales(monthlySales);
  const rows = campaigns.map((c) => ({ campaign: c, business: businessById.get(c.businessId) ?? null }));
  const real = rows.filter((r) => !r.business?.isDemo);
  const allExamples = rows.length > 0 && real.length === 0;

  return (
    <div>
      <h1 className="font-display text-6xl leading-none">קמפיינים פתוחים</h1>
      <p className="mt-2 text-sm text-mut">
        {user?.role === "influencer"
          ? `המדרגה שלך: ${tier.label}${tier.bonusPct ? ` (+${tier.bonusPct}% בונוס עמלה)` : ""} — הצטרפו לקמפיין וקבלו קוד אישי.`
          : "כך נראה ההיצע שמשפיענים רואים. הצטרפות לקמפיין דורשת חשבון משפיען."}
      </p>
      {allExamples && !demoMode ? (
        <p className="mt-4 rounded-lg border border-deal-deep/40 bg-mark/30 p-3 text-sm font-medium text-deal-deep">
          עדיין אין כאן קמפיינים אמיתיים. מה שמוצג למטה הוא דוגמה שממחישה איך זה נראה — העסק,
          המשפיענים והמכירות אינם אמיתיים ואי אפשר להצטרף אליהם.
        </p>
      ) : null}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {campaigns.length === 0 && <p className="text-sm text-mut">אין כרגע קמפיינים פעילים.</p>}
        {rows.map(({ campaign: c, business }) => {
          const campaignCodes = codesByCampaign.get(c.id) ?? [];
          const myCode = user ? campaignCodes.find((k) => k.influencerId === user.id) ?? null : null;
          const joined = campaignCodes.length;
            // Outside the local demo, an example campaign is not joinable: a
            // code on a business that does not exist can never pay out, and
            // handing an influencer one would be a small con.
            const example = Boolean(business?.isDemo) && !demoMode;
            return (
              <Card key={c.id}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-bold">{c.title}</h2>
                    <p className="text-xs text-mut">{business?.name}</p>
                  </div>
                  {example ? <Badge tone="warning">דוגמה</Badge> : <Badge>{joined} משפיענים</Badge>}
                </div>
                {c.description ? (
                  <p className="mt-2 text-sm font-light text-mut">{c.description}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <Badge tone="success">הקונה חוסך {c.buyerDiscountPct}%</Badge>
                  <Badge tone="success">
                    עמלה {c.influencerPct}%{user?.role === "influencer" && tier.bonusPct ? ` +${tier.bonusPct}% בונוס` : ""}
                  </Badge>
                  {c.newCustomersOnly ? <Badge>לקוחות חדשים בלבד</Badge> : null}
                  {/* The first thing an influencer tells their audience. */}
                  {c.scope === "product" ? (
                    <Badge tone="warning">
                      {c.productUrl ? (
                        <a href={c.productUrl} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-2">
                          למוצר: {c.productName}
                        </a>
                      ) : (
                        <>למוצר: {c.productName}</>
                      )}
                    </Badge>
                  ) : (
                    <Badge>תקף על כל החנות</Badge>
                  )}
                </div>
                <div className="mt-4">
                  {example ? (
                    <p className="text-xs font-medium text-mut">
                      עסק לדוגמה — לא ניתן להצטרף.
                    </p>
                  ) : myCode ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-mut">הקוד שלך:</span>
                      <code className="font-mono font-bold tracking-widest" dir="ltr">
                        {myCode.code}
                      </code>
                      <CopyButton text={myCode.code} />
                    </div>
                  ) : user?.role === "influencer" ? (
                    <form action={joinCampaign.bind(null, c.id)}>
                      <button className={btnPrimary}>הצטרפות — קבלת קוד אישי</button>
                    </form>
                  ) : (
                    <Link
                      href="/login"
                      className="inline-flex min-h-11 items-center rounded-lg border border-ink/25 bg-label px-3 text-sm font-semibold text-deal-deep transition hover:bg-paper"
                    >
                      היכנסו כמשפיען כדי להצטרף
                    </Link>
                  )}
                </div>
              </Card>
          );
        })}
      </div>
    </div>
  );
}
