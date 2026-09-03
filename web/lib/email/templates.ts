import { formatILS } from "../format";
import type { NotificationKind } from "../domain/types";

/**
 * What each notification says.
 *
 * Rules these follow, because an email about someone's money is read once and
 * has to answer everything in that one reading:
 *
 * - The number is in the subject line. Most of these are read in a phone's
 *   notification shade and nowhere else.
 * - Nothing is promised that the platform does not control. "14 days" is our
 *   rule so it is stated; "the money will arrive Tuesday" depends on a bank.
 * - Bad news is as clear as good news. A cancelled commission says the amount
 *   and the reason, because the alternative is the influencer discovering a
 *   smaller balance and not knowing why.
 * - No marketing, no upsell, no "check out our other campaigns".
 */

export interface Template {
  subject: string;
  text: string;
}

const sign = (siteUrl: string) =>
  `\n\n—\nBOOST\n${siteUrl}\n\nלהפסקת ההודעות האלה: ${siteUrl}/settings/notifications`;

export const templates = {
  sale: (p: { name: string; amount: number; businessName: string; siteUrl: string }): Template => ({
    subject: `עשית מכירה — ${formatILS(p.amount)} עמלה`,
    text:
      `${p.name}, מישהו קנה ב"${p.businessName}" עם הקוד שלך.\n\n` +
      `העמלה שלך: ${formatILS(p.amount)}.\n\n` +
      `היא תהיה זמינה למשיכה בעוד 14 יום — זה חלון הביטול של הקונה לפי חוק. ` +
      `אם ההזמנה תחזור, העמלה תתבטל ונעדכן אותך.` +
      sign(p.siteUrl),
  }),

  commission_released: (p: { name: string; amount: number; count: number; siteUrl: string }): Template => ({
    subject: `${formatILS(p.amount)} זמינים למשיכה`,
    text:
      `${p.name}, ${p.count === 1 ? "עמלה אחת עברה" : `${p.count} עמלות עברו`} את חלון הביטול, ` +
      `ו-${formatILS(p.amount)} זמינים לך למשיכה עכשיו.\n\n` +
      `אין סכום מינימום — אפשר לבקש כל סכום, בכל רגע.\n\n` +
      `לבקשת משיכה: ${p.siteUrl}/dashboard` +
      sign(p.siteUrl),
  }),

  commission_cancelled: (p: {
    name: string;
    amount: number;
    businessName: string;
    reason: string;
    siteUrl: string;
  }): Template => ({
    subject: `עמלה בוטלה — ${formatILS(p.amount)}`,
    text:
      `${p.name}, מכירה שהבאת ל"${p.businessName}" בוטלה, ולכן העמלה עליה — ` +
      `${formatILS(p.amount)} — מתבטלת.\n\n` +
      `הסיבה שנרשמה: ${p.reason}.\n\n` +
      `זה לא משפיע על שאר העמלות שלך. הפירוט המלא בדשבורד: ${p.siteUrl}/dashboard` +
      sign(p.siteUrl),
  }),

  payout_paid: (p: { name: string; amount: number; note?: string; siteUrl: string }): Template => ({
    subject: `העברנו לך ${formatILS(p.amount)}`,
    text:
      `${p.name}, בקשת המשיכה שלך על ${formatILS(p.amount)} בוצעה והכסף בדרך לחשבון שלך.\n\n` +
      (p.note ? `אסמכתא: ${p.note}\n\n` : "") +
      `העברה בנקאית לוקחת בדרך כלל יום עסקים אחד עד שלושה.` +
      sign(p.siteUrl),
  }),

  influencer_joined: (p: {
    businessName: string;
    influencerName: string;
    campaignTitle: string;
    codesLeft: number;
    siteUrl: string;
  }): Template => ({
    subject: `${p.influencerName} הצטרף לקמפיין שלך`,
    text:
      `${p.influencerName} הצטרף ל"${p.campaignTitle}" וקיבל קוד אישי מהמאגר שהעלית.\n\n` +
      `נשארו ${p.codesLeft} קודים פנויים בקמפיין.\n\n` +
      `הדשבורד: ${p.siteUrl}/dashboard` +
      sign(p.siteUrl),
  }),

  pool_low: (p: { campaignTitle: string; codesLeft: number; siteUrl: string }): Template => ({
    subject: `נשארו ${p.codesLeft} קודים ב"${p.campaignTitle}"`,
    text:
      `המאגר של "${p.campaignTitle}" מתרוקן — נשארו ${p.codesLeft} קודים פנויים.\n\n` +
      `כשהוא יתרוקן, משפיענים חדשים לא יוכלו להצטרף לקמפיין. ` +
      `כדי להוסיף: צרו עוד קודי הנחה במערכת החנות שלכם והדביקו אותם בדשבורד.\n\n` +
      `${p.siteUrl}/dashboard` +
      sign(p.siteUrl),
  }),

  statement_issued: (p: {
    businessName: string;
    total: number;
    commissions: number;
    platformFees: number;
    period: string;
    salesCount: number;
    siteUrl: string;
  }): Template => ({
    subject: `החשבון של ${p.period} — ${formatILS(p.total)}`,
    text:
      `${p.businessName}, זה החשבון על ${p.period}, על ${p.salesCount} מכירות שהושלמו.\n\n` +
      `עמלות למשפיענים: ${formatILS(p.commissions)}\n` +
      `דמי פלטפורמה: ${formatILS(p.platformFees)}\n` +
      `סך הכל: ${formatILS(p.total)}\n\n` +
      `מתוך הסכום הזה אנחנו משלמים למשפיענים שלך. ` +
      `רק מכירות שעברו את חלון הביטול של 14 יום נכללות — מכירה שעדיין בתוכו תופיע בחשבון הבא.\n\n` +
      `הפירוט: ${p.siteUrl}/dashboard` +
      sign(p.siteUrl),
  }),
} satisfies Record<NotificationKind, (p: never) => Template>;
