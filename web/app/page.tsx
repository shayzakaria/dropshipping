import Link from "next/link";
import { Barcode } from "@/components/Barcode";
import { BagIcon, MegaphoneIcon, ScissorsIcon, StoreIcon } from "@/components/icons";
import { btnPrimary, btnStamp } from "@/components/ui";
import { computeSplit } from "@/lib/domain/logic";
import { formatILS } from "@/lib/format";

const exampleCampaign = { buyerDiscountPct: 10, influencerPct: 7, platformPct: 3 };
const EXAMPLE_ORDER = 300;

const steps = [
  {
    n: "1",
    icon: StoreIcon,
    title: "העסק מדביק מחיר למכירה",
    text: "קובע פעם אחת תקציב הטבה קבוע — למשל 20% מכל מכירה — שמתחלק בין הנחה, עמלה ודמי פלטפורמה. אפס עלות מראש.",
  },
  {
    n: "2",
    icon: MegaphoneIcon,
    title: "המשפיען מפיץ קוד אישי",
    text: "כל אחד יכול להצטרף לקמפיין, לקבל קוד ייחודי ולשתף אותו בסטורי, בטיקטוק או בקבוצת הוואטסאפ.",
  },
  {
    n: "3",
    icon: BagIcon,
    title: "הקונה מזין — כולם מרוויחים",
    text: "הנחה מיידית בקופה, עמלה למשפיען, מכירה חדשה לעסק. הכול נרשם אוטומטית ושקוף לכולם.",
  },
];

const tiers = [
  { label: "ברונזה", bonus: "עמלת הבסיס", sub: "עד 9 מכירות בחודש", ring: "#b87f4f" },
  { label: "כסף", bonus: "‎+1% בונוס", sub: "מ-10 מכירות בחודש", ring: "#a8a294" },
  { label: "זהב", bonus: "‎+2% בונוס", sub: "מ-30 מכירות בחודש", ring: "#d9a92c" },
];

export default function Home() {
  const split = computeSplit(EXAMPLE_ORDER, exampleCampaign);
  return (
    <div>
      {/* ויופורט ראשון: הטענה מימין, ההוכחה משמאל */}
      <section className="grid items-center gap-10 py-8 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <h1 className="font-display text-[3.3rem] leading-[1.02] sm:text-[5rem] sm:leading-[0.98]">
            <span className="whitespace-nowrap">קוד קופון אחד.</span>
            <br />
            <span className="mark-hl whitespace-nowrap">כולם מרוויחים.</span>
          </h1>
          <p className="mt-6 max-w-md text-lg font-light leading-relaxed text-mut">
            עסקים חדשים מקבלים צבא של משווקים בלי לגייס אף עובד — ומשלמים רק כשמכירה
            קרתה בפועל. כל אחד יכול להיות משפיען ולהרוויח עמלה אמיתית מכל קנייה.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/login" className={`${btnPrimary} px-6 py-3 text-base`}>
              מתחילים בחינם
            </Link>
            <Link href="/simulate" className={`${btnStamp} px-6 py-3 text-base`}>
              לנסות קנייה עם קוד
            </Link>
          </div>
          <p className="mt-4 text-sm text-mut">בלי כרטיס אשראי · בלי עלות התקנה · תשלום רק על מכירה</p>
        </div>

        {/* תווית הפיצול — ההדגמה של המנגנון */}
        <div className="relative mx-auto w-full max-w-md">
          <div className="split-label label-card relative p-0">
            <div className="tape absolute -top-3 right-10 h-7 w-24 -rotate-3" aria-hidden="true" />
            <div className="flex items-center justify-between gap-3 border-b-2 border-dashed border-ink/30 px-5 py-3">
              <div>
                <div className="text-[11px] font-semibold text-mut">קמפיין לדוגמה</div>
                <div className="text-sm font-bold">story layers · הדפסות תלת-ממד</div>
              </div>
              <div className="w-24 text-ink">
                <Barcode seed="NOA4K2PG" height={22} />
                <div className="mt-0.5 text-center font-mono text-[11px] font-semibold tracking-widest" dir="ltr">
                  NOA4-K2PG
                </div>
              </div>
            </div>
            <dl className="tabular px-5 py-4 text-sm">
              <div className="flex items-baseline justify-between py-1.5">
                <dt className="text-mut">סכום הקנייה</dt>
                <dd className="font-mono font-semibold" dir="ltr">{formatILS(EXAMPLE_ORDER)}</dd>
              </div>
              <div className="flex items-baseline justify-between py-1.5">
                <dt>
                  הנחה לקונה <span className="text-mut">(10%)</span>
                </dt>
                <dd className="font-mono font-semibold" dir="ltr">{formatILS(-split.buyerDiscount)}</dd>
              </div>
              <div className="flex items-baseline justify-between py-1.5">
                <dt>
                  עמלה למשפיענית <span className="text-mut">(7%)</span>
                </dt>
                <dd className="font-mono font-bold text-deal-deep" dir="ltr">{formatILS(split.influencerCommission)}</dd>
              </div>
              <div className="flex items-baseline justify-between py-1.5">
                <dt>
                  דמי פלטפורמה <span className="text-mut">(3%)</span>
                </dt>
                <dd className="font-mono font-semibold" dir="ltr">{formatILS(split.platformFee)}</dd>
              </div>
            </dl>
            <div className="perforation mx-5" aria-hidden="true" />
            <div className="flex items-baseline justify-between px-5 py-4">
              <span className="font-bold">העסק שילם {formatILS(split.businessTotalCost)}</span>
              <span className="text-sm text-mut">רק כי המכירה קרתה</span>
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-mut">
            נתוני הדגמה — כך נראית כל מכירה במערכת, שקופה לשלושת הצדדים
          </p>
        </div>
      </section>

      {/* איך זה עובד — מנשר אריזה אחד, לא גריד כרטיסים */}
      <section className="mt-14">
        <h2 className="font-display text-5xl leading-none">איך זה עובד</h2>
        <div className="label-card mt-5 divide-y divide-dashed divide-ink/25">
          {steps.map((s) => (
            <div key={s.n} className="flex items-start gap-4 p-5 sm:gap-6">
              <span className="tabular flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink pt-1 font-display text-2xl leading-none text-label">
                {s.n}
              </span>
              <div className="grow">
                <h3 className="text-lg font-bold">{s.title}</h3>
                <p className="mt-1 max-w-xl text-sm font-light leading-relaxed text-mut">{s.text}</p>
              </div>
              <s.icon className="mt-1 hidden h-7 w-7 shrink-0 text-deal-deep sm:block" />
            </div>
          ))}
        </div>
      </section>

      {/* מדרגות — הבונוס על חשבוננו */}
      <section className="mt-14 grid items-center gap-8 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <h2 className="font-display text-5xl leading-none">
            משפיענים מצטיינים מטפסים —<br />
            <span className="mark-hl">על החשבון שלנו</span>
          </h2>
          <p className="mt-4 max-w-md text-base font-light leading-relaxed text-mut">
            ככל שמביאים יותר מכירות בחודש, העמלה עולה. הבונוס יורד מדמי הפלטפורמה שלנו —
            לא מהעסק. העלות לעסק נשארת קבועה וידועה מראש, תמיד.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-5">
          {tiers.map((t, i) => (
            <div
              key={t.label}
              className="label-card flex h-40 w-40 flex-col items-center justify-center rounded-full text-center"
              style={{ borderColor: t.ring, borderWidth: 3, rotate: `${[-3, 2, -2][i]}deg` }}
            >
              <div className="font-display text-4xl leading-none">{t.label}</div>
              <div className="mt-1 text-sm font-bold text-deal-deep">{t.bonus}</div>
              <div className="mt-1 px-3 text-xs text-mut">{t.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* סגירה — פס כתום מחויב */}
      <section className="mt-16 overflow-hidden rounded-xl bg-deal">
        <div className="flex items-center gap-2 border-b-2 border-dashed border-ink/40 px-6 py-2 text-ink">
          <ScissorsIcon className="h-4 w-4" />
          <span className="text-xs font-semibold">גזרו כאן</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-6 px-6 py-10 sm:px-10">
          <div>
            <h2 className="font-display text-6xl leading-none text-ink">
              מדביקים את המדבקה הראשונה?
            </h2>
            <p className="mt-2 max-w-md text-sm font-medium text-ink">
              פתיחת עסק או חשבון משפיען לוקחת דקה. אפשר גם רק לשחק בסימולטור ולראות
              איך הכסף מתחלק.
            </p>
          </div>
          <Link
            href="/login"
            className="rounded-lg bg-ink px-8 py-4 text-lg font-bold text-label transition hover:bg-ink/85"
          >
            פותחים חשבון
          </Link>
        </div>
      </section>
    </div>
  );
}
