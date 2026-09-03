import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Badge, Card } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { MemoryStore } from "@/lib/store/memory";
import { seed } from "@/lib/store/seed";
import { BusinessDashboard, InfluencerDashboard } from "../../dashboard/page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "תצוגת ממשקים | BOOST", robots: { index: false, follow: false } };

type Role = "influencer" | "business";

/**
 * See what a business and an influencer see, for design work.
 *
 * Two things this is not, on purpose:
 *
 * It is not impersonation. The dashboards below are rendered from a throwaway
 * in-memory store seeded with the example world — nobody's real earnings,
 * customers or codes appear here. Wanting to improve a layout is not a reason
 * to read someone's money.
 *
 * It is not a copy of the dashboards either. It renders the same two
 * components the real /dashboard renders, so a change to either shows up here
 * without anyone remembering to update a mock — a preview that drifts from
 * the product is worse than none.
 *
 * The whole panel is `inert`, so every button and form inside is dead: this
 * is for looking. The actions would refuse anyway — they resolve the business
 * from the signed-in operator, not from what is on screen — but a preview
 * that quietly does nothing when clicked is confusing, and one that cannot be
 * clicked is honest.
 */
export default async function AdminPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>;
}) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (!me.isAdmin) redirect("/dashboard");

  const { as } = await searchParams;
  const role: Role = as === "business" ? "business" : "influencer";

  const store = new MemoryStore();
  await seed(store);
  const users = await store.listUsers();
  const subject = users.find((u) => u.role === role);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-6xl leading-none">תצוגת ממשקים</h1>
          <p className="mt-2 text-sm text-mut">
            כך נראה האתר למשתמשים שלך. נתוני דוגמה בלבד — לא של אף אחד אמיתי.
          </p>
        </div>
        <Link href="/admin" className="text-sm font-semibold text-deal-deep underline underline-offset-2">
          ← לניהול מערכת
        </Link>
      </div>

      <nav aria-label="בחירת ממשק" className="mt-5 flex flex-wrap gap-2">
        {(
          [
            { key: "influencer", label: "הממשק של משפיען" },
            { key: "business", label: "הממשק של עסק" },
          ] as Array<{ key: Role; label: string }>
        ).map((t) => (
          <Link
            key={t.key}
            href={`/admin/preview?as=${t.key}`}
            aria-current={role === t.key ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-lg border-2 px-4 text-sm font-bold transition ${
              role === t.key
                ? "border-ink bg-ink text-label"
                : "border-ink/25 bg-label text-ink hover:bg-paper"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <Card className="mt-4 border-dashed">
        <p className="text-sm font-medium leading-relaxed">
          <Badge tone="warning">תצוגה בלבד</Badge>{" "}
          הכפתורים והטפסים למטה מנוטרלים, והנתונים מומצאים. זה אותו קוד בדיוק שרץ
          ב-<Link href="/dashboard" className="font-semibold text-deal-deep underline underline-offset-2">דשבורד</Link>{" "}
          האמיתי, כך שכל שינוי בעיצוב יופיע כאן מיד.
        </p>
      </Card>

      {subject ? (
        <div
          // Dead to the mouse, the keyboard and the accessibility tree: this
          // region is a picture of the product, not the product.
          inert
          className="mt-5 rounded-xl border-2 border-dashed border-ink/30 bg-paper/60 p-4"
        >
          {role === "business" ? (
            <BusinessDashboard user={subject} store={store} />
          ) : (
            <InfluencerDashboard user={subject} store={store} />
          )}
        </div>
      ) : (
        <p className="mt-5 text-sm text-mut">לא נמצאה דמות דוגמה לתפקיד הזה.</p>
      )}
    </div>
  );
}
