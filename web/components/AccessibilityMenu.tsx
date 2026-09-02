"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * The accessibility menu required alongside the statement under תקנה 35.
 *
 * Written here rather than bought as an overlay script. Third-party overlays
 * add a toolbar and claim compliance, but they layer ARIA over markup they do
 * not understand and are widely reported by screen-reader users to make sites
 * worse. Every control below changes our own CSS, and the underlying pages
 * already pass axe without any of it — this is for people who need to adjust
 * how the site looks to them, not a patch over a site that does not work.
 *
 * Choices persist per browser in localStorage, because someone who needs
 * larger text needs it on every visit, not once.
 */

const STORAGE_KEY = "boost-a11y";

interface Settings {
  /** 100 = as designed. Steps of 12.5% up to 150%. */
  textScale: number;
  contrast: boolean;
  underlineLinks: boolean;
  stopMotion: boolean;
  readableFont: boolean;
}

const DEFAULTS: Settings = {
  textScale: 100,
  contrast: false,
  underlineLinks: false,
  stopMotion: false,
  readableFont: false,
};

function apply(s: Settings) {
  const el = document.documentElement;
  el.style.setProperty("--a11y-text-scale", `${s.textScale}%`);
  el.toggleAttribute("data-a11y-contrast", s.contrast);
  el.toggleAttribute("data-a11y-underline", s.underlineLinks);
  el.toggleAttribute("data-a11y-stop-motion", s.stopMotion);
  el.toggleAttribute("data-a11y-readable", s.readableFont);
}

function read(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    // Private browsing, blocked storage, corrupted value — the site still works
    return DEFAULTS;
  }
}

export function AccessibilityMenu() {
  const [open, setOpen] = useState(false);
  const [s, setS] = useState<Settings>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = read();
    setS(stored);
    apply(stored);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    apply(s);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch {
      // Nothing to do; the setting still applies for this visit.
    }
  }, [s, ready]);

  // Escape closes, the way every dialog should
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((p) => ({ ...p, [k]: v }));

  const toggleRow = (
    label: string,
    key: "contrast" | "underlineLinks" | "stopMotion" | "readableFont",
  ) => (
    <button
      type="button"
      role="switch"
      aria-checked={s[key]}
      onClick={() => set(key, !s[key])}
      className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-start text-sm font-semibold transition ${
        s[key] ? "border-deal bg-mark/30 text-ink" : "border-ink/25 bg-label text-ink hover:bg-paper"
      }`}
    >
      {label}
      <span
        aria-hidden="true"
        className={`inline-flex h-6 w-10 flex-none items-center rounded-full p-0.5 transition ${
          s[key] ? "justify-end bg-deal-deep" : "justify-start bg-ink/25"
        }`}
      >
        <span className="h-5 w-5 rounded-full bg-label" />
      </span>
    </button>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="a11y-panel"
        aria-label="תפריט נגישות"
        className="fixed bottom-4 start-4 z-50 inline-flex h-14 w-14 items-center justify-center rounded-full border-2 border-ink bg-label text-ink shadow-[0_2px_6px_rgba(34,29,21,0.3)] transition hover:bg-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-deal-deep"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-7 w-7" fill="currentColor">
          <circle cx="12" cy="4.2" r="1.9" />
          <path d="M20 7.2c0 .6-.5 1-1.1 1.1l-4.1.5v3.4l1.9 7.4a1.1 1.1 0 1 1-2.1.6L12.9 14h-1.8l-1.7 6.2a1.1 1.1 0 1 1-2.1-.6l1.9-7.4V8.8l-4.1-.5A1.1 1.1 0 0 1 5.2 6.1L9.9 6.7c1.4.2 2.8.2 4.2 0l4.7-.6c.6-.1 1.2.4 1.2 1.1z" />
        </svg>
      </button>

      {open ? (
        <div
          id="a11y-panel"
          role="dialog"
          aria-label="הגדרות נגישות"
          // Anchored to the button and capped to the viewport, so at 150% text
          // on a short window the panel scrolls instead of running off-screen.
          className="fixed bottom-20 start-4 z-50 max-h-[calc(100dvh-6.5rem)] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-xl border-2 border-ink bg-paper p-4 shadow-[0_4px_16px_rgba(34,29,21,0.35)]"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-3xl leading-none">נגישות</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="סגירת תפריט הנגישות"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-ink/25 bg-label text-lg font-bold text-ink transition hover:bg-paper"
            >
              ×
            </button>
          </div>

          <div className="mt-3">
            <p id="a11y-size-label" className="text-sm font-semibold">
              גודל טקסט
            </p>
            <div
              role="group"
              aria-labelledby="a11y-size-label"
              className="mt-1.5 flex items-center gap-1.5"
            >
              <button
                type="button"
                onClick={() => set("textScale", Math.max(100, s.textScale - 12.5))}
                disabled={s.textScale <= 100}
                aria-label="הקטנת טקסט"
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-ink/25 bg-label text-lg font-bold transition hover:bg-paper disabled:opacity-40"
              >
                −
              </button>
              <span
                aria-live="polite"
                className="min-w-16 rounded-lg border border-ink/25 bg-label px-2 py-2 text-center font-mono text-sm font-bold tabular-nums"
              >
                {s.textScale}%
              </span>
              <button
                type="button"
                onClick={() => set("textScale", Math.min(150, s.textScale + 12.5))}
                disabled={s.textScale >= 150}
                aria-label="הגדלת טקסט"
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-ink/25 bg-label text-lg font-bold transition hover:bg-paper disabled:opacity-40"
              >
                +
              </button>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {toggleRow("ניגודיות גבוהה", "contrast")}
            {toggleRow("הדגשת קישורים", "underlineLinks")}
            {toggleRow("עצירת אנימציות", "stopMotion")}
            {toggleRow("גופן קריא", "readableFont")}
          </div>

          <button
            type="button"
            onClick={() => setS(DEFAULTS)}
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-ink/25 bg-label px-3 text-sm font-semibold transition hover:bg-paper"
          >
            איפוס להגדרות ברירת המחדל
          </button>

          <Link
            href="/legal/accessibility"
            onClick={() => setOpen(false)}
            className="mt-2 block text-center text-xs font-semibold text-deal-deep underline underline-offset-2"
          >
            הצהרת הנגישות המלאה
          </Link>
        </div>
      ) : null}
    </>
  );
}
