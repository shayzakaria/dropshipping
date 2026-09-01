import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge, Card, SectionTitle, Stat, btnGhost, btnPrimary } from "@/components/ui";
import { Barcode } from "@/components/Barcode";
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
    return <p className="text-mut">לא נמצא עסק למשתמש הזה.</p>;
  }
  const campaigns = await store.listCampaignsByBusiness(business.id);
  const redemptions = await store.listRedemptionsByBusiness(business.id);
  const stats = businessStats(redemptions, new Date());
  const codesByCampaign = new Map<string, CouponCode[]>();
  for (const c of campaigns) codesByCampaign.set(c.id, await store.listCodesByCampaign(c.id));
  const influencerNames = await namesById(store, redemptions.map((r) => r.influencerId));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-6xl leading-none">{business.name}</h1>
          <p className="mt-1 text-sm text-mut">דשבורד עסק · החודש הנוכחי</p>
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
          <p className="text-sm text-mut">עוד אין קמפיינים — צרו את הראשון כדי שמשפיענים יוכלו להצטרף.</p>
        )}
        {campaigns.map((c) => (
          <Card key={c.id}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-lg font-bold">{c.title}</h3>
                {c.description ? <p className="mt-0.5 text-xs font-light text-mut">{c.description}</p> : null}
              </div>
              <Badge tone={c.status === "active" ? "success" : "warning"}>
                {c.status === "active" ? "פעיל" : "מושהה"}
              </Badge>
            </div>
            <p className="mt-3 text-sm">
              הנחה {c.buyerDiscountPct}% · עמלה {c.influencerPct}% · פלטפורמה {c.platformPct}%
            </p>
            <p className="mt-1 text-xs text-mut">
              {c.newCustomersOnly ? "ללקוחות חדשים בלבד" : "פתוח לכל הלקוחות"}
              {c.maxRedemptionsPerMonth ? ` · תקרה ${c.maxRedemptionsPerMonth} מימושים/חודש` : ""}
              {" · "}
              {codesByCampaign.get(c.id)?.length ?? 0} משפיענים הצטרפו
            </p>
            <form action={toggleCampaign.bind(null, c.id)} className="mt-3">
              <button className={btnGhost}>{c.status === "active" ? "השהיית קמפיין" : "הפעלה מחדש"}</button>
            </form>
          </Card>
        ))}
      </div>

      <SectionTitle>מכירות אחרונות</SectionTitle>
      <RedemptionsTable redemptions={redemptions.slice(0, 15)} names={influencerNames} perspective="business" />

      <SectionTitle>חיבור לחנות שלך</SectionTitle>
      <Card>
        <p className="text-sm font-light leading-relaxed">
          החנות שלך (Shopify / Wix / WooCommerce) תקרא ל-API שלנו בקופה כדי לאמת קוד ולרשום
          מכירה. זה מה שהופך את הדיווח לאוטומטי ואמין — בלי דיווח ידני.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-mut">מפתח ה-API של העסק:</span>
          <code className="rounded-md bg-paper px-2 py-1 font-mono text-xs font-semibold" dir="ltr">
            {business.apiSecret}
          </code>
          <CopyButton text={business.apiSecret} />
        </div>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-ink p-4 font-mono text-xs leading-relaxed text-label" dir="ltr">
{`POST /api/redeem
{
  "code": "XXXX-XXXX",
  "order_amount": 300,
  "customer_ref": "buyer@example.com",
  "api_secret": "<המפתח שלך>"
}`}
        </pre>
        <p className="mt-2 text-xs text-mut">
          אפשר לנסות בלי אינטגרציה דרך <Link href="/simulate" className="font-semibold text-deal-deep underline underline-offset-2">סימולטור הקנייה</Link>.
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-6xl leading-none">שלום, {user.name}</h1>
          <p className="mt-1 text-sm text-mut">דשבורד משפיען · החודש הנוכחי</p>
        </div>
        <Link href="/campaigns" className={btnPrimary}>
          למצוא קמפיין חדש
        </Link>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="מכירות החודש" value={stats.monthCount} />
        <Stat label="עמלות החודש" value={formatILS(stats.monthEarnings)} />
        <Stat label='סה"כ עמלות' value={formatILS(stats.totalEarnings)} sub={`${stats.totalCount} מכירות בסך הכול`} />
        <Stat
          label="המדרגה שלי"
          value={tier.label}
          sub={
            next
              ? `עוד ${next.minMonthlySales - stats.monthCount} מכירות למדרגת ${next.label} (+${next.bonusPct}% עמלה)`
              : "המדרגה הגבוהה ביותר — כל הכבוד!"
          }
        />
      </div>

      <SectionTitle>הקודים שלי</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        {codes.length === 0 && (
          <p className="text-sm text-mut">
            עוד אין לך קודים — <Link href="/campaigns" className="font-semibold text-deal-deep underline underline-offset-2">הצטרפו לקמפיין</Link> כדי לקבל אחד.
          </p>
        )}
        {codes.map((code) => {
          const campaign = campaignById.get(code.campaignId);
          return (
            <Card key={code.id} className="!p-0">
              <div className="flex items-center justify-between gap-3 border-b-2 border-dashed border-ink/25 px-5 py-3">
                <code className="font-mono text-lg font-bold tracking-widest" dir="ltr">
                  {code.code}
                </code>
                <CopyButton text={code.code} />
              </div>
              <div className="px-5 py-3">
                <div className="w-28 text-ink/80">
                  <Barcode seed={code.code} height={16} />
                </div>
                {campaign ? (
                  <>
                    <p className="mt-2 text-sm font-semibold">
                      {campaign.title} · <span className="font-normal text-mut">{businessNameByCampaign.get(campaign.id)}</span>
                    </p>
                    <p className="mt-1 text-xs text-mut">
                      הקונה מקבל {campaign.buyerDiscountPct}% הנחה · את/ה מרוויח/ה{" "}
                      <span className="font-bold text-deal-deep">{campaign.influencerPct + tier.bonusPct}%</span> מכל קנייה
                    </p>
                  </>
                ) : null}
              </div>
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
    return <p className="text-sm text-mut">אין עדיין מכירות. אפשר לייצר אחת בסימולטור.</p>;
  }
  return (
    <Card className="overflow-x-auto !p-0">
      <table className="tabular w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b-2 border-dashed border-ink/30 text-right text-xs text-mut">
            <th className="px-4 py-3 font-semibold">מתי</th>
            {perspective === "business" ? <th className="px-4 py-3 font-semibold">משפיען</th> : null}
            <th className="px-4 py-3 font-semibold">סכום קנייה</th>
            <th className="px-4 py-3 font-semibold">הנחה לקונה</th>
            <th className="px-4 py-3 font-semibold">עמלת משפיען</th>
            {perspective === "business" ? <th className="px-4 py-3 font-semibold">דמי פלטפורמה</th> : null}
            <th className="px-4 py-3 font-semibold">מדרגה</th>
          </tr>
        </thead>
        <tbody>
          {redemptions.map((r) => (
            <tr key={r.id} className="border-b border-ink/10 last:border-0">
              <td className="px-4 py-2.5 text-mut">{formatDate(r.createdAt)}</td>
              {perspective === "business" ? (
                <td className="px-4 py-2.5 font-medium">{names.get(r.influencerId) ?? "—"}</td>
              ) : null}
              <td className="px-4 py-2.5 font-mono font-semibold" dir="ltr">{formatILS(r.orderAmount)}</td>
              <td className="px-4 py-2.5 font-mono" dir="ltr">{formatILS(-r.buyerDiscount)}</td>
              <td className="px-4 py-2.5 font-mono font-semibold text-deal-deep" dir="ltr">
                {formatILS(r.influencerCommission)}
              </td>
              {perspective === "business" ? (
                <td className="px-4 py-2.5 font-mono" dir="ltr">{formatILS(r.platformFee)}</td>
              ) : null}
              <td className="px-4 py-2.5 text-xs text-mut">
                {r.tier === "GOLD" ? "זהב" : r.tier === "SILVER" ? "כסף" : "ברונזה"}
                {r.tierBonusPct > 0 ? ` (+${r.tierBonusPct}%)` : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
