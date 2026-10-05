export const DEFAULT_KEBUTUHAN = 10;
export const LIBUR_KODE = "L";

export type PersonelStatus = "hadir" | "belum" | "berhalangan";

export type MonitoringInput = {
  assignmentId: string;
  officerId: string;
  officerNama: string;
  siteId: string | null;
  shiftId: string;
  kode?: string;
  berhalangan: boolean;
  isBackup: boolean;
  waktuMasuk?: string;
  isLate?: boolean;
  pengingatWaktu?: string;
};

export type MonitoringGroup<T extends MonitoringInput> = {
  key: string;
  siteId: string | null;
  shiftId: string;
  kebutuhan: number;
  terjadwal: number;
  hadir: number;
  kurang: number;
  personel: (T & { status: PersonelStatus })[];
};

export function kebutuhanKey(siteId: string | null, shiftId: string): string {
  return `${siteId ?? "none"}::${shiftId}`;
}

/**
 * Group a day's roster by site + shift and compute headcount.
 * Berhalangan rows are listed but never count toward scheduled/present; backups do count.
 */
export function buildMonitoring<T extends MonitoringInput>(
  rows: T[],
  kebutuhan: Map<string, number>,
): MonitoringGroup<T>[] {
  const groups = new Map<string, MonitoringGroup<T>>();
  for (const row of rows) {
    if (row.kode === LIBUR_KODE) continue;
    const key = kebutuhanKey(row.siteId, row.shiftId);
    let g = groups.get(key);
    if (!g) {
      g = {
        key,
        siteId: row.siteId,
        shiftId: row.shiftId,
        kebutuhan: kebutuhan.get(key) ?? DEFAULT_KEBUTUHAN,
        terjadwal: 0,
        hadir: 0,
        kurang: 0,
        personel: [],
      };
      groups.set(key, g);
    }
    const status: PersonelStatus = row.berhalangan ? "berhalangan" : row.waktuMasuk ? "hadir" : "belum";
    if (status !== "berhalangan") g.terjadwal++;
    if (status === "hadir") g.hadir++;
    g.personel.push({ ...row, status });
  }

  const order: Record<PersonelStatus, number> = { belum: 0, berhalangan: 1, hadir: 2 };
  return [...groups.values()].map((g) => ({
    ...g,
    kurang: Math.max(0, g.kebutuhan - g.hadir),
    personel: g.personel.sort(
      (a, b) => order[a.status] - order[b.status] || a.officerNama.localeCompare(b.officerNama),
    ),
  }));
}
