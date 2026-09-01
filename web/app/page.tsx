import Link from "next/link";
import { Card } from "@/components/ui";
import { computeSplit } from "@/lib/domain/logic";
import { formatILS } from "@/lib/format";

const exampleCampaign = { buyerDiscountPct: 10, influencerPct: 7, platformPct: 3 };

export default function Home() {
  const split = computeSplit(300, exampleCampaign);
  return (
    <div className="flex flex-col items-center py-8 text-center">
      <div className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-semibold text-emerald-300">
        🚧 MVP חי — אפשר להתנסות בכל המערכת עכשיו
      </div>
      <h1 className="mt-6 max-w-3xl text-4xl font-extrabold leading-tight sm:text-5xl">
        קוד קופון אחד.
        <br />
        <span className="grad-text">כולם מרוויחים.</span>
      </h1>
      <p className="mt-5 max-w-xl text-lg font-light leading-relaxed text-slate-400">
        עסקים חדשים מקבלים צבא של משווקים בלי לגייס אף עובד — ומשלמים רק כשמכירה קרתה
        בפועל. כל אחד יכול להיות משפיען ולהרוויח עמלה אמיתית מכל קנייה.
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          href="/login"
          className="rounded-xl bg-emerald-400 px-6 py-3 font-bold text-slate-900 transition hover:bg-emerald-300"
        >
          מתחילים — עסק או משפיען
        </Link>
        <Link
          href="/simulate"
          className="rounded-xl border border-white/15 px-6 py-3 font-semibold text-slate-200 transition hover:bg-white/10"
        >
          לנסות קנייה עם קוד
        </Link>
      </div>

      <div className="mt-14 grid w-full gap-4 sm:grid-cols-3">
        <Card>
          <div className="text-2xl">🏪</div>
          <h3 className="mt-2 font-bold">העסק מגדיר קמפיין</h3>
          <p className="mt-1 text-sm font-light leading-relaxed text-slate-400">
            קובע תקציב הטבה קבוע מכל מכירה — למשל 20% — שמתחלק בין הנחה, עמלה ודמי
            פלטפורמה. אפס עלות מראש.
          </p>
        </Card>
        <Card>
          <div className="text-2xl">📣</div>
          <h3 className="mt-2 font-bold">המשפיען מפיץ קוד אישי</h3>
          <p className="mt-1 text-sm font-light leading-relaxed text-slate-400">
            כל אחד יכול להצטרף, לקבל קוד ייחודי לכל קמפיין ולשתף אותו — בסטורי, בקבוצה,
            בכל מקום.
          </p>
        </Card>
        <Card>
          <div className="text-2xl">🛍️</div>
          <h3 className="mt-2 font-bold">הקונה מזין את הקוד</h3>
          <p className="mt-1 text-sm font-light leading-relaxed text-slate-400">
            מקבל הנחה מיידית בקופה. המכירה נרשמת, העמלה נזקפת למשפיען — הכול שקוף לכולם.
          </p>
        </Card>
      </div>

      <Card className="mt-10 w-full text-right">
        <h3 className="font-bold">כך מתחלקת קנייה של {formatILS(300)} בקמפיין לדוגמה (20%)</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-emerald-400/10 p-3">
            <div className="text-xs text-slate-400">הנחה לקונה (10%)</div>
            <div className="text-lg font-extrabold text-emerald-300">{formatILS(split.buyerDiscount)}</div>
          </div>
          <div className="rounded-xl bg-indigo-400/10 p-3">
            <div className="text-xs text-slate-400">עמלת משפיען (7%)</div>
            <div className="text-lg font-extrabold text-indigo-300">{formatILS(split.influencerCommission)}</div>
          </div>
          <div className="rounded-xl bg-white/5 p-3">
            <div className="text-xs text-slate-400">דמי פלטפורמה (3%)</div>
            <div className="text-lg font-extrabold">{formatILS(split.platformFee)}</div>
          </div>
          <div className="rounded-xl border border-white/10 p-3">
            <div className="text-xs text-slate-400">נשאר לעסק</div>
            <div className="text-lg font-extrabold">{formatILS(300 - split.businessTotalCost)}</div>
          </div>
        </div>
        <p className="mt-4 text-sm font-light text-slate-400">
          💡 משפיענים מצטיינים מטפסים מדרגה (כסף, זהב) ומקבלים בונוס עמלה — <b>על חשבון
          דמי הפלטפורמה שלנו, לא על חשבון העסק</b>. העלות לעסק תמיד קבועה וידועה מראש.
        </p>
      </Card>
    </div>
  );
}
