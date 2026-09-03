import type { Metadata } from "next";
import { after } from "next/server";
import { headers } from "next/headers";
import { Rubik, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth";
import { logout } from "./actions";
import { TagIcon } from "@/components/icons";
import { AccessibilityMenu } from "@/components/AccessibilityMenu";
import { CookieNotice } from "@/components/CookieNotice";
import { getReadyStore, isPersistent } from "@/lib/store";

const TITLE = "BOOST — קוד קופון אחד, כולם מרוויחים";
const DESCRIPTION =
  "הפלטפורמה שמחברת עסקים חדשים למשפיענים: העסק משלם רק על מכירות, המשפיען מרוויח עמלה, הקונה מקבל הנחה.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  /*
   * Without these a shared link renders as a bare grey rectangle, and sharing
   * links is the entire mechanism of the product. The image itself is
   * generated in app/opengraph-image.tsx; Next wires it up by file name, and
   * these tags carry the words around it.
   */
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    locale: "he_IL",
    siteName: "BOOST",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
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

/*
 * Self-hosted rather than fetched from Google.
 *
 * Three <link>s to fonts.googleapis.com blocked first paint on every single
 * navigation: the browser cannot render text until that stylesheet arrives,
 * and only then does it start downloading the font files from a second host.
 * next/font builds them into our own bundle, so there is no third-party
 * round trip, no extra DNS and TLS, and no layout shift when the real face
 * finally lands.
 */
const rubik = Rubik({
  subsets: ["hebrew", "latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-rubik",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-jetbrains",
  display: "swap",
});

/**
 * An accessibility statement nobody can reach is not published, and תקנה 35
 * expects it to be. Every page carries these.
 */
const FOOTER_LINKS = [
  { href: "/legal/accessibility", label: "הצהרת נגישות" },
  { href: "/legal/terms", label: "תנאי שימוש" },
  { href: "/legal/influencer", label: "הסכם משפיען" },
  { href: "/legal/money", label: "מסלול הכסף" },
  { href: "/legal/privacy", label: "פרטיות" },
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  // One page view, counted after the response has gone out so the visitor
  // never waits on it. Per path per day, no visitor — the same shape as clicks.
  // The path arrives from middleware, which is the only place Next exposes it.
  const pathname = (await headers()).get("x-pathname");
  if (pathname && !pathname.startsWith("/_next") && !pathname.startsWith("/api")) {
    after(async () => {
      try {
        await (await getReadyStore()).recordPageView(pathname);
      } catch (e) {
        console.error("[BOOST] page view not recorded", e);
      }
    });
  }

  return (
    /*
     * The font variables belong on <html>, not <body>.
     *
     * Tailwind's @theme puts --font-sans and friends on :root, and those
     * definitions reference --font-rubik. A custom property resolves against
     * its own element, so with the variables declared on <body> — a child —
     * :root found nothing, the declaration became invalid, and every heading
     * on the site silently fell back to the system stack. The design is built
     * on Karantina; without it there is no design.
     */
    <html lang="he" dir="rtl" className={`${rubik.variable} ${mono.variable}`}>
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
              <Link href="/how-it-works" className={navLink}>
                איך זה עובד
              </Link>
              <Link href="/businesses" className={navLink}>
                העסקים שאיתנו
              </Link>
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
                  {user.isAdmin ? (
                    <Link
                      href="/admin"
                      className="rounded-md border-2 border-deal-deep bg-mark/30 px-3 py-1.5 text-sm font-bold text-ink transition hover:bg-mark/60"
                    >
                      ניהול מערכת
                    </Link>
                  ) : null}
                  <span className="hidden px-2 text-xs font-medium text-mut sm:inline">
                    {user.name} · {user.isAdmin ? "מנהל מערכת" : user.role === "business" ? "עסק" : "משפיען"}
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
          <div className="perforation pt-4">
            <nav
              aria-label="מידע משפטי ונגישות"
              className="flex flex-wrap items-center justify-center gap-x-1 text-xs"
            >
              {FOOTER_LINKS.map((l, i) => (
                <span key={l.href} className="flex items-center gap-1">
                  {i > 0 ? <span aria-hidden="true" className="text-mut">·</span> : null}
                  <Link
                    href={l.href}
                    className="rounded px-2 py-1.5 font-medium text-mut underline underline-offset-2 transition hover:text-ink"
                  >
                    {l.label}
                  </Link>
                </span>
              ))}
            </nav>
            <p className="mt-1 text-center text-xs text-mut">
              {isPersistent()
                ? "גרסה מוקדמת · חשבונות ומכירות נשמרים באמת. תוכן המסומן \u201cדוגמה\u201d אינו עסק אמיתי."
                : "גרסת דמו מקומית · הנתונים בזיכרון בלבד"}
            </p>
          </div>
        </footer>
        <AccessibilityMenu />
        <CookieNotice />
      </body>
    </html>
  );
}
