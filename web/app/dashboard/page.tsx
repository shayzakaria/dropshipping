import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge, Card, SectionTitle, Stat, btnGhost, btnPrimary } from "@/components/ui";
import { CopyButton } from "@/components/CopyButton";
import { getCurrentUser } from "@/lib/auth";
import { nextTier, tierForMonthlySales } from "@/lib/domain/logic";
import { businessStats, influencerStats } from "@/lib/domain/stats";
import type { Campaign, CouponCode, Redemption, User } from "@/lib/domain/types";
import { formatDate, formatILS } from "@/lib/format";
import { getReadyStore } from "@/lib/store";
import type { DataStore } from "@/lib/store/store";
import { toggleCampaign } from "../actions";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const store = await getReadyStore();
  return user.role === "business" ? (
    <BusinessDashboard user={user} store={store} />
  ) : (
    <InfluencerDashboard user={user} store={store} />
  );
}

async function BusinessDashboard({ user, store }: { user: User; store: DataStore }) {
  const business = await store.getBusinessByOwner(user.id);
  if (!business) {
    return <p className="text-slate-400">לא נמצא עסק למשתמש הזה.</p>;
  }
  const campaigns = await store.listCampaignsByBusiness(business.id);
  const redemptions = await store.listRedemptionsByBusiness(business.id);
  const stats = businessStats(redemptions, new Date());
  const codesByCampaign = new Map<string, CouponCode[]>();
  for (const c of campaigns) codesByCampaign.set(c.id, await store.listCodesByCampaign(c.id));
  const influencerNames = await namesById(store, redemptions.map((r) => r.influencerId));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">{business.name}</h1>
          <p className="text-sm text-slate-400">דשבורד עסק · החודש הנוכחי</p>
        </div>
        <Link href="/campaigns/new" className={btnPrimary}>
          + קמפיין חדש
        </Link>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="מכירות דרך הפלטפורמה" value={stats.monthCount} sub={`מחזור: ${formatILS(stats.monthRevenue)}`} />
        <Stat label="הנחות שניתנו לקונים" value={formatILS(stats.monthBuyerDiscounts)} />
        <Stat label="עמלות למשפיענים" value={formatILS(stats.monthCommissions)} />
        <Stat
          label="עלות שיווק כוללת"
          value={formatILS(stats.monthTotalCost)}
          sub={`${stats.costPctOfRevenue}% מהמחזור — קבוע וידוע מראש`}
        />
      </div>

      <SectionTitle>הקמפיינים שלי</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        {campaigns.length === 0 && (
          <p className="text-sm text-slate-400">עוד אין קמפיינים — צרו את הראשון כדי שמשפיענים יוכלו להצטרף.</p>
        )}
        {campaigns.map((c) => (
          <Card key={c.id}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-bold">{c.title}</h3>
                {c.description ? <p className="mt-0.5 text-xs font-light text-slate-400">{c.description}</p> : null}
              </div>
              <Badge tone={c.status === "active" ? "success" : "warning"}>
                {c.status === "active" ? "פעיל" : "מושהה"}
              </Badge>
            </div>
            <p className="mt-3 text-sm text-slate-300">
              הנחה {c.buyerDiscountPct}% · עמלה {c.influencerPct}% · פלטפורמה {c.platformPct}%
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {c.newCustomersOnly ? "ללקוחות חדשים בלבד" : "פתוח לכל הלקוחות"}
              {c.maxRedemptionsPerMonth ? ` · תקרה ${c.maxRedemptionsPerMonth} מימושים/חודש` : ""}
              {" · "}
              {codesByCampaign.get(c.id)?.length ?? 0} משפיענים הצטרפו
            </p>
            <form action={toggleCampaign.bind(null, c.id)} className="mt-3">
              <button className={btnGhost}>{c.status === "active" ? "השהה קמפיין" : "הפעל מחדש"}</button>
            </form>
          </Card>
        ))}
      </div>

      <SectionTitle>מכירות אחרונות</SectionTitle>
      <RedemptionsTable redemptions={redemptions.slice(0, 15)} names={influencerNames} perspective="business" />

      <SectionTitle>חיבור לחנות שלך</SectionTitle>
      <Card>
        <p className="text-sm font-light leading-relaxed text-slate-300">
          החנות שלך (Shopify / Wix / WooCommerce) תקרא ל-API שלנו בקופה כדי לאמת קוד ולרשום
          מכירה. זה מה שהופך את הדיווח לאוטומטי ואמין — בלי דיווח ידני.
        </p>
        <div className="mt-3 flex items-center gap-2 text-sm">
          <span className="text-slate-400">מפתח ה-API של העסק:</span>
          <code className="rounded bg-black/40 px-2 py-1 text-xs text-emerald-300" dir="ltr">
            {business.apiSecret}
          </code>
          <CopyButton text={business.apiSecret} />
        </div>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-black/40 p-3 text-xs leading-relaxed text-slate-300" dir="ltr">
{`POST /api/redeem
{
  "code": "XXXX-XXXX",
  "order_amount": 300,
  "customer_ref": "buyer@example.com",
  "api_secret": "<המפתח שלך>"
}`}
        </pre>
        <p className="mt-2 text-xs text-slate-400">
          אפשר לנסות בלי אינטגרציה דרך <Link href="/simulate" className="text-emerald-300 underline">סימולטור הקנייה</Link>.
        </p>
      </Card>
    </div>
  );
}

async function InfluencerDashboard({ user, store }: { user: User; store: DataStore }) {
  const codes = await store.listCodesByInfluencer(user.id);
  const redemptions = await store.listRedemptionsByInfluencer(user.id);
  const stats = influencerStats(redemptions, new Date());
  const tier = tierForMonthlySales(stats.monthCount);
  const next = nextTier(stats.monthCount);

  const campaignById = new Map<string, Campaign>();
  const businessNameByCampaign = new Map<string, string>();
  for (const code of codes) {
    const campaign = await store.getCampaign(code.campaignId);
    if (campaign) {
      campaignById.set(campaign.id, campaign);
      const business = await store.getBusiness(campaign.businessId);
      if (business) businessNameByCampaign.set(campaign.id, business.name);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">שלום, {user.name} 👋</h1>
          <p className="text-sm text-slate-400">דשבורד משפיען · החודש הנוכחי</p>
        </div>
        <Link href="/campaigns" className={btnPrimary}>
          מצאו קמפיין חדש
        </Link>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="מכירות החודש" value={stats.monthCount} />
        <Stat label="עמלות החודש" value={formatILS(stats.monthEarnings)} />
        <Stat label='סה"כ עמלות' value={formatILS(stats.totalEarnings)} sub={`${stats.totalCount} מכירות בסך הכול`} />
        <Stat
          label="המדרגה שלי"
          value={`${tier.label} ${tier.bonusPct ? `(+${tier.bonusPct}%)` : ""}`}
          sub={
            next
              ? `עוד ${next.minMonthlySales - stats.monthCount} מכירות למדרגת ${next.label} (+${next.bonusPct}%)`
              : "המדרגה הגבוהה ביותר — כל הכבוד!"
          }
        />
      </div>

      <SectionTitle>הקודים שלי</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        {codes.length === 0 && (
          <p className="text-sm text-slate-400">
            עוד אין לך קודים — <Link href="/campaigns" className="text-emerald-300 underline">הצטרפו לקמפיין</Link> כדי לקבל אחד.
          </p>
        )}
        {codes.map((code) => {
          const campaign = campaignById.get(code.campaignId);
          return (
            <Card key={code.id}>
              <div className="flex items-center justify-between gap-2">
                <code className="text-lg font-extrabold tracking-widest text-emerald-300" dir="ltr">
                  {code.code}
                </code>
                <CopyButton text={code.code} />
              </div>
              {campaign ? (
                <>
                  <p className="mt-2 text-sm text-slate-300">
                    {campaign.title} · {businessNameByCampaign.get(campaign.id)}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    הקונה מקבל {campaign.buyerDiscountPct}% הנחה · את/ה מרוויח/ה{" "}
                    {campaign.influencerPct + tier.bonusPct}% מכל קנייה
                  </p>
                </>
              ) : null}
            </Card>
          );
        })}
      </div>

      <SectionTitle>המכירות שלי</SectionTitle>
      <RedemptionsTable redemptions={redemptions.slice(0, 15)} names={new Map()} perspective="influencer" />
    </div>
  );
}

async function namesById(store: DataStore, ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const id of new Set(ids)) {
    const u = await store.getUser(id);
    if (u) map.set(id, u.name);
  }
  return map;
}

function RedemptionsTable({
  redemptions,
  names,
  perspective,
}: {
  redemptions: Redemption[];
  names: Map<string, string>;
  perspective: "business" | "influencer";
}) {
  if (redemptions.length === 0) {
    return <p className="text-sm text-slate-400">אין עדיין מכירות. אפשר לייצר אחת בסימולטור.</p>;
  }
  return (
    <Card className="overflow-x-auto !p-0">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-white/10 text-right text-xs text-slate-400">
            <th className="px-4 py-3 font-medium">מתי</th>
            {perspective === "business" ? <th className="px-4 py-3 font-medium">משפיען</th> : null}
            <th className="px-4 py-3 font-medium">סכום קנייה</th>
            <th className="px-4 py-3 font-medium">הנחה לקונה</th>
            <th className="px-4 py-3 font-medium">עמלת משפיען</th>
            {perspective === "business" ? <th className="px-4 py-3 font-medium">דמי פלטפורמה</th> : null}
            <th className="px-4 py-3 font-medium">מדרגה</th>
          </tr>
        </thead>
        <tbody>
          {redemptions.map((r) => (
            <tr key={r.id} className="border-b border-white/5 last:border-0">
              <td className="px-4 py-2.5 text-slate-400">{formatDate(r.createdAt)}</td>
              {perspective === "business" ? (
                <td className="px-4 py-2.5">{names.get(r.influencerId) ?? "—"}</td>
              ) : null}
              <td className="px-4 py-2.5 font-semibold">{formatILS(r.orderAmount)}</td>
              <td className="px-4 py-2.5 text-emerald-300">{formatILS(r.buyerDiscount)}</td>
              <td className="px-4 py-2.5 text-indigo-300">
                {formatILS(r.influencerCommission)}
                {r.tierBonusPct > 0 ? <span className="text-xs text-slate-400"> (כולל בונוס)</span> : null}
              </td>
              {perspective === "business" ? <td className="px-4 py-2.5">{formatILS(r.platformFee)}</td> : null}
              <td className="px-4 py-2.5 text-xs text-slate-400">{r.tier}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
