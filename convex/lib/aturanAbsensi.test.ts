import { describe, expect, it } from "vitest";
import { hitungPulangCepat, hitungTerlambat, shiftWindow } from "./aturanAbsensi";

// WIB is UTC+7: 07:00 WIB = 00:00 UTC
const at = (iso: string) => Date.parse(iso);

describe("shiftWindow", () => {
  it("converts WIB day shift to UTC instants", () => {
    const { startMs, endMs } = shiftWindow("2026-09-29", "07:00", "19:00");
    expect(startMs).toBe(at("2026-09-29T00:00:00Z"));
    expect(endMs).toBe(at("2026-09-29T12:00:00Z"));
  });

  it("ends overnight shifts on the next day", () => {
    const { startMs, endMs } = shiftWindow("2026-09-29", "19:00", "07:00");
    expect(startMs).toBe(at("2026-09-29T12:00:00Z"));
    expect(endMs).toBe(at("2026-09-30T00:00:00Z"));
  });
});

describe("hitungTerlambat", () => {
  const start = at("2026-09-29T00:00:00Z");

  it("is not late at exactly the tolerance", () => {
    expect(hitungTerlambat(start + 5 * 60000, start, 5)).toBe(0);
  });

  it("is late past the tolerance and reports full minutes after start", () => {
    expect(hitungTerlambat(start + 6 * 60000, start, 5)).toBe(6);
  });

  it("is not late when early", () => {
    expect(hitungTerlambat(start - 10 * 60000, start, 5)).toBe(0);
  });
});

describe("hitungPulangCepat", () => {
  const end = at("2026-09-29T12:00:00Z");

  it("flags check-out before shift end", () => {
    expect(hitungPulangCepat(end - 30 * 60000, end)).toBe(30);
  });

  it("does not flag check-out at or after shift end", () => {
    expect(hitungPulangCepat(end, end)).toBe(0);
    expect(hitungPulangCepat(end + 60000, end)).toBe(0);
  });
});
