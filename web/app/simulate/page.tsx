import { Card } from "@/components/ui";
import { getReadyStore } from "@/lib/store";
import { SimulatorForm } from "./SimulatorForm";

export const dynamic = "force-dynamic";

export default async function SimulatePage() {
  // Surface a real seeded code so visitors can try the flow instantly
  const store = await getReadyStore();
  const campaigns = await store.listActiveCampaigns();
  let demoCode: string | undefined;
  for (const c of campaigns) {
    const codes = await store.listCodesByCampaign(c.id);
    if (codes.length > 0) {
      demoCode = codes[0].code;
      break;
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-extrabold">סימולטור קנייה 🛒</h1>
      <p className="mt-1 text-sm font-light leading-relaxed text-slate-400">
        זה בדיוק מה שהחנות של העסק תעשה בקופה דרך ה-API: לאמת קוד, לחשב את החלוקה ולרשום
        את המכירה. נסו גם מקרים שנדחים — קוד שגוי, קנייה עצמית של משפיען, או לקוח חוזר
        בקמפיין שמיועד ללקוחות חדשים.
      </p>
      <Card className="mt-5">
        <SimulatorForm demoCode={demoCode} />
      </Card>
    </div>
  );
}
