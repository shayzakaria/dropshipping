import { chromium } from "playwright-core";
import { AxeBuilder } from "@axe-core/playwright";

const BASE = "http://localhost:3111";
const PAGES = ["/", "/login", "/reset", "/reset/new", "/campaigns", "/simulate", "/campaigns/new", "/dashboard", "/businesses", "/admin", "/admin/users", "/admin/preview", "/admin/payouts", "/admin/settlements", "/how-it-works", "/legal/money", "/settings/notifications", "/legal/accessibility", "/legal/terms", "/legal/privacy", "/legal/influencer"];

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await browser.newContext({ locale: "he-IL", viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
// The sandbox cannot reach Google Fonts, and waiting on it turns every
// networkidle into a timeout. Block anything not served by the app itself.
await page.route("**/*", (route) =>
  route.request().url().startsWith(BASE) ? route.continue() : route.abort(),
);

// Sign in as the demo business so the gated pages render
await page.goto(`${BASE}/login`);
const btn = page.locator("form button", { hasText: "דנה" }).first();
if (await btn.count()) { await btn.click(); await page.waitForLoadState("networkidle"); }

const all = new Map();
for (const path of PAGES) {
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  const r = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
    .analyze();
  for (const v of r.violations) {
    const k = v.id;
    if (!all.has(k)) all.set(k, { id: v.id, impact: v.impact, help: v.help, wcag: v.tags.filter(t=>t.startsWith("wcag")).join(","), pages: new Set(), samples: [] });
    const e = all.get(k);
    e.pages.add(path);
    for (const n of v.nodes.slice(0, 2)) if (e.samples.length < 3) e.samples.push(n.target.join(" ") + " :: " + (n.failureSummary||"").split("\n").slice(1,3).join(" | "));
  }
  console.log(`${path.padEnd(16)} violations=${r.violations.length}  passes=${r.passes.length}`);
}
console.log("\n================ UNIQUE ISSUES ================");
const order = { critical: 0, serious: 1, moderate: 2, minor: 3 };
for (const v of [...all.values()].sort((a,b)=>(order[a.impact]??9)-(order[b.impact]??9))) {
  console.log(`\n[${(v.impact||"?").toUpperCase()}] ${v.id}  (${v.wcag||"best-practice"})`);
  console.log(`  ${v.help}`);
  console.log(`  pages: ${[...v.pages].join(", ")}`);
  for (const s of v.samples) console.log(`  → ${s.slice(0,170)}`);
}
await browser.close();
