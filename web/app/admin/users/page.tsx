import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Badge, Card, SectionTitle, inputCls } from "@/components/ui";
import { CANCELLATION_REASONS, CAMPAIGN_STATUS_LABELS } from "@/lib/domain/logic";
import { getCurrentUser } from "@/lib/auth";
import { formatDate, formatILS } from "@/lib/format";
import { getReadyStore } from "@/lib/store";
import {
  adminCancelRedemption,
  adminSetCampaignState,
  adminSetCodeStatus,
  adminSetSuspended,
  adminUpdateBusiness,
} from "../../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "תמיכה | BOOST", robots: { index: false, follow: false } };

/**
 * The support desk: find an account, see everything about it, act on it.
 *
 * Every action here is logged before it runs, and the log is shown at the
 * bottom of this page — an operator sees their own trail as they work, which
 * is the cheapest way to keep it honest.
 */
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; id?: string }>;
}) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (!me.isAdmin) redirect("/dashboard");

  const { q = "", id = "" } = await searchParams;
  const store = await getReadyStore();
  const [results, view, log] = await Promise.all([
    q ? store.searchUsers(q, 15) : Promise.resolve([]),
    id ? store.supportView(id) : Promise.resolve(null),
    store.listAdminActions(20),
  ]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-6xl leading-none">תמיכה</h1>
          <p className="mt-2 text-sm text-mut">חיפוש חשבון, וכל מה שאפשר לעשות בשבילו</p>
        </div>
        <Link href="/admin" className="text-sm font-semibold text-deal-deep underline underline-offset-2">
          ← לניהול מערכת
        </Link>
      </div>

      <Card className="mt-6">
        <form className="flex flex-wrap items-end gap-2">
          <label className="min-w-56 flex-1 text-sm">
            <span className="font-medium">חיפוש לפי שם או אימייל</span>
            <input name="q" defaultValue={q} placeholder="למשל: נועה, או noa@" className={`${inputCls} mt-1`} />
          </label>
          <button className="inline-flex min-h-11 items-center rounded-lg bg-ink px-4 text-sm font-bold text-label transition hover:bg-ink/85">
            חיפוש
          </button>
        </form>
        {q && results.length === 0 ? <p className="mt-3 text-sm text-mut">לא נמצא חשבון.</p> : null}
        {results.length > 0 ? (
          <ul className="mt-3 divide-y divide-ink/10">
            {results.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span>
                  <span className="font-medium">{u.name}</span>{" "}
                  <span className="font-mono text-xs text-mut" dir="ltr">{u.email}</span>{" "}
                  <Badge>{u.role === "business" ? "עסק" : "משפיען"}</Badge>{" "}
                  {u.isAdmin ? <Badge tone="warning">מנהל</Badge> : null}
                  {u.suspendedAt ? <Badge tone="warning">מושהה</Badge> : null}
                  {u.isDemo ? <Badge>דוגמה</Badge> : null}
                </span>
                <Link
                  href={`/admin/users?q=${encodeURIComponent(q)}&id=${u.id}`}
                  className="inline-flex min-h-11 items-center rounded-lg border border-ink/25 bg-label px-3 text-sm font-semibold transition hover:bg-paper"
                >
                  פתיחת התיק
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      {view ? (
        <>
          <SectionTitle>{view.user.name}</SectionTitle>
          <Card>
            <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
              <dt className="font-semibold">אימייל</dt>
              <dd className="font-mono text-xs" dir="ltr">{view.user.email}</dd>
              <dt className="font-semibold">תפקיד</dt>
              <dd>{view.user.isAdmin ? "מנהל מערכת" : view.user.role === "business" ? "עסק" : "משפיען"}</dd>
              <dt className="font-semibold">נרשם</dt>
              <dd>{formatDate(view.user.createdAt)}</dd>
              <dt className="font-semibold">מצב</dt>
              <dd>
                {view.user.suspendedAt
                  ? `מושהה מאז ${formatDate(view.user.suspendedAt)} — ${view.user.suspendedReason ?? "ללא סיבה"}`
                  : "פעיל"}
              </dd>
              {view.followedBusinessNames.length > 0 ? (
                <>
                  <dt className="font-semibold">עוקב/ת אחרי</dt>
                  <dd>{view.followedBusinessNames.join(" · ")}</dd>
                </>
              ) : null}
            </dl>

            {view.user.id === me.id ? (
              <p className="mt-4 rounded-lg border border-ink/25 bg-paper p-2.5 text-xs text-mut">
                זה החשבון שלך. השהיה עצמית חסומה — שחרור היה דורש גישה לבסיס הנתונים.
              </p>
            ) : (
              <form action={adminSetSuspended.bind(null, view.user.id)} className="mt-4 flex flex-wrap items-end gap-2">
                {view.user.suspendedAt ? (
                  <>
                    <input type="hidden" name="reason" value="" />
                    <button className="inline-flex min-h-11 items-center rounded-lg bg-ok px-4 text-sm font-bold text-label transition hover:opacity-90">
                      שחרור החשבון
                    </button>
                  </>
                ) : (
                  <>
                    <label className="min-w-48 flex-1 text-sm">
                      <span className="font-medium">סיבת ההשהיה</span>
                      <input name="reason" required placeholder="חובה — נשמר ביומן" className={`${inputCls} mt-1`} />
                    </label>
                    <button className="inline-flex min-h-11 items-center rounded-lg border border-err/50 bg-errbg px-4 text-sm font-bold text-err transition hover:opacity-90">
                      השהיית החשבון
                    </button>
                  </>
                )}
              </form>
            )}
          </Card>

          {view.business ? (
            <>
              <SectionTitle>העסק</SectionTitle>
              <Card>
                <form action={adminUpdateBusiness.bind(null, view.business.id)} className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm">
                    <span className="font-medium">שם</span>
                    <input name="name" defaultValue={view.business.name} className={`${inputCls} mt-1`} />
                  </label>
                  <label className="block text-sm">
                    <span className="font-medium">כתובת חנות</span>
                    <input name="storeUrl" defaultValue={view.business.storeUrl ?? ""} className={`${inputCls} mt-1`} dir="ltr" />
                  </label>
                  <label className="block text-sm sm:col-span-2">
                    <span className="font-medium">תיאור</span>
                    <textarea name="description" defaultValue={view.business.description ?? ""} rows={2} className={`${inputCls} mt-1 resize-y`} />
                  </label>
                  <label className="block text-sm sm:col-span-2">
                    <span className="font-medium">לוגו</span>
                    <input name="logoUrl" defaultValue={view.business.logoUrl ?? ""} className={`${inputCls} mt-1`} dir="ltr" />
                  </label>
                  <div className="sm:col-span-2">
                    <button className="inline-flex min-h-11 items-center rounded-lg bg-ink px-4 text-sm font-bold text-label transition hover:bg-ink/85">
                      שמירה בשם העסק
                    </button>
                  </div>
                </form>
              </Card>

              <SectionTitle>הקמפיינים של העסק</SectionTitle>
              <Card pad={false} className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-xs text-mut">
                    <th className="px-4 py-2 text-start font-medium">קמפיין</th>
                    <th className="px-4 py-2 text-start font-medium">חלוקה</th>
                    <th className="px-4 py-2 text-start font-medium">מצב</th>
                    <th className="px-4 py-2 text-start font-medium">פעולה</th>
                  </tr></thead>
                  <tbody>
                    {view.campaigns.length === 0 ? <tr><td colSpan={4} className="px-4 py-3 text-mut">אין קמפיינים.</td></tr> : null}
                    {view.campaigns.map((c) => (
                      <tr key={c.id} className="border-t border-ink/10">
                        <td className="px-4 py-2 font-medium">
                          {c.title}
                          <span className="block text-xs font-normal text-mut">
                            {c.scope === "product" ? `מוצר: ${c.productName}` : "כל החנות"}
                          </span>
                        </td>
                        <td className="px-4 py-2 font-mono text-xs tabular-nums">
                          {c.buyerDiscountPct}/{c.influencerPct}/{c.platformPct}
                        </td>
                        <td className="px-4 py-2 text-xs">{CAMPAIGN_STATUS_LABELS[c.status]}</td>
                        <td className="px-4 py-2">
                          {c.status === "closed" ? (
                            <span className="text-xs text-mut">סגור</span>
                          ) : (
                            <form action={adminSetCampaignState.bind(null, c.id)} className="flex items-center gap-1.5">
                              <select name="status" aria-label={`מצב עבור ${c.title}`} defaultValue={c.status === "active" ? "paused" : "active"} className="rounded-md border border-ink/25 bg-label px-2 py-1.5 text-xs">
                                <option value="active">הפעלה</option>
                                <option value="paused">השהיה</option>
                                <option value="closed">סגירה</option>
                              </select>
                              <button className="rounded-md border border-ink/25 bg-label px-3 py-1.5 text-xs font-semibold transition hover:bg-paper">עדכון</button>
                            </form>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </>
          ) : null}

          {view.codes.length > 0 ? (
            <>
              <SectionTitle>הקודים של המשפיען</SectionTitle>
              <Card pad={false} className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-xs text-mut">
                    <th className="px-4 py-2 text-start font-medium">קוד</th>
                    <th className="px-4 py-2 text-start font-medium">קמפיין</th>
                    <th className="px-4 py-2 text-start font-medium">קליקים</th>
                    <th className="px-4 py-2 text-start font-medium">מצב</th>
                  </tr></thead>
                  <tbody>
                    {view.codes.map((c) => (
                      <tr key={c.id} className="border-t border-ink/10">
                        <td className="px-4 py-2 font-mono font-bold" dir="ltr">{c.code}</td>
                        <td className="px-4 py-2">{c.campaignTitle}</td>
                        <td className="px-4 py-2 font-mono tabular-nums">{c.clicks}</td>
                        <td className="px-4 py-2">
                          <form action={adminSetCodeStatus.bind(null, c.id)} className="flex items-center gap-1.5">
                            <input type="hidden" name="status" value={c.status === "active" ? "disabled" : "active"} />
                            <button className="rounded-md border border-ink/25 bg-label px-3 py-1.5 text-xs font-semibold transition hover:bg-paper">
                              {c.status === "active" ? "השבתת הקוד" : "הפעלת הקוד"}
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </>
          ) : null}

          <SectionTitle>מכירות שקשורות לחשבון</SectionTitle>
          <Card pad={false} className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-mut">
                <th className="px-4 py-2 text-start font-medium">מתי</th>
                <th className="px-4 py-2 text-start font-medium">סכום</th>
                <th className="px-4 py-2 text-start font-medium">עמלה</th>
                <th className="px-4 py-2 text-start font-medium">מצב</th>
                <th className="px-4 py-2 text-start font-medium">ביטול בשם העסק</th>
              </tr></thead>
              <tbody>
                {view.redemptions.length === 0 ? <tr><td colSpan={5} className="px-4 py-3 text-mut">אין מכירות.</td></tr> : null}
                {view.redemptions.slice(0, 25).map((r) => (
                  <tr key={r.id} className={`border-t border-ink/10 ${r.status === "cancelled" ? "text-mut line-through" : ""}`}>
                    <td className="px-4 py-2 text-xs">{formatDate(r.createdAt)}</td>
                    <td className="px-4 py-2 font-mono tabular-nums">{formatILS(r.orderAmount)}</td>
                    <td className="px-4 py-2 font-mono tabular-nums">{formatILS(r.influencerCommission)}</td>
                    <td className="px-4 py-2 text-xs">{r.status}</td>
                    <td className="px-4 py-2">
                      {r.status === "held" ? (
                        <form action={adminCancelRedemption.bind(null, r.id)} className="flex items-center gap-1.5">
                          <select name="reason" aria-label="סיבת ביטול" className="rounded-md border border-ink/25 bg-label px-2 py-1.5 text-xs">
                            {CANCELLATION_REASONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                          <button className="rounded-md border border-ink/25 bg-label px-3 py-1.5 text-xs font-semibold transition hover:border-err/50 hover:text-err">ביטול</button>
                        </form>
                      ) : (
                        <span className="text-xs text-mut">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      ) : null}

      <SectionTitle>יומן פעולות מנהל</SectionTitle>
      <Card pad={false} className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="px-4 pt-3 text-start text-xs text-mut">
            כל פעולה שמנהל עשה בשם מישהו אחר נרשמת כאן לפני שהיא מתבצעת. היומן לא נמחק.
          </caption>
          <thead><tr className="text-xs text-mut">
            <th className="px-4 py-2 text-start font-medium">מתי</th>
            <th className="px-4 py-2 text-start font-medium">פעולה</th>
            <th className="px-4 py-2 text-start font-medium">על מה</th>
            <th className="px-4 py-2 text-start font-medium">פרטים</th>
          </tr></thead>
          <tbody>
            {log.length === 0 ? <tr><td colSpan={4} className="px-4 py-3 text-mut">עוד לא בוצעו פעולות מנהל.</td></tr> : null}
            {log.map((a) => (
              <tr key={a.id} className="border-t border-ink/10">
                <td className="px-4 py-2 text-xs">{formatDate(a.createdAt)}</td>
                <td className="px-4 py-2 font-mono text-xs" dir="ltr">{a.action}</td>
                <td className="px-4 py-2 font-mono text-xs" dir="ltr">{a.subjectKind}</td>
                <td className="px-4 py-2 font-mono text-[11px] text-mut" dir="ltr">
                  {a.detail ? JSON.stringify(a.detail) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
