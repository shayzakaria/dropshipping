/**
 * Says plainly that these documents have not been through a lawyer yet.
 *
 * Publishing terms that look final while they are not is worse than publishing
 * nothing: a business or an influencer would be relying on them. It comes down
 * the moment the review is done.
 */
export function DraftNotice() {
  return (
    <div className="callout" role="note">
      <p className="!mt-0">
        <strong>טיוטה.</strong> המסמך טרם עבר בדיקה של עורך דין. הוא מתאר במדויק את
        אופן הפעולה של המערכת בפועל, אך אינו מהווה ייעוץ משפטי ועשוי להשתנות לפני
        ההשקה הרחבה.
      </p>
    </div>
  );
}
