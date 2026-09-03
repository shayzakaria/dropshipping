import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Badge, Card, SectionTitle } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { formatDate, formatILS } from "@/lib/format";
import { getReadyStore } from "@/lib/store";
import type { DailyPoint } from "@/lib/store/store";
import { setFeatured } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "ניהול מערכת | BOOST", robots: { index: false, follow: false } };

const WINDOW_DAYS = 30;

/**
 * The operator's seat. One page, everything that moves, last 30 days.
 *
 * Gated on profiles.is_admin, which nothing in the application can set —
 * so the check here is the whole of the access control and it is enough.
 */
export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) redirect("/dashboard");

  const store = await getReadyStore();
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const [snap, businesses] = await Promise.all([
    store.adminSnapshot(since),
    store.listDirectoryBusinesses(),
  ]);
  const r = snap.redemptions;
  const nowIso = new Date().toISOString();

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-6xl leading-none">ניהול מערכת</h1>
          <p className="mt-2 text-sm text-mut">30 הימים האחרונים · הנתונים חיים, לא מטמון</p>
        </div>
        <span className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/users"
            className="inline-flex min-h-11 items-center rounded-lg bg-ink px-4 text-sm font-bold text-label transition hover:bg-ink/85"
          >
            תמיכה בחשבונות
          </Link>
          <Link
            href="/admin/preview"
            className="inline-flex min-h-11 items-center rounded-lg border border-ink/25 bg-label px-4 text-sm font-bold text-ink transition hover:bg-paper"
          >
            תצוגת ממשקים
          </Link>
          <Badge tone="warning">רואה את זה רק מי שסומן כמנהל</Badge>
        </span>
      </div>

      {/* The one number this dashboard leads with: what the platform earned. */}
      <Card className="mt-6">
        <p className="text-sm font-medium text-mut">דמי פלטפורמה שנצברו · 30 יום</p>
        <p className="mt-1 font-sans text-5xl font-semibold leading-none">{formatILS(r.platformFees)}</p>
        <p className="mt-2 text-xs text-mut">
          מתוך {formatILS(r.gmv)} מכירות דרך קודים · {r.count} מכירות · {r.cancelled} בוטלו
        </p>
      </Card>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="מכירות" value={r.count} sub={`${formatILS(r.gmv)} מחזור`} />
        <Tile label="עמלות למשפיענים" value={formatILS(r.influencerCommissions)} sub="נצברו, לפני חלון ההמתנה" />
        <Tile label="הנחות לקונים" value={formatILS(r.buyerDiscounts)} sub="ניתנו בחנויות" />
        <Tile label="קליקים על לינקים" value={snap.clicks.total} sub="של משפיענים" />
        <Tile label="צפיות בעמודים" value={snap.pageViews.total} sub="ללא מזהה מבקר" />
        <Tile label="משתמשים" value={snap.users.total} sub={`${snap.users.businesses} עסקים · ${snap.users.influencers} משפיענים · ${snap.users.newSince} חדשים`} />
        <Tile label="קמפיינים" value={snap.campaigns.active} sub={`פעילים · ${snap.campaigns.paused} מושהים · ${snap.campaigns.closed} סגורים`} />
        <Tile label="קודים שהונפקו" value={snap.codes.total} sub={`${snap.follows.total} מעקבים אחרי עסקים`} />
      </div>

      <SectionTitle>מגמות</SectionTitle>
      <div className="grid gap-3 lg:grid-cols-3">
        <DailyBars title="מכירות ליום" points={snap.series.sales} />
        <DailyBars title="קליקים ליום" points={snap.series.clicks} />
        <DailyBars title="צפיות ליום" points={snap.series.views} />
      </div>

      <SectionTitle>מי מביא את הכסף</SectionTitle>
      <div className="grid gap-3 lg:grid-cols-2">
        <Card pad={false} className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="px-4 pt-3 text-start text-xs font-semibold text-mut">עסקים לפי מחזור · כל הזמן</caption>
            <thead><tr className="text-xs text-mut"><th className="px-4 py-2 text-start font-medium">עסק</th><th className="px-4 py-2 text-start font-medium">מכירות</th><th className="px-4 py-2 text-start font-medium">מחזור</th></tr></thead>
            <tbody>
              {snap.topBusinesses.length === 0 ? <tr><td colSpan={3} className="px-4 py-3 text-mut">עדיין אין מכירות.</td></tr> : null}
              {snap.topBusinesses.map((b) => (
                <tr key={b.id} className="border-t border-ink/10">
                  <td className="px-4 py-2 font-medium">{b.name}</td>
                  <td className="px-4 py-2 font-mono tabular-nums">{b.sales}</td>
                  <td className="px-4 py-2 font-mono tabular-nums">{formatILS(b.gmv)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card pad={false} className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="px-4 pt-3 text-start text-xs font-semibold text-mut">משפיענים לפי עמלה · כל הזמן</caption>
            <thead><tr className="text-xs text-mut"><th className="px-4 py-2 text-start font-medium">משפיען</th><th className="px-4 py-2 text-start font-medium">מכירות</th><th className="px-4 py-2 text-start font-medium">עמלה</th></tr></thead>
            <tbody>
              {snap.topInfluencers.length === 0 ? <tr><td colSpan={3} className="px-4 py-3 text-mut">עדיין אין מכירות.</td></tr> : null}
              {snap.topInfluencers.map((i) => (
                <tr key={i.id} className="border-t border-ink/10">
                  <td className="px-4 py-2 font-medium">{i.name}</td>
                  <td className="px-4 py-2 font-mono tabular-nums">{i.sales}</td>
                  <td className="px-4 py-2 font-mono tabular-nums">{formatILS(i.commission)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <SectionTitle>העמודים שנצפים</SectionTitle>
      <Card pad={false} className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-xs text-mut"><th className="px-4 py-2 text-start font-medium">נתיב</th><th className="px-4 py-2 text-start font-medium">צפיות · 30 יום</th></tr></thead>
          <tbody>
            {snap.pageViews.byPath.length === 0 ? <tr><td colSpan={2} className="px-4 py-3 text-mut">הספירה מתחילה מהפריסה הזו.</td></tr> : null}
            {snap.pageViews.byPath.map((p) => (
              <tr key={p.path} className="border-t border-ink/10">
                <td className="px-4 py-2 font-mono text-xs" dir="ltr">{p.path}</td>
                <td className="px-4 py-2 font-mono tabular-nums">{p.views}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <SectionTitle>קידום בקטלוג</SectionTitle>
      <Card>
        <p className="text-sm font-light leading-relaxed text-mut">
          מיקום ראשון בקטלוג עם תג &quot;מומלץ&quot;. תאריך ולא מתג — הסלוט נגמר לבד. הגבייה
          ידנית עד שיהיה ספק סליקה; כאן רק מפעילים.
        </p>
        <ul className="mt-3 divide-y divide-ink/10">
          {businesses.map((b) => {
            const live = Boolean(b.featuredUntil && b.featuredUntil > nowIso);
            return (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <div>
                  <p className="font-medium">
                    {b.name} {b.isDemo ? <Badge tone="warning">דוגמה</Badge> : null}
                  </p>
                  <p className="text-xs text-mut">
                    {live ? `מומלץ עד ${formatDate(b.featuredUntil!)}` : "לא מקודם"}
                  </p>
                </div>
                <form action={setFeatured.bind(null, b.id)} className="flex items-center gap-1.5">
                  <select name="days" aria-label={`ימי קידום עבור ${b.name}`} className="rounded-md border border-ink/25 bg-label px-2 py-1.5 text-xs" defaultValue={live ? "0" : "30"}>
                    <option value="7">7 ימים</option>
                    <option value="30">30 ימים</option>
                    <option value="90">90 ימים</option>
                    <option value="0">הסרת הקידום</option>
                  </select>
                  <button className="rounded-md border border-ink/25 bg-label px-3 py-1.5 text-xs font-semibold transition hover:bg-paper">עדכון</button>
                </form>
              </li>
            );
          })}
        </ul>
      </Card>

      <SectionTitle>מכירות אחרונות</SectionTitle>
      <Card pad={false} className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-xs text-mut">
            <th className="px-4 py-2 text-start font-medium">מתי</th><th className="px-4 py-2 text-start font-medium">סכום</th>
            <th className="px-4 py-2 text-start font-medium">עמלה</th><th className="px-4 py-2 text-start font-medium">פלטפורמה</th>
            <th className="px-4 py-2 text-start font-medium">מקור</th><th className="px-4 py-2 text-start font-medium">מצב</th>
          </tr></thead>
          <tbody>
            {snap.recent.map((x) => (
              <tr key={x.id} className={`border-t border-ink/10 ${x.status === "cancelled" ? "text-mut line-through" : ""}`}>
                <td className="px-4 py-2 text-xs">{formatDate(x.createdAt)}</td>
                <td className="px-4 py-2 font-mono tabular-nums">{formatILS(x.orderAmount)}</td>
                <td className="px-4 py-2 font-mono tabular-nums">{formatILS(x.influencerCommission)}</td>
                <td className="px-4 py-2 font-mono tabular-nums">{formatILS(x.platformFee)}</td>
                <td className="px-4 py-2 text-xs">{x.source}</td>
                <td className="px-4 py-2 text-xs">{x.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <p className="mt-6 text-xs text-mut">
        <Link href="/businesses" className="underline underline-offset-2">הקטלוג</Link> ·{" "}
        <Link href="/campaigns" className="underline underline-offset-2">קמפיינים</Link>
      </p>
    </div>
  );
}

/** Stat tile: label, value in proportional sans figures, a line of context. */
function Tile({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <Card>
      <p className="text-xs font-medium text-mut">{label}</p>
      <p className="mt-1 font-sans text-3xl font-semibold leading-none">{typeof value === "number" ? value.toLocaleString("he-IL") : value}</p>
      {sub ? <p className="mt-1.5 text-xs leading-snug text-mut">{sub}</p> : null}
    </Card>
  );
}

/**
 * One series, one hue, thirty thin bars anchored to the baseline. No legend
 * (a single series is named by its title), a native tooltip on every bar,
 * and the same numbers as a table underneath for anyone who cannot read the
 * bars — colour is never the only channel.
 */
function DailyBars({ title, points }: { title: string; points: DailyPoint[] }) {
  // Fill in the missing days so a quiet day is a gap of zero, not a shorter axis.
  const byDay = new Map(points.map((p) => [p.day, p.value]));
  const days: DailyPoint[] = [];
  for (let i = WINDOW_DAYS - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    days.push({ day: d, value: byDay.get(d) ?? 0 });
  }
  const max = Math.max(1, ...days.map((d) => d.value));
  const total = days.reduce((a, d) => a + d.value, 0);
  const W = 300, H = 96, gap = 2, bw = (W - gap * (days.length - 1)) / days.length;

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold">{title}</p>
        <p className="font-sans text-lg font-semibold leading-none">{total.toLocaleString("he-IL")}</p>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-24 w-full" role="img" aria-label={`${title}: ${total} ב-30 יום`}>
        <line x1="0" x2={W} y1={H - 0.5} y2={H - 0.5} stroke="var(--color-ink)" strokeOpacity="0.2" />
        {days.map((d, i) => {
          const h = d.value === 0 ? 0 : Math.max(3, (d.value / max) * (H - 8));
          const x = i * (bw + gap);
          return (
            <g key={d.day}>
              <title>{`${formatDate(d.day)}: ${d.value}`}</title>
              <rect x={x} y={H - h} width={bw} height={h} rx={Math.min(3, bw / 2)} fill="var(--color-deal-deep)" />
              {/* invisible hit target taller than the mark */}
              <rect x={x} y={0} width={bw + gap} height={H} fill="transparent" />
            </g>
          );
        })}
      </svg>
      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-mut">כטבלה</summary>
        <table className="mt-1 w-full text-xs">
          <tbody>
            {days.filter((d) => d.value > 0).reverse().map((d) => (
              <tr key={d.day} className="border-t border-ink/10">
                <td className="py-1">{formatDate(d.day)}</td>
                <td className="py-1 text-end font-mono tabular-nums">{d.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </Card>
  );
}
