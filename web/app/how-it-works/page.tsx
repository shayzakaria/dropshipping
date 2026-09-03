import Link from "next/link";
import type { Metadata } from "next";
import { Card, SectionTitle } from "@/components/ui";
import { COMMISSION_HOLD_DAYS, PLATFORM_PCT, RECOMMENDED_PAYOUT_ILS } from "@/lib/domain/logic";
import { formatILS } from "@/lib/format";

export const metadata: Metadata = {
  title: "איך זה עובד | BOOST",
  description: "איך מונפק קוד קופון, איך הכסף מתחלק, ומתי כל צד מקבל אותו.",
};

/**
 * The page that answers the questions people ask before they trust us with
 * money: who makes the code, who pays whom, and when.
 *
 * Worked through one concrete sale rather than described in the abstract.
 * "The business sets a benefit budget which is divided three ways" is true
 * and tells nobody anything; ₪300 becoming ₪30, ₪21 and ₪9 is the same
 * sentence and people can check it.
 */

const EXAMPLE = 300;
const DISCOUNT = 10;
const COMMISSION = 7;

export default function HowItWorksPage() {
  const discount = (EXAMPLE * DISCOUNT) / 100;
  const commission = (EXAMPLE * COMMISSION) / 100;
  const platform = (EXAMPLE * PLATFORM_PCT) / 100;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-6xl leading-none">איך זה עובד</h1>
      <p className="mt-2 max-w-2xl text-sm font-light leading-relaxed text-mut">
        שני דברים שכדאי להבין לפני שמתחילים: איך נולד קוד הקופון, ואיך הכסף זז.
        שניהם פשוטים יותר ממה שנדמה.
      </p>

      {/* ---------------- coupon issuance ---------------- */}
      <SectionTitle>איך מונפק קוד קופון</SectionTitle>
      <Card>
        <p className="text-sm font-medium leading-relaxed">
          הנקודה שהכי מבלבלת: <strong>הקודים נוצרים בחנות של העסק, לא אצלנו.</strong>{" "}
          העסק מייצר מראש מלאי קודים במערכת החנות שלו ומדביק אותם כאן; אנחנו מחלקים{" "}
          <strong>קוד אחד לכל משפיען</strong>. לכן הקוד עובד בקופה — החנות היא זו
          שיצרה אותו.
        </p>
        <ol className="mt-4 space-y-3">
          {[
            {
              n: 1,
              who: "העסק",
              t: "מייצר קודים בחנות שלו ופותח קמפיין",
              d: "מייצר במערכת החנות מלאי קודי הנחה (למשל 40 קודים), מדביק אותם אצלנו, ובוחר כמה הנחה לקונה וכמה עמלה למשפיען. אלה המספרים שלו — לא שלנו.",
            },
            {
              n: 2,
              who: "העסק",
              t: "בודק שקוד אחד באמת עובד",
              d: "לפני שהקמפיין מתפרסם, העסק מנסה קוד אחד בקופה של עצמו ומאשר. קמפיין שלא נבדק לא מוצג למשפיענים בכלל — משפיען לא אמור לגלות בשידור חי שהקוד לא תקין.",
            },
            {
              n: 3,
              who: "המשפיען",
              t: "מצטרף בלחיצה",
              d: "רואה את הקמפיין ברשימה, רואה בדיוק כמה ירוויח, ומצטרף. ברגע הזה המערכת מוציאה מהמלאי קוד אחד ומשייכת אותו אליו בלבד.",
            },
            {
              n: 4,
              who: "המשפיען",
              t: "משתף את הקוד",
              d: "בסטורי, בפוסט, בוואטסאפ. יש גם לינק אישי שמוביל לחנות עם הקוד כבר מוכן, וסופר כמה אנשים לחצו.",
            },
            {
              n: 5,
              who: "הקונה",
              t: "מזין את הקוד בקופה",
              d: "בחנות של העסק, כרגיל. מקבל את ההנחה מיד.",
            },
            {
              n: 6,
              who: "החנות",
              t: "מדווחת לנו על המכירה",
              d: "אוטומטית, ברגע התשלום. אנחנו מחשבים את החלוקה ורושמים אותה. העסק לא מדווח ידנית ולא יכול לשכוח.",
            },
          ].map((s) => (
            <li key={s.n} className="flex gap-3">
              <span className="inline-flex h-7 w-7 flex-none items-center justify-center rounded-full bg-ink font-mono text-sm font-bold text-label">
                {s.n}
              </span>
              <span>
                <span className="block text-sm font-bold">
                  {s.t} <span className="font-normal text-mut">· {s.who}</span>
                </span>
                <span className="mt-0.5 block text-sm font-light leading-relaxed text-mut">{s.d}</span>
              </span>
            </li>
          ))}
        </ol>
      </Card>

      {/* ---------------- the money ---------------- */}
      <SectionTitle>איך הכסף מתחלק</SectionTitle>
      <Card>
        <p className="text-sm font-light leading-relaxed text-mut">
          העסק קובע <strong className="font-bold text-ink">תקציב הטבה</strong> מכל מכירה.
          התקציב מתחלק לשלושה, והחלק שלנו קבוע על {PLATFORM_PCT}%. דוגמה למכירה של{" "}
          {formatILS(EXAMPLE)} בקמפיין של {DISCOUNT}% הנחה ו-{COMMISSION}% עמלה:
        </p>

        <div className="mt-4 overflow-hidden rounded-lg border-2 border-ink">
          <div className="flex items-baseline justify-between gap-2 border-b-2 border-dashed border-ink/30 bg-label px-4 py-3">
            <span className="text-sm font-medium">הקונה שילם בחנות</span>
            <span className="font-mono text-lg font-bold tabular-nums">{formatILS(EXAMPLE - discount)}</span>
          </div>
          {[
            { label: `הנחה לקונה · ${DISCOUNT}%`, v: discount, who: "יורד מהמחיר בקופה" },
            { label: `עמלה למשפיען · ${COMMISSION}%`, v: commission, who: "העסק חייב למשפיען" },
            { label: `דמי פלטפורמה · ${PLATFORM_PCT}%`, v: platform, who: "העסק חייב לנו" },
          ].map((r) => (
            <div key={r.label} className="flex items-baseline justify-between gap-2 border-b border-ink/10 bg-label px-4 py-2.5">
              <span className="text-sm">
                {r.label}
                <span className="block text-xs text-mut">{r.who}</span>
              </span>
              <span className="font-mono tabular-nums">{formatILS(r.v)}</span>
            </div>
          ))}
          <div className="flex items-baseline justify-between gap-2 bg-mark/30 px-4 py-3">
            <span className="text-sm font-bold">
              סך העלות לעסק
              <span className="block text-xs font-normal text-mut">
                {DISCOUNT + COMMISSION + PLATFORM_PCT}% מהמכירה — ידוע מראש, לא משתנה
              </span>
            </span>
            <span className="font-mono text-lg font-bold tabular-nums">
              {formatILS(discount + commission + platform)}
            </span>
          </div>
        </div>

        <p className="mt-4 rounded-lg border border-ink/25 bg-paper p-3 text-sm leading-relaxed">
          <strong>מדרגות המשפיענים לא עולות לעסק שקל.</strong> משפיען שמוכר הרבה עולה
          מדרגה ומקבל בונוס — והבונוס יורד <strong>מהחלק שלנו</strong>. העלות לעסק
          נשארת בדיוק אותו אחוז.
        </p>
      </Card>

      {/* ---------------- timing ---------------- */}
      <SectionTitle>מתי הכסף מגיע</SectionTitle>
      <Card>
        <p className="text-sm font-light leading-relaxed text-mut">
          עמלה לא משולמת ברגע המכירה, וזו לא בירוקרטיה — זו הגנה על שני הצדדים.
        </p>
        <ol className="mt-4 space-y-3">
          {[
            {
              t: "יום 0 — המכירה נרשמת",
              d: "העמלה שלך נצברת ומופיעה בדשבורד בתור ״ממתין לשחרור״. היא כבר שלך, אבל עוד לא ניתנת למשיכה.",
            },
            {
              t: `${COMMISSION_HOLD_DAYS} הימים הבאים — חלון הביטול`,
              d: `לפי חוק הגנת הצרכן, לקונה יש ${COMMISSION_HOLD_DAYS} ימים לבטל עסקה מרחוק ולהחזיר את המוצר. אם ההזמנה חוזרת — לא הייתה מכירה, והעמלה מתבטלת. תראה את התאריך והסיבה.`,
            },
            {
              t: `יום ${COMMISSION_HOLD_DAYS} — הכסף משתחרר`,
              d: "העמלה עוברת ל״זמין למשיכה״. מכאן היא שלך סופית; החזרה מאוחרת יותר כבר לא נוגעת בה.",
            },
            {
              t: "מכאן אפשר למשוך — בכל סכום",
              d: `אין סף מינימום ואין כסף כלוא: מה שהשתחרר הוא שלך, וניתן לבקש אותו גם אם מדובר בעשרה שקלים. ההמלצה שלנו היא לחכות לסביבות ${formatILS(RECOMMENDED_PAYOUT_ILS)}, כי עמלת ההעברה של הבנק זהה בסכום קטן ובגדול — אבל זו המלצה, לא כלל.`,
            },
          ].map((s, i) => (
            <li key={s.t} className="flex gap-3">
              <span className="mt-1 inline-flex h-3 w-3 flex-none rounded-full border-2 border-ink bg-mark" aria-hidden="true" />
              <span>
                <span className="block text-sm font-bold">{s.t}</span>
                <span className="mt-0.5 block text-sm font-light leading-relaxed text-mut">{s.d}</span>
              </span>
              {i < 3 ? null : null}
            </li>
          ))}
        </ol>
      </Card>

      {/* ---------------- what each side has to do ---------------- */}
      <SectionTitle>מה צריך לעשות</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <h2 className="font-display text-3xl leading-none">משפיען</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {[
              ["להירשם", "שם ואימייל. זהו."],
              ["להצטרף לקמפיין", "ולקבל קוד אישי."],
              ["לשתף", "עם גילוי ״פרסומת״ — אנחנו כותבים אותו בשבילך בכל הודעת שיתוף."],
              ["למשוך כסף", "פרטי ההעברה נדרשים רק כשיש עמלה משוחררת. אין סכום מינימום."],
            ].map(([t, d]) => (
              <li key={t}>
                <span className="font-bold">{t}</span>
                <span className="block text-xs font-light leading-relaxed text-mut">{d}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-mut">
            העמלה היא הכנסה עסקית, ובאחריותך לדווח עליה. פירוט ב
            <Link href="/legal/influencer" className="font-semibold text-deal-deep underline underline-offset-2">
              הסכם המשפיען
            </Link>
            .
          </p>
        </Card>
        <Card>
          <h2 className="font-display text-3xl leading-none">עסק</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {[
              ["להירשם ולתאר את העסק", "שתי שורות ולוגו — זה הכרטיס שלך בקטלוג."],
              ["לפתוח קמפיין", "אתה בוחר את ההנחה ואת העמלה. אין מספר קבוע."],
              ["לחבר את החנות", "שורת קוד אחת בקופה, ומכירות נרשמות לבד."],
              ["לשלם רק על מכירות", "אפס עלות מראש. אם לא נמכר — לא שילמת."],
            ].map(([t, d]) => (
              <li key={t}>
                <span className="font-bold">{t}</span>
                <span className="block text-xs font-light leading-relaxed text-mut">{d}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-mut">
            הופעה בקטלוג חינם. אנחנו מרוויחים כשאתה מוכר, אז אין לנו סיבה לגבות ממך על
            להיראות.
          </p>
        </Card>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/login" className="inline-flex min-h-11 items-center rounded-lg bg-deal px-5 text-sm font-bold text-ink transition hover:bg-[#ff5a17]">
          פתיחת חשבון
        </Link>
        <Link href="/simulate" className="inline-flex min-h-11 items-center rounded-lg border border-ink/25 bg-label px-5 text-sm font-bold transition hover:bg-paper">
          לנסות קנייה עם קוד
        </Link>
      </div>
    </div>
  );
}
