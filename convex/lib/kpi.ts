import type { AturanAbsensi } from "./aturanAbsensi";
import { buildMonitoring, LIBUR_KODE } from "./monitoring";
import type { MonitoringInput } from "./monitoring";

export const MAX_KPI_DAYS = 62;

export type KpiAssignment = {
  id: string;
  officerId: string;
  tanggal: string;
  siteId: string | null;
  shiftId: string;
  kode?: string;
  berhalangan: boolean;
  isBackup: boolean;
};

export type KpiAbsensi = {
  assignmentId: string;
  officerId: string;
  status: "hadir" | "terlambat" | "izin" | "sakit" | "alpha";
  waktuMasuk?: string;
  keterlambatanMenit?: number;
  isPulangCepat?: boolean;
};

export type KpiOfficerRow = {
  officerId: string;
  terjadwal: number;
  hadir: number;
  terlambat: number;
  menitTerlambat: number;
  pulangCepat: number;
  izin: number;
  sakit: number;
  alpha: number;
  tanpaKeterangan: number;
  berhalangan: number;
  backup: number;
  tukarShift: number;
  denda: number;
  persenHadir: number;
};

export type KpiShortageRow = {
  siteId: string | null;
  shiftId: string;
  hari: number;
  kebutuhan: number;
  hadir: number;
  kurang: number;
  hariKurang: number;
};

function emptyRow(officerId: string): KpiOfficerRow {
  return {
    officerId, terjadwal: 0, hadir: 0, terlambat: 0, menitTerlambat: 0, pulangCepat: 0,
    izin: 0, sakit: 0, alpha: 0, tanpaKeterangan: 0, berhalangan: 0, backup: 0, tukarShift: 0,
    denda: 0, persenHadir: 0,
  };
}

/**
 * Per-officer KPI for a period.
 * - Libur rows are ignored. Berhalangan rows count as "berhalangan", not as scheduled.
 * - A past scheduled shift with no attendance record counts as "tanpa keterangan".
 * - Fines are flat per occurrence (late / early check-out).
 */
export function hitungKpiPersonel(
  assignments: KpiAssignment[],
  absensi: KpiAbsensi[],
  tukarShiftPerOfficer: Map<string, number>,
  aturan: AturanAbsensi,
  hariIni: string,
): KpiOfficerRow[] {
  const rows = new Map<string, KpiOfficerRow>();
  const get = (id: string) => {
    let r = rows.get(id);
    if (!r) {
      r = emptyRow(id);
      rows.set(id, r);
    }
    return r;
  };
  const absensiByAssignment = new Map(absensi.map((a) => [a.assignmentId, a]));

  for (const a of assignments) {
    if (a.kode === LIBUR_KODE) continue;
    const r = get(a.officerId);
    if (a.berhalangan) {
      r.berhalangan++;
      continue;
    }
    r.terjadwal++;
    if (a.isBackup) r.backup++;
    if (!absensiByAssignment.has(a.id) && a.tanggal < hariIni) r.tanpaKeterangan++;
  }

  for (const ab of absensi) {
    const r = get(ab.officerId);
    // Auto-created izin/sakit rows for berhalangan officers are already counted above
    if (ab.waktuMasuk) r.hadir++;
    if (ab.status === "terlambat") {
      r.terlambat++;
      r.menitTerlambat += ab.keterlambatanMenit ?? 0;
    }
    if (ab.isPulangCepat) r.pulangCepat++;
    if (ab.status === "izin") r.izin++;
    if (ab.status === "sakit") r.sakit++;
    if (ab.status === "alpha") r.alpha++;
  }

  for (const [officerId, n] of tukarShiftPerOfficer) get(officerId).tukarShift += n;

  return [...rows.values()].map((r) => ({
    ...r,
    denda: r.terlambat * aturan.dendaTerlambat + r.pulangCepat * aturan.dendaPulangCepat,
    persenHadir: r.terjadwal > 0 ? Math.round((Math.min(r.hadir, r.terjadwal) / r.terjadwal) * 100) : 0,
  }));
}

/** Personnel shortage per site + shift, summed over each day up to today. */
export function hitungKekurangan(
  assignments: KpiAssignment[],
  absensi: KpiAbsensi[],
  kebutuhan: Map<string, number>,
  hariIni: string,
): KpiShortageRow[] {
  const masuk = new Map(absensi.filter((a) => a.waktuMasuk).map((a) => [a.assignmentId, a.waktuMasuk]));
  const byDate = new Map<string, MonitoringInput[]>();
  for (const a of assignments) {
    if (a.tanggal > hariIni) continue;
    const list = byDate.get(a.tanggal) ?? [];
    list.push({
      assignmentId: a.id,
      officerId: a.officerId,
      officerNama: "",
      siteId: a.siteId,
      shiftId: a.shiftId,
      kode: a.kode,
      berhalangan: a.berhalangan,
      isBackup: a.isBackup,
      waktuMasuk: masuk.get(a.id),
    });
    byDate.set(a.tanggal, list);
  }

  const totals = new Map<string, KpiShortageRow>();
  for (const rows of byDate.values()) {
    for (const g of buildMonitoring(rows, kebutuhan)) {
      const t = totals.get(g.key) ?? {
        siteId: g.siteId, shiftId: g.shiftId, hari: 0, kebutuhan: 0, hadir: 0, kurang: 0, hariKurang: 0,
      };
      t.hari++;
      t.kebutuhan += g.kebutuhan;
      t.hadir += g.hadir;
      t.kurang += g.kurang;
      if (g.kurang > 0) t.hariKurang++;
      totals.set(g.key, t);
    }
  }
  return [...totals.values()];
}

/** Today's date (YYYY-MM-DD) in WIB. */
export function hariIniWib(nowMs: number): string {
  return new Date(nowMs + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

export function jumlahHari(mulai: string, selesai: string): number {
  return Math.round((Date.parse(`${selesai}T00:00:00Z`) - Date.parse(`${mulai}T00:00:00Z`)) / 86400000) + 1;
}
