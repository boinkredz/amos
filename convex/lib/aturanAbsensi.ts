import type { QueryCtx } from "../_generated/server";

export type AturanAbsensi = {
  toleransiTerlambatMenit: number;
  dendaTerlambat: number;
  dendaPulangCepat: number;
};

export const DEFAULT_ATURAN: AturanAbsensi = {
  toleransiTerlambatMenit: 5,
  dendaTerlambat: 50000,
  dendaPulangCepat: 50000,
};

// App operates in WIB (UTC+7); shift times are stored as local "HH:MM"
const WIB_OFFSET_HOURS = 7;

export async function getAturan(ctx: QueryCtx): Promise<AturanAbsensi> {
  const row = await ctx.db.query("aturanAbsensi").first();
  if (!row) return DEFAULT_ATURAN;
  return {
    toleransiTerlambatMenit: row.toleransiTerlambatMenit,
    dendaTerlambat: row.dendaTerlambat,
    dendaPulangCepat: row.dendaPulangCepat,
  };
}

function wibToUtcMs(tanggal: string, jam: string, addDays = 0): number {
  const [y, mo, d] = tanggal.split("-").map(Number);
  const [h, m] = jam.split(":").map(Number);
  return Date.UTC(y, mo - 1, d + addDays, h - WIB_OFFSET_HOURS, m, 0, 0);
}

/** Shift start/end instants (ms). Overnight shifts end on the next day. */
export function shiftWindow(
  tanggal: string,
  jamMulai: string,
  jamSelesai: string,
): { startMs: number; endMs: number } {
  const startMs = wibToUtcMs(tanggal, jamMulai);
  const overnight = jamSelesai <= jamMulai;
  const endMs = wibToUtcMs(tanggal, jamSelesai, overnight ? 1 : 0);
  return { startMs, endMs };
}

/** Minutes late (0 if within tolerance). */
export function hitungTerlambat(
  masukMs: number,
  startMs: number,
  toleransiMenit: number,
): number {
  const diffMenit = Math.round((masukMs - startMs) / 60000);
  return diffMenit > toleransiMenit ? diffMenit : 0;
}

/** Minutes before shift end (0 if not early). */
export function hitungPulangCepat(keluarMs: number, endMs: number): number {
  const diffMenit = Math.round((endMs - keluarMs) / 60000);
  return diffMenit > 0 ? diffMenit : 0;
}
