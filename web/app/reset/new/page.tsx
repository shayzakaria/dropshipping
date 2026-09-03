import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui";
import { getAuthClient, isAuthConfigured } from "@/lib/supabase-auth";
import { NewPasswordForm } from "./NewPasswordForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "סיסמה חדשה | BOOST", robots: { index: false, follow: false } };

export default async function NewPasswordPage() {
  // Reached only while holding the recovery session the callback established.
  let ready = false;
  if (isAuthConfigured()) {
    const { data } = await (await getAuthClient()).auth.getUser();
    ready = Boolean(data.user);
  }

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <h1 className="font-display text-4xl leading-none">סיסמה חדשה</h1>
        {ready ? (
          <>
            <p className="mt-2 text-sm font-light leading-relaxed text-mut">
              בחרו סיסמה חדשה. אחרי השמירה תיכנסו אוטומטית.
            </p>
            <div className="mt-4">
              <NewPasswordForm />
            </div>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm leading-relaxed text-mut">
              הקישור פג, כבר נוצל, או נפתח בדפדפן אחר מזה שביקש אותו. אפשר לבקש קישור חדש.
            </p>
            <Link
              href="/reset"
              className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-ink px-4 text-sm font-bold text-label transition hover:bg-ink/85"
            >
              בקשת קישור חדש
            </Link>
          </>
        )}
      </Card>
    </div>
  );
}
