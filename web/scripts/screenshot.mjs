// סבב צילומי הביקורת של impeccable — פרודקשן מקומי על פורט 3111
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3111";
const OUT = new URL("../.impeccable/review/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium",
});

async function shot(ctx, path, file, { fullPage = true } = {}) {
  const page = await ctx.newPage();
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(900); // פונטים + אנימציית settle
  await page.screenshot({ path: `${OUT}${file}`, fullPage });
  await page.close();
  console.log("captured", file);
}

// דסקטופ
const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await shot(desktop, "/", "desktop.png");
await shot(desktop, "/login", "login.png");
await shot(desktop, "/simulate", "simulate.png");

// דשבורד עסק — נכנסים כדנה דרך דף הכניסה
{
  const page = await desktop.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /דנה/ }).click();
  await page.waitForURL("**/dashboard");
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}dashboard-business.png`, fullPage: true });
  await page.close();
  console.log("captured dashboard-business.png");
}
// דשבורד משפיענית — נועה
{
  const page = await desktop.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /נועה/ }).click();
  await page.waitForURL("**/dashboard");
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}dashboard-influencer.png`, fullPage: true });
  await page.close();
  console.log("captured dashboard-influencer.png");
}
await desktop.close();

// מובייל
const mobile = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  deviceScaleFactor: 2,
});
await shot(mobile, "/", "mobile.png");
await shot(mobile, "/simulate", "mobile-simulate.png");
await mobile.close();

await browser.close();
console.log("done");
