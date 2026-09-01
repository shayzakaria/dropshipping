import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { CampaignForm } from "./CampaignForm";

export const dynamic = "force-dynamic";

export default async function NewCampaignPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "business") redirect("/login");
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-6xl leading-none">קמפיין חדש</h1>
      <p className="mt-2 text-sm text-mut">
        מגדירים פעם אחת כמה שווה לכם מכירה — ומשלמים רק כשהיא קורית.
      </p>
      <Card className="mt-5">
        <CampaignForm />
      </Card>
    </div>
  );
}
