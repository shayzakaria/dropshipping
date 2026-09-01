import Link from "next/link";
import { Badge, Card, btnPrimary } from "@/components/ui";
import { CopyButton } from "@/components/CopyButton";
import { getCurrentUser } from "@/lib/auth";
import { tierForMonthlySales } from "@/lib/domain/logic";
import { getReadyStore } from "@/lib/store";
import { joinCampaign } from "../actions";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const store = await getReadyStore();
  const user = await getCurrentUser();
  const campaigns = await store.listActiveCampaigns();

  const monthlySales = user
    ? await store.countInfluencerRedemptionsInMonth(user.id, new Date())
    : 0;
  const tier = tierForMonthlySales(monthlySales);

  return (
    <div>
      <h1 className="text-2xl font-extrabold">קמפיינים פתוחים</h1>
      <p className="mt-1 text-sm text-slate-400">
        {user?.role === "influencer"
          ? `המדרגה שלך: ${tier.label}${tier.bonusPct ? ` (+${tier.bonusPct}% בונוס עמלה)` : ""} — הצטרפו לקמפיין וקבלו קוד אישי.`
          : "כך נראה ההיצע שמשפיענים רואים. הצטרפות לקמפיין דורשת חשבון משפיען."}
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {campaigns.length === 0 && <p className="text-sm text-slate-400">אין כרגע קמפיינים פעילים.</p>}
        {await Promise.all(
          campaigns.map(async (c) => {
            const business = await store.getBusiness(c.businessId);
            const myCode = user ? await store.getCodeForInfluencerCampaign(user.id, c.id) : null;
            const joined = (await store.listCodesByCampaign(c.id)).length;
            return (
              <Card key={c.id}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold">{c.title}</h3>
                    <p className="text-xs text-slate-400">{business?.name}</p>
                  </div>
                  <Badge>{joined} משפיענים</Badge>
                </div>
                {c.description ? (
                  <p className="mt-2 text-sm font-light text-slate-300">{c.description}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <Badge tone="success">הקונה חוסך {c.buyerDiscountPct}%</Badge>
                  <Badge tone="success">
                    עמלה {c.influencerPct}%{user?.role === "influencer" && tier.bonusPct ? ` +${tier.bonusPct}% בונוס` : ""}
                  </Badge>
                  {c.newCustomersOnly ? <Badge>לקוחות חדשים בלבד</Badge> : null}
                </div>
                <div className="mt-4">
                  {myCode ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">הקוד שלך:</span>
                      <code className="font-extrabold tracking-widest text-emerald-300" dir="ltr">
                        {myCode.code}
                      </code>
                      <CopyButton text={myCode.code} />
                    </div>
                  ) : user?.role === "influencer" ? (
                    <form action={joinCampaign.bind(null, c.id)}>
                      <button className={btnPrimary}>הצטרפות — קבלו קוד אישי</button>
                    </form>
                  ) : (
                    <Link href="/login" className="text-sm text-emerald-300 underline">
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
