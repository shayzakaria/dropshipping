import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge, Card, SectionTitle, StatStrip, btnGhost, btnPrimary } from "@/components/ui";
import { Barcode } from "@/components/Barcode";
import { CloseCampaignForm } from "@/components/CloseCampaignForm";
import { CopyButton } from "@/components/CopyButton";
import { ShareCode } from "@/components/ShareCode";
import { getCurrentUser } from "@/lib/auth";
import {
  CAMPAIGN_STATUS_LABELS,
  CANCELLATION_REASONS,
  cancellationReasonLabel,
  COMMISSION_HOLD_DAYS,
  commissionState,
  nextTier,
  tierForMonthlySales,
} from "@/lib/domain/logic";
import { businessStats, influencerStats, walletStats } from "@/lib/domain/stats";
import type { Business, Campaign, CampaignStatus, CouponCode, Redemption, User } from "@/lib/domain/types";
import { formatDate, formatILS } from "@/lib/format";
import { getReadyStore } from "@/lib/store";
import type { DataStore } from "@/lib/store/store";
import { cancelSale, setCampaignState } from "../actions";

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
  // Two independent queries, then two more that depend on them. This used to
  // be a sequential loop of one query per campaign plus one per influencer
  // name — every one of them a round trip to Ireland.
  const [campaigns, redemptions] = await Promise.all([
    store.listCampaignsByBusiness(business.id),
    store.listRedemptionsByBusiness(business.id),
  ]);
  const [codes, influencerNames] = await Promise.all([
    store.listCodesByCampaignIds(campaigns.map((c) => c.id)),
    namesById(store, redemptions.map((r) => r.influencerId)),
  ]);
  const stats = businessStats(redemptions, new Date());
  const codesByCampaign = new Map<string, CouponCode[]>();
  for (const code of codes) {
    const list = codesByCampaign.get(code.campaignId);
    if (list) list.push(code);
    else codesByCampaign.set(code.campaignId, [code]);
  }

  // Live work first, finished work last: a campaign you closed in March should
  // not sit above the one running today.
  const ORDER: Record<CampaignStatus, number> = { active: 0, paused: 1, closed: 2 };
  const sorted = [...campaigns].sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  const counts = { active: 0, paused: 0, closed: 0 };
  for (const c of campaigns) counts[c.status]++;

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

      <div className="mt-6">
        <StatStrip
          items={[
            { label: "מכירות דרך הפלטפורמה", value: stats.monthCount, sub: `מחזור: ${formatILS(stats.monthRevenue)}` },
            { label: "הנחות שניתנו לקונים", value: formatILS(stats.monthBuyerDiscounts) },
            { label: "עמלות למשפיענים", value: formatILS(stats.monthCommissions) },
            {
              label: "עלות שיווק כוללת",
              value: formatILS(stats.monthTotalCost),
              sub: `${stats.costPctOfRevenue}% מהמחזור — קבוע וידוע מראש`,
              accent: true,
            },
          ]}
        />
      </div>

      <SectionTitle>הקמפיינים שלי</SectionTitle>
      {campaigns.length > 0 ? (
        <p className="-mt-2 mb-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-ok/40 bg-okbg px-2.5 py-1 font-semibold text-ok">
            <span className="h-2 w-2 rounded-full bg-ok" aria-hidden="true" />
            {counts.active} פעילים
          </span>
          {counts.paused > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-deal-deep/40 bg-mark/25 px-2.5 py-1 font-semibold text-ink">
              <span className="h-2 w-2 rounded-full bg-deal-deep" aria-hidden="true" />
              {counts.paused} מושהים
            </span>
          ) : null}
          {counts.closed > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-ink/25 bg-paper px-2.5 py-1 font-semibold text-mut">
              <span className="h-2 w-2 rounded-full bg-mut" aria-hidden="true" />
              {counts.closed} סגורים
            </span>
          ) : null}
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {campaigns.length === 0 && (
          <p className="text-sm text-mut">עוד אין קמפיינים — צרו את הראשון כדי שמשפיענים יוכלו להצטרף.</p>
        )}
        {sorted.map((c) => (
          <Card
            key={c.id}
            // A paused campaign has to look switched off across the whole card.
            // When the only difference was a small badge, pausing read as
            // "nothing happened" — the state had changed and nobody could see it.
            className={c.status === "active" ? "" : "border-dashed bg-paper"}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-lg font-bold">{c.title}</h3>
                {c.description ? <p className="mt-0.5 text-xs font-light text-mut">{c.description}</p> : null}
              </div>
              <Badge tone={c.status === "active" ? "success" : c.status === "paused" ? "warning" : "default"}>
                {CAMPAIGN_STATUS_LABELS[c.status]}
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
            {c.status === "paused" ? (
              <p className="mt-3 rounded-lg border border-deal-deep/50 bg-mark/25 p-2.5 text-xs font-medium leading-relaxed text-ink">
                מושהה — לא מופיע ברשימה למשפיענים, והקודים שלו לא נפדים. אפשר להפעיל
                מחדש בכל רגע, ועמלות שכבר נצברו לא נפגעות.
              </p>
            ) : null}
            {c.status === "closed" ? (
              <p className="mt-3 rounded-lg border border-ink/25 bg-label p-2.5 text-xs font-medium leading-relaxed text-mut">
                סגור לצמיתות. הקמפיין נשאר כאן לצורך ההיסטוריה והתחשבנות, ועמלות
                שנצברו בו ישולמו כרגיל.
              </p>
            ) : null}
            {c.status === "closed" ? null : (
              <div className="mt-3 flex flex-wrap gap-2">
                <form action={setCampaignState.bind(null, c.id, c.status === "active" ? "paused" : "active")}>
                  <button className={c.status === "active" ? btnGhost : btnPrimary}>
                    {c.status === "active" ? "השהיית קמפיין" : "הפעלה מחדש"}
                  </button>
                </form>
                <CloseCampaignForm campaignId={c.id} title={c.title} />
              </div>
            )}
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
  "order_id": "1001",
  "customer_ref": "buyer@example.com",
  "api_secret": "YOUR_API_SECRET"
}`}
        </pre>
        <p className="mt-2 text-xs leading-relaxed text-mut">
          החליפו את <code className="font-mono">YOUR_API_SECRET</code> במפתח שלמעלה.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-mut">
          שלחו תמיד את <code className="font-mono">order_id</code> — מספר ההזמנה בחנות שלכם. כך
          שליחה חוזרת של אותה הזמנה לא תירשם פעמיים ולא תחויבו בעמלה כפולה.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-mut">
          <code className="font-mono">customer_ref</code> — אימייל או טלפון של הקונה. אנחנו לא
          שומרים אותו, אלא רק טביעת אצבע מוצפנת שלו, ומשתמשים בה כדי לזהות לקוח חוזר ולחסום
          מימוש עצמי. בקמפיין שמוגבל ללקוחות חדשים השדה הזה חובה.
        </p>
        <p className="mt-4 text-sm font-bold">כשהזמנה מתבטלת או חוזרת</p>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-ink p-4 font-mono text-xs leading-relaxed text-label" dir="ltr">
{`POST /api/refund
{
  "order_id": "1001",
  "api_secret": "YOUR_API_SECRET"
}`}
        </pre>
        <p className="mt-2 text-xs leading-relaxed text-mut">
          העמלה מתבטלת ולא תשולם. אפשר גם לבטל ידנית מטבלת המכירות למעלה. עמלה
          מוחזקת ממילא {COMMISSION_HOLD_DAYS} ימים לפני שהיא זמינה למשיכה — זה הזמן
          שבו רוב ההחזרות מגיעות.
        </p>
        <p className="mt-2 text-xs text-mut">
          אפשר לנסות בלי אינטגרציה דרך <Link href="/simulate" className="font-semibold text-deal-deep underline underline-offset-2">סימולטור הקנייה</Link>.
        </p>
      </Card>
    </div>
  );
}

async function InfluencerDashboard({ user, store }: { user: User; store: DataStore }) {
  const [codes, redemptions] = await Promise.all([
    store.listCodesByInfluencer(user.id),
    store.listRedemptionsByInfluencer(user.id),
  ]);
  const now = new Date();
  const stats = influencerStats(redemptions, now);
  const wallet = walletStats(redemptions, now);
  const tier = tierForMonthlySales(stats.monthCount);
  const next = nextTier(stats.monthCount);

  // Was two queries per code, run one after another. Now two, whatever the
  // influencer's code count.
  const since30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const [campaigns, clicks] = await Promise.all([
    store.listCampaignsByIds([...new Set(codes.map((c) => c.campaignId))]),
    store.countClicksByCodeIds(codes.map((c) => c.id), since30),
  ]);
  const businesses = await store.listBusinessesByIds([
    ...new Set(campaigns.map((c) => c.businessId)),
  ]);
  const salesByCode = new Map<string, number>();
  for (const r of redemptions) {
    if (r.status === "cancelled") continue;
    salesByCode.set(r.codeId, (salesByCode.get(r.codeId) ?? 0) + 1);
  }
  const businessById = new Map(businesses.map((b) => [b.id, b]));
  const campaignById = new Map<string, Campaign>(campaigns.map((c) => [c.id, c]));
  const businessByCampaign = new Map<string, Business>();
  for (const c of campaigns) {
    const b = businessById.get(c.businessId);
    if (b) businessByCampaign.set(c.id, b);
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

      <div className="mt-6">
        <StatStrip
          items={[
            { label: "מכירות החודש", value: stats.monthCount, sub: `${stats.totalCount} מכירות בסך הכול` },
            {
              label: "ממתין לשחרור",
              value: formatILS(wallet.pending),
              // Highlight whichever number the influencer can act on today
              accent: wallet.available === 0 && wallet.pending > 0,
              sub: wallet.nextReleaseAt
                ? `הסכום הקרוב משתחרר ב-${formatDate(wallet.nextReleaseAt)}`
                : "אין עמלות בהמתנה",
            },
            {
              label: "זמין למשיכה",
              value: formatILS(wallet.available),
              accent: wallet.available > 0,
              sub: wallet.canWithdraw
                ? "אפשר לבקש תשלום"
                : `מינימום למשיכה: ${formatILS(wallet.minPayout)}`,
            },
            {
              label: "המדרגה שלי",
              value: tier.label,
              sub: next
                ? `עוד ${next.minMonthlySales - stats.monthCount} מכירות למדרגת ${next.label} (+${next.bonusPct}% עמלה)`
                : "המדרגה הגבוהה ביותר — כל הכבוד!",
            },
          ]}
        />
      </div>

      <p className="mt-3 text-xs leading-relaxed text-mut">
        עמלה על מכירה נשמרת {COMMISSION_HOLD_DAYS} ימים לפני שהיא זמינה למשיכה — זה חלון
        הביטול של הקונה לפי חוק הגנת הצרכן. אם ההזמנה חוזרת, העמלה מתבטלת.
        {wallet.cancelled > 0 ? ` עד היום בוטלו ${formatILS(wallet.cancelled)} בעקבות החזרות.` : ""}
      </p>

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
            <Card key={code.id} pad={false}>
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
                      {campaign.title} ·{" "}
                      <span className="font-normal text-mut">
                        {businessByCampaign.get(campaign.id)?.name}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-mut">
                      הקונה מקבל {campaign.buyerDiscountPct}% הנחה · את/ה מרוויח/ה{" "}
                      <span className="font-bold text-deal-deep">{campaign.influencerPct + tier.bonusPct}%</span> מכל קנייה
                    </p>
                    <ClickStats
                      clicks={clicks.get(code.id) ?? 0}
                      sales={salesByCode.get(code.id) ?? 0}
                    />
                    <ShareCode
                      code={code.code}
                      campaignTitle={campaign.title}
                      businessName={businessByCampaign.get(campaign.id)?.name ?? ""}
                      discountPct={campaign.buyerDiscountPct}
                      storeUrl={businessByCampaign.get(campaign.id)?.storeUrl}
                    />
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
  const unique = [...new Set(ids)];
  const users = await store.listUsersByIds(unique);
  return new Map(users.map((u) => [u.id, u.name]));
}

const COMMISSION_LABELS = {
  pending: { text: "ממתין", tone: "default" as const },
  available: { text: "זמין למשיכה", tone: "success" as const },
  paid: { text: "שולם", tone: "default" as const },
  cancelled: { text: "בוטל", tone: "warning" as const },
};

/**
 * What the influencer's link did in the last 30 days.
 *
 * Clicks are the point: they arrive within minutes of a post, while a sale
 * can take days. Shown beside sales because the pair is what diagnoses —
 * clicks with no sales says the offer or the shop is losing people; no
 * clicks says the post is.
 *
 * Deliberately no conversion percentage. A buyer can type the code without
 * ever touching the link, so sales are not a subset of clicks and dividing
 * one by the other produces numbers like "171% conversion" — a figure that
 * looks precise, means nothing, and would be quoted back at us.
 */
function ClickStats({ clicks, sales }: { clicks: number; sales: number }) {
  if (clicks === 0 && sales === 0) {
    return (
      <p className="mt-3 rounded-lg border border-dashed border-ink/25 bg-paper p-2.5 text-xs leading-relaxed text-mut">
        עוד אף אחד לא לחץ על הלינק שלך. שתפו אותו וזה יתחיל להתעדכן תוך דקות —
        בלי לחכות למכירה.
      </p>
    );
  }
  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-stretch gap-2">
        <p className="flex-1 rounded-lg border border-ink/25 bg-paper px-3 py-2">
          <span className="block font-mono text-xl font-bold tabular-nums">{clicks}</span>
          <span className="text-xs text-mut">לחצו על הלינק · 30 יום</span>
        </p>
        <p className="flex-1 rounded-lg border border-ink/25 bg-paper px-3 py-2">
          <span className="block font-mono text-xl font-bold tabular-nums">{sales}</span>
          <span className="text-xs text-mut">קניות עם הקוד</span>
        </p>
      </div>
      {clicks >= 10 && sales === 0 ? (
        <p className="mt-2 rounded-lg border border-deal-deep/40 bg-mark/25 p-2.5 text-xs leading-relaxed text-ink">
          אנשים נכנסים אבל לא קונים. זה כמעט תמיד לא התוכן שלך אלא ההצעה או
          החנות — שווה לדבר עם העסק.
        </p>
      ) : null}
    </div>
  );
}

function CommissionBadge({ redemption }: { redemption: Redemption }) {
  const state = commissionState(redemption);
  const { text, tone } = COMMISSION_LABELS[state];
  if (state !== "cancelled") return <Badge tone={tone}>{text}</Badge>;
  // Money the influencer already saw is being taken back. Say when and why on
  // the row itself, not in a place they would have to go looking for.
  return (
    <span className="flex flex-col items-start gap-0.5">
      <Badge tone={tone}>{text}</Badge>
      <span className="text-[11px] leading-tight text-mut">
        {cancellationReasonLabel(redemption.cancellationReason)}
        {redemption.cancelledAt
          ? ` · ${new Date(redemption.cancelledAt).toLocaleDateString("he-IL")}`
          : ""}
      </span>
    </span>
  );
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
    <Card pad={false} className="overflow-x-auto">
      <table className="tabular w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b-2 border-dashed border-ink/30 text-right text-xs text-mut">
            <th className="px-4 py-3 font-semibold">מתי</th>
            {perspective === "business" ? <th className="px-4 py-3 font-semibold">משפיען</th> : null}
            <th className="px-4 py-3 font-semibold">סכום קנייה</th>
            <th className="px-4 py-3 font-semibold">הנחה לקונה</th>
            <th className="px-4 py-3 font-semibold">עמלת משפיען</th>
            {perspective === "business" ? <th className="px-4 py-3 font-semibold">דמי פלטפורמה</th> : null}
            {perspective === "influencer" ? <th className="px-4 py-3 font-semibold">מצב העמלה</th> : null}
            <th className="px-4 py-3 font-semibold">מדרגה</th>
            {perspective === "business" ? <th className="px-4 py-3 font-semibold">החזרה</th> : null}
          </tr>
        </thead>
        <tbody>
          {redemptions.map((r) => (
            <tr
              key={r.id}
              className={`border-b border-ink/10 last:border-0 ${
                r.status === "cancelled" ? "text-mut/60 line-through decoration-ink/30" : ""
              }`}
            >
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
              {perspective === "influencer" ? (
                <td className="px-4 py-2.5 text-xs">
                  <CommissionBadge redemption={r} />
                </td>
              ) : null}
              <td className="px-4 py-2.5 text-xs text-mut">
                {r.tier === "GOLD" ? "זהב" : r.tier === "SILVER" ? "כסף" : "ברונזה"}
                {r.tierBonusPct > 0 ? ` (+${r.tierBonusPct}%)` : ""}
              </td>
              {perspective === "business" ? (
                <td className="px-4 py-2.5">
                  {r.status === "cancelled" ? (
                    <span className="flex flex-col gap-0.5">
                      <Badge tone="warning">בוטלה</Badge>
                      <span className="text-[11px] text-mut">
                        {cancellationReasonLabel(r.cancellationReason)}
                      </span>
                    </span>
                  ) : r.status === "paid" ? (
                    <span className="text-xs text-mut">שולם</span>
                  ) : (
                    <form action={cancelSale.bind(null, r.id)} className="flex items-center gap-1.5">
                      <select
                        name="reason"
                        aria-label="סיבת הביטול"
                        className="rounded-md border border-ink/25 bg-label px-1.5 py-1 text-xs text-ink focus:border-deal focus:outline-none"
                      >
                        {CANCELLATION_REASONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      <button className="rounded-md border border-ink/25 px-2 py-1 text-xs font-semibold text-mut transition hover:border-err/50 hover:text-err">
                        ביטול עמלה
                      </button>
                    </form>
                  )}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
