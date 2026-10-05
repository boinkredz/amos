import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

// Kode jadwal that mark a backup (SOC) shift
export function isSocKode(kode: string | undefined): boolean {
  return kode === "SOC/P" || kode === "SOC/M";
}

// Count an officer's backup (SOC) shifts within a YYYY-MM-DD date range
export async function countBackupShifts(
  ctx: QueryCtx,
  officerId: Id<"officers">,
  mulai: string,
  selesai: string,
): Promise<number> {
  const assignments = await ctx.db
    .query("shiftAssignments")
    .withIndex("by_officer_date", (q) =>
      q.eq("officerId", officerId).gte("tanggal", mulai).lte("tanggal", selesai),
    )
    .collect();
  return assignments.filter((a) => isSocKode(a.kode) || a.backupInfo !== undefined).length;
}

/** Backup assignments are coded SOC/P or SOC/M so they show up in the jadwal grid. */
export function backupKode(kode: string | undefined, shiftNama: string): "SOC/P" | "SOC/M" {
  if (kode === "M" || kode === "SOC/M") return "SOC/M";
  if (kode === "P" || kode === "SOC/P") return "SOC/P";
  return shiftNama.toLowerCase().includes("malam") ? "SOC/M" : "SOC/P";
}
