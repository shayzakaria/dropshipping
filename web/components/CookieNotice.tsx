"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * A notice, deliberately not a consent dialog.
 *
 * This site sets one cookie: the one that keeps you signed in. There is no
 * analytics, no advertising pixel, no cross-site tracking — so there is
 * nothing to ask permission for, and strictly necessary cookies do not
 * require consent in the first place.
 *
 * Building the usual "accept / manage preferences" pantomime over a single
 * session cookie would be theatre: it would imply we collect things we do
 * not, train people to dismiss a box that never had a real choice in it, and
 * cost every visitor a click. So this says what we store, once, and goes away.
 *
 * If analytics is ever added, this must become a real consent gate that
 * blocks the script until the visitor agrees. Until then, honesty is shorter.
 */

const STORAGE_KEY = "boost-cookie-notice-seen";

export function CookieNotice() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setShow(true);
    } catch {
      // Storage blocked — skip the notice rather than show it every page load
    }
  }, []);

  const dismiss = () => {
    setShow(false);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Nothing to do
    }
  };

  if (!show) return null;

  return (
    <div
      role="region"
      aria-label="הודעה על עוגיות"
      className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-ink bg-label"
    >
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 ps-22">
        <p className="max-w-2xl text-xs leading-relaxed text-ink">
          האתר שומר <strong>עוגייה אחת בלבד</strong> — זו ששומרת אתכם מחוברים. אין אצלנו
          עוגיות פרסום, אין מדידת גולשים ואין מעקב בין אתרים, ולכן אין כאן מה לאשר.{" "}
          <Link href="/legal/privacy" className="font-semibold text-deal-deep underline underline-offset-2">
            מדיניות הפרטיות
          </Link>
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="inline-flex min-h-11 items-center rounded-lg bg-ink px-4 text-sm font-bold text-label transition hover:bg-ink/85"
        >
          הבנתי
        </button>
      </div>
    </div>
  );
}
