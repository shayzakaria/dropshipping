import { describe, expect, it } from "vitest";

/**
 * The shop address is typed by a business, so the redirect target is
 * untrusted input. These pin the guard that stops our domain from being
 * turned into an open redirect.
 */
function safeShopUrl(storeUrl: string | undefined, code: string): string | null {
  if (!storeUrl) return null;
  let url: URL;
  try {
    url = new URL(storeUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  url.searchParams.set("coupon", code);
  return url.toString();
}

describe("safeShopUrl", () => {
  it("carries the coupon into the shop's query string", () => {
    expect(safeShopUrl("https://shop.example/collections/all", "ABCD-1234")).toBe(
      "https://shop.example/collections/all?coupon=ABCD-1234",
    );
  });

  it("replaces an existing coupon rather than appending a second one", () => {
    const out = safeShopUrl("https://shop.example/?coupon=OLD", "NEW-1");
    expect(out).toBe("https://shop.example/?coupon=NEW-1");
    expect(out?.match(/coupon=/g)).toHaveLength(1);
  });

  it("keeps the shop's own query parameters", () => {
    expect(safeShopUrl("https://shop.example/?utm_source=x", "C1")).toContain("utm_source=x");
  });

  it("refuses anything that is not http or https", () => {
    // A stored javascript: or data: URL would otherwise execute on the
    // visitor's machine, arriving from a link with our name on it.
    for (const bad of [
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "file:///etc/passwd",
      "vbscript:msgbox",
    ]) {
      expect(safeShopUrl(bad, "C1")).toBeNull();
    }
  });

  it("refuses a value that is not a URL at all", () => {
    expect(safeShopUrl("not a url", "C1")).toBeNull();
    expect(safeShopUrl("", "C1")).toBeNull();
    expect(safeShopUrl(undefined, "C1")).toBeNull();
  });
});
