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

  // Resolve the business up front: whether a campaign is an example is a fact
  // about who is running it, and the page needs it before it renders anything.
  const rows = await Promise.all(
    campaigns.map(async (c) => ({
      campaign: c,
      business: await store.getBusiness(c.businessId),
    })),
  );
  const real = rows.filter((r) => !r.business?.isDemo);
  const allExamples = rows.length > 0 && real.length === 0;

  const monthlySales = user
    ? await store.countInfluencerRedemptionsInMonth(user.id, new Date())
    : 0;
  const tier = tierForMonthlySales(monthlySales);

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
        {await Promise.all(
          rows.map(async ({ campaign: c, business }) => {
            const myCode = user ? await store.getCodeForInfluencerCampaign(user.id, c.id) : null;
            const joined = (await store.listCodesByCampaign(c.id)).length;
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
          }),
        )}
      </div>
    </div>
  );
}
