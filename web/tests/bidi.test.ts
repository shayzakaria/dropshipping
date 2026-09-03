import { describe, expect, it } from "vitest";
import { hasHebrew, visualRtl } from "../lib/domain/bidi";

/** Reading a visually-ordered line the way a person does: right to left. */
const read = (visual: string) => [...visual].reverse().join("");

describe("putting Hebrew into visual order for a renderer without bidi", () => {
  it("mirrors a plain Hebrew phrase", () => {
    expect(visualRtl("קוד קופון")).toBe("ןופוק דוק");
  });

  it("round-trips: reading the output right-to-left gives the input back", () => {
    expect(read(visualRtl("כולם מרוויחים"))).toBe("כולם מרוויחים");
  });

  it("keeps a number reading as that number", () => {
    // The digits must not become 003, and they end up left of the Hebrew.
    const out = visualRtl("מכירה של 300");
    expect(out).toContain("300");
    expect(out.indexOf("300")).toBeLessThan(out.indexOf("ה"));
  });

  it("keeps a Latin word spelled forwards", () => {
    expect(visualRtl("הצטרפו ל-BOOST")).toContain("BOOST");
  });

  it("puts the shekel sign at the left end, where a reader ends", () => {
    const out = visualRtl("סכום 300 ₪");
    expect(out.startsWith("₪")).toBe(true);
  });

  it("moves a trailing comma to the left end", () => {
    expect(visualRtl("קוד אחד,").startsWith(",")).toBe(true);
  });

  it("leaves a pure Latin string alone", () => {
    expect(visualRtl("BOOST 2026")).toBe("BOOST 2026");
  });

  it("keeps a percentage reading as a percentage", () => {
    // The obvious character-by-character version turns this into "%3".
    expect(visualRtl("קבועים על 3%")).toContain("3%");
  });

  it("keeps a decimal number intact", () => {
    expect(visualRtl("עמלה של 3.5 אחוז")).toContain("3.5");
  });

  it("keeps a code with a hyphen spelled forwards", () => {
    expect(visualRtl("הקוד שלך: DEMO-01")).toContain("DEMO-01");
  });

  it("handles an empty string", () => {
    expect(visualRtl("")).toBe("");
  });

  it("recognises which strings even need it", () => {
    expect(hasHebrew("שלום")).toBe(true);
    expect(hasHebrew("hello 300")).toBe(false);
  });
});
