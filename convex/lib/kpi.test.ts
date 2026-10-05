import { describe, expect, it } from "vitest";
import { DEFAULT_ATURAN } from "./aturanAbsensi";
import { hariIniWib, hitungKekurangan, hitungKpiPersonel, jumlahHari } from "./kpi";
import type { KpiAbsensi, KpiAssignment } from "./kpi";

const base = { siteId: "s1", shiftId: "p", berhalangan: false, isBackup: false };
const asg = (id: string, officerId: string, tanggal: string, extra: Partial<KpiAssignment> = {}): KpiAssignment => ({
  id, officerId, tanggal, ...base, ...extra,
});

describe("hitungKpiPersonel", () => {
  it("counts late, early leave, fines, and missing attendance", () => {
    const assignments = [
      asg("a1", "o1", "2026-09-01"),
      asg("a2", "o1", "2026-09-02"),
      asg("a3", "o1", "2026-09-03"), // no absensi, past → tanpa keterangan
      asg("a4", "o1", "2026-09-04", { kode: "L" }), // libur ignored
      asg("a5", "o1", "2026-09-30"), // future, not counted as missing
    ];
    const absensi: KpiAbsensi[] = [
      { assignmentId: "a1", officerId: "o1", status: "terlambat", waktuMasuk: "x", keterlambatanMenit: 12 },
      { assignmentId: "a2", officerId: "o1", status: "hadir", waktuMasuk: "x", isPulangCepat: true },
    ];
    const [r] = hitungKpiPersonel(assignments, absensi, new Map(), DEFAULT_ATURAN, "2026-09-10");
    expect(r).toMatchObject({
      terjadwal: 4, hadir: 2, terlambat: 1, menitTerlambat: 12, pulangCepat: 1, tanpaKeterangan: 1,
      denda: 100000, persenHadir: 50,
    });
  });

  it("separates berhalangan from scheduled and counts backups and swaps", () => {
    const assignments = [
      asg("a1", "o1", "2026-09-01", { berhalangan: true }),
      asg("b1", "o2", "2026-09-01", { isBackup: true }),
    ];
    const absensi: KpiAbsensi[] = [
      { assignmentId: "a1", officerId: "o1", status: "sakit" },
      { assignmentId: "b1", officerId: "o2", status: "hadir", waktuMasuk: "x" },
    ];
    const rows = hitungKpiPersonel(assignments, absensi, new Map([["o1", 2]]), DEFAULT_ATURAN, "2026-09-10");
    const o1 = rows.find((r) => r.officerId === "o1");
    const o2 = rows.find((r) => r.officerId === "o2");
    expect(o1).toMatchObject({ terjadwal: 0, berhalangan: 1, sakit: 1, tanpaKeterangan: 0, tukarShift: 2 });
    expect(o2).toMatchObject({ terjadwal: 1, hadir: 1, backup: 1, persenHadir: 100 });
  });
});

describe("hitungKekurangan", () => {
  it("sums daily shortage per site+shift and skips future days", () => {
    const assignments = [
      asg("a1", "o1", "2026-09-01"),
      asg("a2", "o2", "2026-09-01"),
      asg("a3", "o1", "2026-09-02"),
      asg("a4", "o1", "2026-09-20"),
    ];
    const absensi: KpiAbsensi[] = [
      { assignmentId: "a1", officerId: "o1", status: "hadir", waktuMasuk: "x" },
      { assignmentId: "a2", officerId: "o2", status: "hadir", waktuMasuk: "x" },
      { assignmentId: "a3", officerId: "o1", status: "hadir", waktuMasuk: "x" },
    ];
    const [k] = hitungKekurangan(assignments, absensi, new Map([["s1::p", 2]]), "2026-09-10");
    expect(k).toMatchObject({ hari: 2, kebutuhan: 4, hadir: 3, kurang: 1, hariKurang: 1 });
  });
});

describe("date helpers", () => {
  it("computes WIB today and inclusive day count", () => {
    expect(hariIniWib(Date.UTC(2026, 8, 29, 18, 0))).toBe("2026-09-30");
    expect(jumlahHari("2026-09-01", "2026-09-30")).toBe(30);
  });
});
