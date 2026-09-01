import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth";
import { logout } from "./actions";
import { TagIcon } from "@/components/icons";
import { isPersistent } from "@/lib/store";

export const metadata: Metadata = {
  title: "BOOST — קוד קופון אחד, כולם מרוויחים",
  description:
    "הפלטפורמה שמחברת עסקים חדשים למשפיענים: העסק משלם רק על מכירות, המשפיען מרוויח עמלה, הקונה מקבל הנחה.",
};

export const dynamic = "force-dynamic";

/* חוזה הכיוון — מוזרק כהערת HTML אמיתית שנשארת ב-markup של הפרודקשן */
const DESIGN_CONTRACT = `<!--
THESIS: פלטפורמת חלוקת-הכנסה שמוצגת כמה שהיא באמת — תווית מחיר על כל מכירה. מסרבת ל-hero גרדיאנט כהה של SaaS ולגריד כרטיסים שווים.
OWN-WORLD: קרטון קראפט (#E9DCC1) עם מרקם גלי, תוויות לבנות (#FFFEF8) בגבול דיו, כתום מדבקת-מבצע (#F4490B) עם טקסט דיו, צהוב מרקר (#FFC93C), ניקוב מקווקו, ברקודים, נייר דבק. Karantina לכותרות, Rubik לגוף, JetBrains Mono לקודים וכסף.
STORY: בעל עסק קטן מבין תוך שניות: "אני קובע כמה שווה לי מכירה, משלם רק כשהיא קורית" — ולוחץ להתחיל. משפיען מבין: "קוד אישי = כסף אמיתי".
FIRST VIEWPORT: ימין — כותרת Karantina ענקית עם מרקר צהוב + שתי פעולות (מדבקה כתומה ראשית, חותמת משנית). שמאל — תווית משלוח מסובבת קלות עם פירוק כספי אמיתי של מכירת 300 שקל: הנחה/עמלה/פלטפורמה, ברקוד וקוד. התווית "נדבקת" באנימציה אחת.
FORM: תוויות אריזה ומדבקות מחיר; מועמד 6 מתוך 7 ברשימה המדורגת; seed cfe43128.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
-->`;

const navLink =
  "rounded-md px-3 py-1.5 text-sm font-medium text-ink/80 transition hover:bg-paper hover:text-ink";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <html lang="he" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Karantina:wght@400;700&family=Rubik:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <template data-design-contract="" dangerouslySetInnerHTML={{ __html: DESIGN_CONTRACT }} />
        <header className="border-b-2 border-ink bg-label">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="inline-flex -rotate-6 items-center justify-center rounded-md bg-deal p-1.5 text-ink">
                <TagIcon className="h-4 w-4" strokeWidth={2.2} />
              </span>
              <span className="font-sans text-[26px] font-extrabold uppercase leading-none tracking-tight">Boost</span>
              <span className="mt-1 self-start text-[10px] font-semibold text-mut">שם זמני</span>
            </Link>
            <nav className="flex flex-wrap items-center gap-1">
              <Link href="/campaigns" className={navLink}>
                קמפיינים
              </Link>
              <Link href="/simulate" className={navLink}>
                סימולטור קנייה
              </Link>
              {user ? (
                <>
                  <Link href="/dashboard" className={navLink}>
                    הדשבורד שלי
                  </Link>
                  <span className="hidden px-2 text-xs font-medium text-mut sm:inline">
                    {user.name} · {user.role === "business" ? "עסק" : "משפיען"}
                  </span>
                  <form action={logout}>
                    <button className="rounded-md border border-ink/30 px-3 py-1.5 text-sm font-semibold transition hover:bg-paper">
                      יציאה
                    </button>
                  </form>
                </>
              ) : (
                <Link
                  href="/login"
                  className="rounded-md bg-ink px-4 py-1.5 text-sm font-bold text-label transition hover:bg-ink/85"
                >
                  כניסה
                </Link>
              )}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        <footer className="mx-auto max-w-5xl px-4 pb-8 pt-6">
          <div className="perforation pt-4 text-center text-xs text-mut">
            {isPersistent()
              ? "גרסת דמו · הנתונים נשמרים בבסיס נתונים אמיתי (Supabase)"
              : "גרסת דמו מקומית · הנתונים בזיכרון בלבד"}
          </div>
        </footer>
      </body>
    </html>
  );
}
