import { describe, expect, it } from "vitest";
import { buildMonitoring, kebutuhanKey } from "./monitoring";
import type { MonitoringInput } from "./monitoring";

const row = (over: Partial<MonitoringInput>): MonitoringInput => ({
  assignmentId: Math.random().toString(),
  officerId: "o",
  officerNama: "A",
  siteId: "s1",
  shiftId: "pagi",
  berhalangan: false,
  isBackup: false,
  ...over,
});

describe("buildMonitoring", () => {
  it("uses default 10 and computes shortage from checked-in people", () => {
    const rows = [
      ...Array.from({ length: 8 }, () => row({ waktuMasuk: "2026-09-29T00:00:00Z" })),
      row({}),
    ];
    const [g] = buildMonitoring(rows, new Map());
    expect(g).toMatchObject({ kebutuhan: 10, terjadwal: 9, hadir: 8, kurang: 2 });
  });

  it("excludes berhalangan and Libur rows but counts backups", () => {
    const rows = [
      row({ berhalangan: true }),
      row({ isBackup: true, waktuMasuk: "2026-09-29T00:00:00Z" }),
      row({ kode: "L" }),
    ];
    const [g] = buildMonitoring(rows, new Map([[kebutuhanKey("s1", "pagi"), 2]]));
    expect(g).toMatchObject({ kebutuhan: 2, terjadwal: 1, hadir: 1, kurang: 1 });
    expect(g.personel).toHaveLength(2);
  });

  it("groups separately per site and shift and never reports negative shortage", () => {
    const rows = [
      row({ shiftId: "malam", waktuMasuk: "x" }),
      row({ siteId: "s2", waktuMasuk: "x" }),
      row({ siteId: "s2", waktuMasuk: "x" }),
    ];
    const groups = buildMonitoring(rows, new Map([[kebutuhanKey("s2", "pagi"), 1]]));
    expect(groups).toHaveLength(2);
    expect(groups.find((g) => g.siteId === "s2")?.kurang).toBe(0);
  });

  it("lists not-yet-checked-in people first", () => {
    const rows = [row({ officerNama: "Z", waktuMasuk: "x" }), row({ officerNama: "Y" })];
    const [g] = buildMonitoring(rows, new Map());
    expect(g.personel.map((p) => p.status)).toEqual(["belum", "hadir"]);
  });
});
