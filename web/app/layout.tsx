import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth";
import { logout } from "./actions";
import { btnGhost } from "@/components/ui";

export const metadata: Metadata = {
  title: "BOOST — קוד קופון אחד, כולם מרוויחים",
  description:
    "הפלטפורמה שמחברת עסקים חדשים למשפיענים: העסק משלם רק על מכירות, המשפיען מרוויח עמלה, הקונה מקבל הנחה.",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <html lang="he" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;600;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <header className="border-b border-white/10">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
            <Link href="/" className="text-xl font-extrabold tracking-tight">
              BOOST<span className="grad-text">✦</span>
              <span className="mr-2 align-middle text-[10px] font-semibold text-slate-500">שם זמני · דמו</span>
            </Link>
            <nav className="flex items-center gap-2 text-sm">
              <Link href="/campaigns" className="rounded-lg px-3 py-1.5 text-slate-300 hover:bg-white/10">
                קמפיינים
              </Link>
              <Link href="/simulate" className="rounded-lg px-3 py-1.5 text-slate-300 hover:bg-white/10">
                סימולטור קנייה
              </Link>
              {user ? (
                <>
                  <Link href="/dashboard" className="rounded-lg px-3 py-1.5 text-slate-300 hover:bg-white/10">
                    הדשבורד שלי
                  </Link>
                  <span className="hidden text-xs text-slate-400 sm:inline">
                    {user.name} · {user.role === "business" ? "עסק" : "משפיען"}
                  </span>
                  <form action={logout}>
                    <button className={btnGhost}>יציאה</button>
                  </form>
                </>
              ) : (
                <Link href="/login" className={btnGhost}>
                  כניסה
                </Link>
              )}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        <footer className="mx-auto max-w-5xl px-4 pb-8 pt-4 text-center text-xs text-slate-500">
          MVP דמו — הנתונים נשמרים בזיכרון ומתאפסים בפריסה מחדש · חיבור Supabase בהמשך
        </footer>
      </body>
    </html>
  );
}
