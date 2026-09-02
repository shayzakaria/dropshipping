import type { Business } from "@/lib/domain/types";

/**
 * A business's mark, with a fallback that is not an apology.
 *
 * Most businesses joining will not paste a logo URL on day one, and a grey
 * placeholder box would make the whole directory look abandoned. The fallback
 * is a price-sticker tile with the initials — it belongs to the design rather
 * than admitting something is missing.
 *
 * Logos are hotlinked from the business's own site, so the tag is deliberately
 * plain: no next/image, because that would proxy and cache someone else's
 * asset through our infrastructure. A broken URL simply shows nothing over the
 * tile, which still reads as intentional.
 */
export function BusinessLogo({ business, size = 56 }: { business: Business; size?: number }) {
  const initials = business.name
    .replace(/["'׳״]/g, "")
    .split(/[\s—–-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("");

  return (
    <span
      className="relative inline-flex flex-none -rotate-3 items-center justify-center overflow-hidden rounded-lg border-2 border-ink bg-mark font-display font-bold leading-none text-ink"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
      aria-hidden="true"
    >
      {initials}
      {business.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={business.logoUrl}
          alt=""
          className="absolute inset-0 h-full w-full bg-label object-contain"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      ) : null}
    </span>
  );
}
