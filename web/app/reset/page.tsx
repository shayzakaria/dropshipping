import Link from "next/link";
import type { Metadata } from "next";
import { Card } from "@/components/ui";
import { isAuthConfigured } from "@/lib/supabase-auth";
import { ResetRequestForm } from "./ResetRequestForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "שכחתי סיסמה | BOOST" };

export default function ResetPage() {
  return (
    <div className="mx-auto max-w-md">
      <Card>
        <h1 className="font-display text-4xl leading-none">שכחתי סיסמה</h1>
        <p className="mt-2 text-sm font-light leading-relaxed text-mut">
          נשלח קישור לבחירת סיסמה חדשה. הקישור תקף לשעה ולשימוש אחד.
        </p>
        <div className="mt-4">
          {isAuthConfigured() ? (
            <ResetRequestForm />
          ) : (
            <p className="text-sm text-mut">איפוס סיסמה יהיה זמין כשהכניסה עם סיסמה תיפתח.</p>
          )}
        </div>
        <p className="mt-4 text-sm">
          <Link href="/login" className="font-semibold text-deal-deep underline underline-offset-2">
            ← חזרה לכניסה
          </Link>
        </p>
      </Card>
    </div>
  );
}
