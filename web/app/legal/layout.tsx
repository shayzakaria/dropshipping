import Link from "next/link";
import type { ReactNode } from "react";

const PAGES = [
  { href: "/legal/accessibility", label: "הצהרת נגישות" },
  { href: "/legal/terms", label: "תנאי שימוש" },
  { href: "/legal/influencer", label: "הסכם משפיען" },
  { href: "/legal/privacy", label: "פרטיות" },
];

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl">
      <nav aria-label="מסמכים משפטיים" className="mb-6 flex flex-wrap gap-2">
        {PAGES.map((p) => (
          <Link
            key={p.href}
            href={p.href}
            className="rounded-lg border border-ink/25 bg-label px-3 py-2 text-sm font-semibold text-ink transition hover:bg-paper"
          >
            {p.label}
          </Link>
        ))}
      </nav>
      <article className="legal-prose">{children}</article>
    </div>
  );
}
