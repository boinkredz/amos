import { v } from "convex/values";
import { query } from "./_generated/server";
import type { Id, Doc } from "./_generated/dataModel.js";
import { requireUser } from "./lib/auth";

// ─── Types ───────────────────────────────────────────────────────────────────

type PersonilBerjagaResult = {
  officerId: Id<"officers">;
  nama: string;
  jabatan: string;
  lokasiTugas: string;
  kodeShift: string;
  regu: { _id: Id<"regu">; nama: string; isNonShift: boolean } | null;
  isDanru: boolean;
  isWadanru: boolean;
  absensi: {
    status: string;
    waktuMasuk?: string;
    waktuKeluar?: string;
  } | null;
  lokasiGPS: { lat: number; lng: number } | null;
  sedangPatroli: boolean;
  tugasPatroliId: Id<"tugasPatroli"> | null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Derive a readable shift code from the assignment + shift template */
function deriveKodeShift(
  kode: string | undefined,
  shiftNama: string | undefined,
): string {
  if (kode) return kode;
  // Legacy assignments without kode: infer from shift template name
  if (!shiftNama) return "—";
  const lower = shiftNama.toLowerCase();
  if (lower.includes("pagi")) return "Pagi";
  if (lower.includes("malam")) return "Malam";
  return shiftNama;
}

/** Extract GPS location: prefer active patrol, fall back to check-in location */
function resolveLokasiGPS(
  patroliBerlangsung: Doc<"tugasPatroli"> | null,
  absensiRecord: Doc<"absensi"> | null,
): { lat: number; lng: number } | null {
  if (patroliBerlangsung?.lokasiTerakhir) {
    return patroliBerlangsung.lokasiTerakhir;
  }
  if (absensiRecord?.lokasiMasuk) {
    return {
      lat: absensiRecord.lokasiMasuk.lat,
      lng: absensiRecord.lokasiMasuk.lng,
    };
  }
  return null;
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export const getPersonilBerjaga = query({
  args: { tanggal: v.string() },
  handler: async (ctx, args): Promise<PersonilBerjagaResult[]> => {
    await requireUser(ctx);

    // 1. All shift assignments for today
    const assignments = await ctx.db
      .query("shiftAssignments")
      .withIndex("by_date", (q) => q.eq("tanggal", args.tanggal))
      .collect();

    // 2. Filter: exclude "L" (libur)
    const onDuty = assignments.filter((a) => a.kode !== "L");

    // 3-7. Enrich each assignment
    const results: PersonilBerjagaResult[] = [];

    for (const assignment of onDuty) {
      const officer = await ctx.db.get(assignment.officerId);
      if (!officer || officer.status === "nonaktif") continue;

      // Shift template for name fallback
      const shift = await ctx.db.get(assignment.shiftId);
      const kodeShift = deriveKodeShift(assignment.kode, shift?.nama);

      // Regu
      let reguData: PersonilBerjagaResult["regu"] = null;
      let isDanru = false;
      let isWadanru = false;
      if (officer.reguId) {
        const regu = await ctx.db.get(officer.reguId);
        if (regu) {
          reguData = { _id: regu._id, nama: regu.nama, isNonShift: regu.isNonShift };
          isDanru = regu.danruId === officer._id;
          isWadanru = regu.wadanruId === officer._id;
        }
      }

      // Absensi today
      const absensiRecord = await ctx.db
        .query("absensi")
        .withIndex("by_officer_date", (q) =>
          q.eq("officerId", officer._id).eq("tanggal", args.tanggal),
        )
        .first();

      const absensiInfo: PersonilBerjagaResult["absensi"] = absensiRecord
        ? {
            status: absensiRecord.status,
            waktuMasuk: absensiRecord.waktuMasuk,
            waktuKeluar: absensiRecord.waktuKeluar,
          }
        : null;

      // Active patrol today
      const patroliList = await ctx.db
        .query("tugasPatroli")
        .withIndex("by_officer_date", (q) =>
          q.eq("officerId", officer._id).eq("tanggal", args.tanggal),
        )
        .collect();

      const patroliBerlangsung =
        patroliList.find((p) => p.status === "berlangsung") ?? null;

      const lokasiGPS = resolveLokasiGPS(patroliBerlangsung, absensiRecord);

      results.push({
        officerId: officer._id,
        nama: officer.nama,
        jabatan: officer.jabatan,
        lokasiTugas: officer.lokasiTugas,
        kodeShift,
        regu: reguData,
        isDanru,
        isWadanru,
        absensi: absensiInfo,
        lokasiGPS,
        sedangPatroli: patroliBerlangsung !== null,
        tugasPatroliId: patroliBerlangsung?._id ?? null,
      });
    }

    return results;
  },
});

export const getShiftPersonilCount = query({
  args: { tanggal: v.string() },
  handler: async (
    ctx,
    args,
  ): Promise<{ total: number; hadir: number; belumAbsen: number }> => {
    await requireUser(ctx);

    const assignments = await ctx.db
      .query("shiftAssignments")
      .withIndex("by_date", (q) => q.eq("tanggal", args.tanggal))
      .collect();

    // Only officers who are on duty (kode !== "L")
    const onDuty = assignments.filter((a) => a.kode !== "L");

    // Deduplicate by officerId (an officer might have multiple assignments)
    const uniqueOfficerIds = new Set<Id<"officers">>();
    const validAssignments: typeof onDuty = [];
    for (const a of onDuty) {
      if (uniqueOfficerIds.has(a.officerId)) continue;
      const officer = await ctx.db.get(a.officerId);
      if (!officer || officer.status === "nonaktif") continue;
      uniqueOfficerIds.add(a.officerId);
      validAssignments.push(a);
    }

    let hadir = 0;
    for (const officerId of uniqueOfficerIds) {
      const absensiRecord = await ctx.db
        .query("absensi")
        .withIndex("by_officer_date", (q) =>
          q.eq("officerId", officerId).eq("tanggal", args.tanggal),
        )
        .first();
      if (
        absensiRecord &&
        (absensiRecord.status === "hadir" ||
          absensiRecord.status === "terlambat")
      ) {
        hadir++;
      }
    }

    const total = uniqueOfficerIds.size;
    return { total, hadir, belumAbsen: total - hadir };
  },
});
