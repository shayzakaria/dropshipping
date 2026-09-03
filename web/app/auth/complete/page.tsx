import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Card } from "@/components/ui";
import { getReadyStore } from "@/lib/store";
import { getAuthClient, isAuthConfigured } from "@/lib/supabase-auth";
import { CompleteProfileForm } from "./CompleteProfileForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "עוד דבר אחד | BOOST", robots: { index: false, follow: false } };

/**
 * The step Google cannot answer: what did you come here to do?
 *
 * Google gives us an identity. It does not say whether this person is a shop
 * or someone who wants to promote one, and the dashboard is a different
 * product for each.
 */
export default async function CompleteProfilePage() {
  if (!isAuthConfigured()) redirect("/login");
  const { data } = await (await getAuthClient()).auth.getUser();
  if (!data.user) redirect("/login");

  const store = await getReadyStore();
  if (await store.getUserByAuthId(data.user.id)) redirect("/dashboard");

  const suggested =
    (data.user.user_metadata?.full_name as string | undefined) ??
    data.user.email?.split("@")[0] ??
    "";

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <h1 className="font-display text-4xl leading-none">עוד דבר אחד</h1>
        <p className="mt-2 text-sm font-light leading-relaxed text-mut">
          נכנסת בתור <span className="font-mono text-ink" dir="ltr">{data.user.email}</span>. רק צריך
          לדעת מה הבאת אותך לכאן.
        </p>
        <div className="mt-4">
          <CompleteProfileForm suggestedName={suggested} />
        </div>
      </Card>
    </div>
  );
}
