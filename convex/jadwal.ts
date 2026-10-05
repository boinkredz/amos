import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireRole, MANAGE_OPS_ROLES } from "./lib/auth";
import { isSocKode } from "./lib/backup";

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Map jadwal kode → nama shift template */
const KODE_TO_NAMA: Record<string, string> = {
  P: "Pagi",
  M: "Malam",
  L: "Libur",
  "SOC/P": "SOC/P",
  "SOC/M": "SOC/M",
};

/** Default jam for auto-created shift templates */
const NAMA_TO_JAM: Record<string, { jamMulai: string; jamSelesai: string; warnaTema: string }> = {
  Pagi: { jamMulai: "07:00", jamSelesai: "19:00", warnaTema: "#16A34A" },
  Malam: { jamMulai: "19:00", jamSelesai: "07:00", warnaTema: "#2563EB" },
  Libur: { jamMulai: "00:00", jamSelesai: "00:00", warnaTema: "#9CA3AF" },
  "SOC/P": { jamMulai: "07:00", jamSelesai: "19:00", warnaTema: "#D97706" },
  "SOC/M": { jamMulai: "19:00", jamSelesai: "07:00", warnaTema: "#D97706" },
};

function periodeToRange(periode: string): { mulai: string; selesai: string } {
  const [year, month] = periode.split("-").map(Number);
  const mulai = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const selesai = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { mulai, selesai };
}


// ─── Bulk Save Jadwal ───────────────────────────────────────────────────────

export const bulkSaveJadwal = mutation({
  args: {
    periode: v.string(), // "YYYY-MM"
    entries: v.array(
      v.object({
        officerId: v.id("officers"),
        tanggal: v.string(),
        kode: v.string(),
      }),
    ),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ assignments: number; bonusSoc: number }> => {
    const user = await requireRole(ctx, MANAGE_OPS_ROLES);
    const { mulai, selesai } = periodeToRange(args.periode);

    // 1. Load shift templates and build a nama → id map
    const shifts = await ctx.db.query("shifts").collect();
    const namaToShiftId = new Map<string, Id<"shifts">>();
    for (const s of shifts) {
      namaToShiftId.set(s.nama, s._id);
    }

    // 2. Ensure all required shift templates exist
    const neededNama = new Set<string>();
    for (const e of args.entries) {
      const nama = KODE_TO_NAMA[e.kode];
      if (nama) neededNama.add(nama);
    }
    for (const nama of neededNama) {
      if (!namaToShiftId.has(nama)) {
        const jam = NAMA_TO_JAM[nama] ?? {
          jamMulai: "00:00",
          jamSelesai: "00:00",
          warnaTema: "#6B7280",
        };
        const newId = await ctx.db.insert("shifts", {
          nama,
          jamMulai: jam.jamMulai,
          jamSelesai: jam.jamSelesai,
          warnaTema: jam.warnaTema,
        });
        namaToShiftId.set(nama, newId);
      }
    }

    // 3. Collect distinct officers appearing in this batch
    const officerIds = Array.from(new Set(args.entries.map((e) => e.officerId)));

    // 4. Delete existing shiftAssignments for these officers within the period
    for (const officerId of officerIds) {
      const existing = await ctx.db
        .query("shiftAssignments")
        .withIndex("by_officer_date", (q) =>
          q.eq("officerId", officerId).gte("tanggal", mulai).lte("tanggal", selesai),
        )
        .collect();
      for (const a of existing) {
        await ctx.db.delete(a._id);
      }
    }

    // 5. Delete existing SOC bonus transaksi for these officers within the period
    for (const officerId of officerIds) {
      const trx = await ctx.db
        .query("transaksiKeuangan")
        .withIndex("by_officer_periode", (q) =>
          q.eq("officerId", officerId).eq("periode", args.periode),
        )
        .collect();
      for (const t of trx) {
        if (t.kategori === "bonus_backup") {
          await ctx.db.delete(t._id);
        }
      }
    }

    // 6. Preload gajiKomponen for SOC bonus lookups
    const komponenCache = new Map<Id<"officers">, number>();

    let assignmentCount = 0;
    let bonusSocCount = 0;

    for (const e of args.entries) {
      const nama = KODE_TO_NAMA[e.kode];
      if (!nama) continue; // unknown kode, skip
      const shiftId = namaToShiftId.get(nama);
      if (!shiftId) continue;

      await ctx.db.insert("shiftAssignments", {
        officerId: e.officerId,
        shiftId,
        tanggal: e.tanggal,
        kode: e.kode,
      });
      assignmentCount++;

      // SOC entries get a backup bonus transaction
      if (isSocKode(e.kode)) {
        let bonus = komponenCache.get(e.officerId);
        if (bonus === undefined) {
          const komponen = await ctx.db
            .query("gajiKomponen")
            .withIndex("by_officer", (q) => q.eq("officerId", e.officerId))
            .unique();
          bonus = komponen?.bonusBackup ?? 0;
          komponenCache.set(e.officerId, bonus);
        }
        if (bonus > 0) {
          await ctx.db.insert("transaksiKeuangan", {
            officerId: e.officerId,
            tanggal: e.tanggal,
            tipe: "pemasukan",
            kategori: "bonus_backup",
            jumlah: bonus,
            keterangan: `Bonus backup ${e.kode} (${e.tanggal})`,
            periode: args.periode,
            dicatatOleh: user._id,
          });
          bonusSocCount++;
        }
      }
    }

    return { assignments: assignmentCount, bonusSoc: bonusSocCount };
  },
});

// ─── Get Jadwal Bulan ─────────────────────────────────────────────────────

type JadwalAssignment = {
  _id: Id<"shiftAssignments">;
  officerId: Id<"officers">;
  tanggal: string;
  kode: string | null;
  shiftNama: string | null;
  officerNama: string;
  jabatan: string;
  reguId: Id<"regu"> | null;
  reguNama: string | null;
};

export const getJadwalBulan = query({
  args: { periode: v.string() }, // "YYYY-MM"
  handler: async (ctx, args): Promise<JadwalAssignment[]> => {
    const { mulai, selesai } = periodeToRange(args.periode);

    const assignments = await ctx.db
      .query("shiftAssignments")
      .withIndex("by_date", (q) => q.gte("tanggal", mulai).lte("tanggal", selesai))
      .collect();

    // Preload officers and regu into maps to avoid N+1 lookups
    const officers = await ctx.db.query("officers").collect();
    const officerMap = new Map<Id<"officers">, Doc<"officers">>(
      officers.map((o) => [o._id, o]),
    );
    const regus = await ctx.db.query("regu").collect();
    const reguMap = new Map<Id<"regu">, Doc<"regu">>(regus.map((r) => [r._id, r]));
    const shifts = await ctx.db.query("shifts").collect();
    const shiftMap = new Map<Id<"shifts">, Doc<"shifts">>(shifts.map((s) => [s._id, s]));

    return assignments.map((a) => {
      const officer = officerMap.get(a.officerId) ?? null;
      const regu = officer?.reguId ? reguMap.get(officer.reguId) ?? null : null;
      const shift = shiftMap.get(a.shiftId) ?? null;
      return {
        _id: a._id,
        officerId: a.officerId,
        tanggal: a.tanggal,
        kode: a.kode ?? null,
        shiftNama: shift?.nama ?? null,
        officerNama: officer?.nama ?? "—",
        jabatan: officer?.jabatan ?? "—",
        reguId: officer?.reguId ?? null,
        reguNama: regu?.nama ?? null,
      };
    });
  },
});
