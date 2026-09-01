import { Card } from "@/components/ui";
import { getReadyStore, isDemoMode } from "@/lib/store";
import { SimulatorForm } from "./SimulatorForm";

export const dynamic = "force-dynamic";

export default async function SimulatePage() {
  // Pre-fill a working code only over demo data. Over real data this would
  // hand any visitor a live influencer's code.
  const demo = isDemoMode();
  let demoCode: string | undefined;
  if (demo) {
    const store = await getReadyStore();
    for (const c of await store.listActiveCampaigns()) {
      const codes = await store.listCodesByCampaign(c.id);
      if (codes.length > 0) {
        demoCode = codes[0].code;
        break;
      }
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="font-display text-6xl leading-none">סימולטור קנייה</h1>
      <p className="mt-2 text-sm font-light leading-relaxed text-mut">
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
