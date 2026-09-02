import { toggleFollow } from "@/app/actions";

/**
 * "עוקב/ת" on a directory card. A form, not a client toggle: it works without
 * JavaScript, and the server decides who may follow whom.
 */
export function FollowButton({
  businessId,
  following,
  followers,
}: {
  businessId: string;
  following: boolean;
  followers: number;
}) {
  return (
    <form action={toggleFollow.bind(null, businessId)} className="inline-flex items-center gap-2">
      <input type="hidden" name="intent" value={following ? "unfollow" : "follow"} />
      <button
        className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg border px-3 text-sm font-semibold transition ${
          following ? "border-deal bg-mark/30 text-ink" : "border-ink/25 bg-label text-ink hover:bg-paper"
        }`}
        aria-pressed={following}
      >
        {following ? "עוקב/ת ✓" : "לעקוב אחרי העסק"}
      </button>
      {followers > 0 ? (
        <span className="text-xs text-mut">
          {followers} {followers === 1 ? "עוקב" : "עוקבים"}
        </span>
      ) : null}
    </form>
  );
}
