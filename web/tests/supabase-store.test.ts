import { describe, expect, it } from "vitest";
import { monthWindow } from "@/lib/store/supabase";
import { monthKey } from "@/lib/domain/logic";

/**
 * The Supabase adapter counts a month with a [start, next) range while the
 * in-memory store compares monthKey strings. Tier bonuses depend on the two
 * agreeing exactly, so this pins the range to the same UTC month.
 */
describe("monthWindow", () => {
  it("spans exactly the UTC month of the given date", () => {
    const { start, next } = monthWindow(new Date("2026-09-15T12:00:00Z"));
    expect(start).toBe("2026-09-01T00:00:00.000Z");
    expect(next).toBe("2026-10-01T00:00:00.000Z");
  });

  it("rolls over the year at December", () => {
    const { start, next } = monthWindow(new Date("2026-12-31T23:59:59Z"));
    expect(start).toBe("2026-12-01T00:00:00.000Z");
    expect(next).toBe("2027-01-01T00:00:00.000Z");
  });

  it("includes exactly the dates monthKey puts in the same month", () => {
    const at = new Date("2026-02-10T00:00:00Z");
    const { start, next } = monthWindow(at);
    const inRange = (iso: string) => iso >= start && iso < next;

    const sameMonth = ["2026-02-01T00:00:00.000Z", "2026-02-28T23:59:59.999Z"];
    const otherMonth = ["2026-01-31T23:59:59.999Z", "2026-03-01T00:00:00.000Z"];

    for (const iso of sameMonth) {
      expect(inRange(iso)).toBe(true);
      expect(monthKey(new Date(iso))).toBe(monthKey(at));
    }
    for (const iso of otherMonth) {
      expect(inRange(iso)).toBe(false);
      expect(monthKey(new Date(iso))).not.toBe(monthKey(at));
    }
  });
});
