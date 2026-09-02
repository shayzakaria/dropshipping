import { chromium } from "playwright-core";
const BASE = "http://localhost:3111";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const errs = [];
const mk = async () => {
  const ctx = await b.newContext({ locale: "he-IL", viewport: { width: 1100, height: 1000 } });
  const page = await ctx.newPage();
  await page.route("**/*", r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
  page.on("pageerror", e => errs.push(e.message));
  page.on("response", r => { if (r.status() >= 500) errs.push(`HTTP ${r.status()} ${r.url().replace(BASE, "")}`); });
  return page;
};
const login = async (page, who) => {
  await page.goto(`${BASE}/login`);
  await page.locator("form button", { hasText: who }).first().click();
  await page.waitForURL("**/dashboard");
};

// ---- 1. page views get counted (a few anonymous hits first) ----
const anon = await mk();
for (const p of ["/", "/businesses", "/campaigns", "/"]) await anon.goto(BASE + p, { waitUntil: "networkidle" });
await anon.close();

// ---- 2. non-admin cannot see /admin ----
const noa = await mk();
await login(noa, "נועה");
await noa.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
console.log("1. influencer hitting /admin lands on:", noa.url().replace(BASE, ""));
console.log("   admin link in nav for influencer:", await noa.locator("a[href='/admin']").count());

// ---- 3. follow flow ----
await noa.goto(`${BASE}/businesses`, { waitUntil: "networkidle" });
console.log("2. follow button before:", (await noa.locator("button[aria-pressed]").first().innerText()).trim());
await noa.locator("button[aria-pressed]").first().click();
await noa.waitForTimeout(1500);
console.log("   follow button after :", (await noa.locator("button[aria-pressed]").first().innerText()).trim(),
            "| followers text:", (await noa.locator("form:has(button[aria-pressed]) span").first().innerText().catch(() => "")).trim());
await noa.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
const newSec = noa.locator("text=קמפיינים חדשים מעסקים");
console.log("3. 'new campaigns from followed' on dashboard:", await newSec.count() > 0);
if (await newSec.count()) {
  const card = noa.locator(".label-card.ring-2").first();
  console.log("   card:", (await card.innerText()).replace(/\n+/g, " | ").slice(0, 160));
}
await noa.close();

// ---- 4. admin sees /admin, sets featured ----
const dana = await mk();
await login(dana, "דנה");
console.log("4. admin link in nav for admin:", await dana.locator("a[href='/admin']").count());
await dana.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
console.log("   /admin url:", dana.url().replace(BASE, ""));
const main = await dana.locator("main").innerText();
console.log("   hero:", main.split("\n").slice(0, 8).filter(Boolean).join(" | ").slice(0, 200));
console.log("   page views row for '/':", /\/\s+\d+/.test(main) ? "present" : "MISSING", "|", (main.match(/צפיות בעמודים\n(\d+)/) || [])[1] ?? "?");
await dana.screenshot({ path: "/tmp/admin.png", fullPage: true });
// set featured 30 days on the first business
await dana.locator("select[name=days]").first().selectOption("30");
await dana.locator("select[name=days]").first().locator("xpath=following-sibling::button").click();
await dana.waitForTimeout(1500);
console.log("5. featured after update:", (await dana.locator("li:has(select[name=days]) p.text-xs").first().innerText()).trim());
await dana.goto(`${BASE}/businesses`, { waitUntil: "networkidle" });
console.log("   directory first card has מומלץ:", await dana.locator(".label-card").first().locator("text=מומלץ").count() > 0,
            "| ring:", await dana.locator(".label-card.ring-2").count());
await dana.screenshot({ path: "/tmp/dir2.png", clip: { x: 0, y: 0, width: 1100, height: 700 } });

// ---- 6. campaign scope on the form + campaigns page ----
await dana.goto(`${BASE}/campaigns/new`, { waitUntil: "networkidle" });
console.log("6. scope fieldset present:", await dana.locator("legend:has-text('על מה הקוד תקף')").count() > 0);
await dana.locator("input[name=scope][value=product]").check();
console.log("   product fields appear:", await dana.locator("input[name=productName]").count() > 0);
await dana.goto(`${BASE}/campaigns`, { waitUntil: "networkidle" });
console.log("   scope badges on /campaigns:", await dana.locator("text=תקף על כל החנות").count());
await dana.close();

console.log("\nerrors:", [...new Set(errs)].join(" | ") || "none");
await b.close();
