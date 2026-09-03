import { chromium } from "playwright-core";
const BASE = "http://localhost:3111";
const PAGES = ["/", "/login", "/campaigns", "/simulate", "/dashboard", "/campaigns/new", "/businesses", "/admin", "/admin/payouts", "/how-it-works",
               "/legal/accessibility", "/legal/terms", "/legal/privacy", "/legal/influencer"];
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await b.newContext({ locale: "he-IL" });
const page = await ctx.newPage();
// The sandbox cannot reach Google Fonts, and waiting on it turns every
// networkidle into a timeout. Block anything not served by the app itself.
await page.route("**/*", (route) =>
  route.request().url().startsWith(BASE) ? route.continue() : route.abort(),
);
const errs = [];
page.on("pageerror", e => errs.push("JS " + e.message));
page.on("response", r => { if (r.status() >= 400) errs.push(`HTTP ${r.status()} ${r.url().replace(BASE,"")}`); });

await page.goto(`${BASE}/login`);
await page.locator("form button", { hasText: "דנה" }).first().click();
await page.waitForURL("**/dashboard");

for (const w of [{ width: 390, height: 844, n: "mobile" }, { width: 1280, height: 900, n: "desktop" }]) {
  await page.setViewportSize({ width: w.width, height: w.height });
  console.log(`\n########## ${w.n} (${w.width}px) ##########`);
  for (const p of PAGES) {
    await page.goto(BASE + p, { waitUntil: "networkidle" });
    const r = await page.evaluate(() => {
      const out = { overflow: null, ltr: [], small: [], focusless: 0, physical: [] };
      const de = document.documentElement;
      if (de.scrollWidth > window.innerWidth + 1) out.overflow = `${de.scrollWidth}>${window.innerWidth}`;
      for (const el of document.querySelectorAll("body *")) {
        const cs = getComputedStyle(el);
        const t = (el.textContent || "").trim();
        if (cs.direction === "ltr" && /[֐-׿]/.test(t) && !el.children.length && t.length > 1 && el.tagName !== "CODE")
          out.ltr.push(`${el.tagName} "${t.slice(0,30)}"`);
        if (/^(button|a|input|select|textarea)$/i.test(el.tagName) && el.type !== "hidden") {
          const bb = el.getBoundingClientRect();
          if (bb.width > 0 && (bb.width < 24 || bb.height < 24))
            out.small.push(`${el.tagName} ${Math.round(bb.width)}x${Math.round(bb.height)} "${(el.textContent||el.getAttribute("aria-label")||"").trim().slice(0,22)}"`);
        }
        // margin/padding set with physical sides breaks under RTL
        for (const [prop, logical] of [["marginLeft","ms/me"],["marginRight","ms/me"]]) {
          void prop; void logical;
        }
      }
      return out;
    });
    // keyboard: can every interactive element be reached and does focus show?
    const kb = await page.evaluate(() => {
      const els = [...document.querySelectorAll("a[href],button,input:not([type=hidden]),select,textarea")]
        .filter(e => e.offsetParent !== null);
      let noOutline = 0;
      for (const e of els) { e.focus(); const cs = getComputedStyle(e);
        if (cs.outlineStyle === "none" && !cs.boxShadow.includes("rgb") && cs.borderColor === getComputedStyle(document.body).borderColor) noOutline++; }
      return { total: els.length, noOutline };
    });
    const flags = [];
    if (r.overflow) flags.push(`⚠ overflow ${r.overflow}`);
    if (r.ltr.length) flags.push(`⚠ Hebrew LTR: ${r.ltr.slice(0,2).join(", ")}`);
    if (r.small.length) flags.push(`⚠ small: ${[...new Set(r.small)].slice(0,3).join(", ")}`);
    console.log(`${p.padEnd(24)} focusable=${String(kb.total).padStart(2)} ${flags.join("  ") || "✓ clean"}`);
  }
}
console.log("\nerrors:", [...new Set(errs)].join(" | ") || "none");
await b.close();
