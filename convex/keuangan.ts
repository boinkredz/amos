import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireRole, requireUser, roleOf } from "./lib/auth";
import type { Doc, Id } from "./_generated/dataModel";
import { countBackupShifts } from "./lib/backup";
import { getAturan, type AturanAbsensi } from "./lib/aturanAbsensi";
import type { QueryCtx } from "./_generated/server";

// ─── helpers ────────────────────────────────────────────────────────────────

function currentPeriode(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function periodeToRange(periode: string): { mulai: string; selesai: string } {
  const [year, month] = periode.split("-").map(Number);
  const mulai = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const selesai = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { mulai, selesai };
}

type RekapBreakdown = Doc<"rekapGaji">["breakdown"];

// Shared payroll calculation used by single and bulk rekap generation
async function hitungRekap(
  ctx: QueryCtx,
  officerId: Id<"officers">,
  periode: string,
  mulai: string,
  selesai: string,
  komponen: Doc<"gajiKomponen"> | null,
  aturan: AturanAbsensi,
): Promise<{ totalPemasukan: number; totalPotongan: number; gajiBersih: number; breakdown: RekapBreakdown }> {
  const jumlahBackup = await countBackupShifts(ctx, officerId, mulai, selesai);

  const absensiRows = await ctx.db
    .query("absensi")
    .withIndex("by_officer_date", (q) =>
      q.eq("officerId", officerId).gte("tanggal", mulai).lte("tanggal", selesai),
    )
    .collect();
  const terlambatRows = absensiRows.filter((a) => a.status === "terlambat" || a.isLate === true);
  const jumlahTerlambat = terlambatRows.length;
  const menitTerlambat = terlambatRows.reduce((s, a) => s + (a.keterlambatanMenit ?? 0), 0);
  const jumlahPulangCepat = absensiRows.filter((a) => a.isPulangCepat === true).length;

  const transaksi = await ctx.db
    .query("transaksiKeuangan")
    .withIndex("by_officer_periode", (q) => q.eq("officerId", officerId).eq("periode", periode))
    .collect();
  const sumBy = (pred: (t: Doc<"transaksiKeuangan">) => boolean) =>
    transaksi.filter(pred).reduce((s, t) => s + t.jumlah, 0);
  const cicilanKasbon = sumBy((t) => t.kategori === "cicilan_kasbon");
  const potonganManual = sumBy((t) => t.tipe === "pengeluaran" && t.kategori === "manual");
  const tambahanManual = sumBy((t) => t.tipe === "pemasukan" && t.kategori === "manual");

  const gp = komponen?.gajiPokok ?? 0;
  const tj = komponen?.tunjangan ?? 0;
  const bb = (komponen?.bonusBackup ?? 0) * jumlahBackup;
  const dendaTerlambat = aturan.dendaTerlambat * jumlahTerlambat;
  const dendaPulangCepat = aturan.dendaPulangCepat * jumlahPulangCepat;
  const bpjs = Math.round(((komponen?.bpjsPersen ?? 0) / 100) * gp);
  const pajak = Math.round(((komponen?.pajakPersen ?? 0) / 100) * gp);

  const totalPemasukan = gp + tj + bb + tambahanManual;
  const totalPotongan = dendaTerlambat + dendaPulangCepat + cicilanKasbon + bpjs + pajak + potonganManual;

  return {
    totalPemasukan,
    totalPotongan,
    gajiBersih: totalPemasukan - totalPotongan,
    breakdown: {
      gajiPokok: gp,
      tunjangan: tj,
      bonusBackup: bb,
      jumlahBackup,
      dendaTerlambat,
      menitTerlambat,
      jumlahTerlambat,
      dendaPulangCepat,
      jumlahPulangCepat,
      cicilanKasbon,
      bpjs,
      pajak,
      potonganManual,
      tambahanManual,
    },
  };
}

// ─── Komponen Gaji ──────────────────────────────────────────────────────────

export const getKomponen = query({
  args: { officerId: v.id("officers") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const role = roleOf(user);
    // Officers can only view their own
    if (role === "anggota" || role === "danru") {
      const officer = await ctx.db
        .query("officers")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .unique();
      if (!officer || officer._id !== args.officerId) {
        throw new ConvexError({ code: "FORBIDDEN", message: "Akses ditolak" });
      }
    }
    return await ctx.db
      .query("gajiKomponen")
      .withIndex("by_officer", (q) => q.eq("officerId", args.officerId))
      .unique();
  },
});

export const listKomponen = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, ["admin", "finance", "hr", "supervisor"]);
    const rows = await ctx.db.query("gajiKomponen").collect();
    const officers = await ctx.db.query("officers").collect();
    const officerMap = new Map(officers.map((o) => [o._id, o]));
    return rows.map((r) => ({ ...r, officerNama: officerMap.get(r.officerId)?.nama ?? "" }));
  },
});

export const upsertKomponen = mutation({
  args: {
    officerId: v.id("officers"),
    gajiPokok: v.number(),
    tunjangan: v.number(),
    bonusBackup: v.number(),
    dendaPerMenit: v.number(),
    bpjsPersen: v.number(),
    pajakPersen: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["admin", "finance", "hr"]);
    const existing = await ctx.db
      .query("gajiKomponen")
      .withIndex("by_officer", (q) => q.eq("officerId", args.officerId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedBy: user._id });
    } else {
      await ctx.db.insert("gajiKomponen", { ...args, updatedBy: user._id });
    }
    return null;
  },
});

// ─── Kasbon ─────────────────────────────────────────────────────────────────

export const listKasbon = query({
  args: { officerId: v.optional(v.id("officers")), status: v.optional(v.union(v.literal("aktif"), v.literal("lunas"))) },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "finance", "hr", "supervisor"]);
    const officers = await ctx.db.query("officers").collect();
    const officerMap = new Map(officers.map((o) => [o._id, o]));

    let rows: Doc<"kasbon">[];
    if (args.officerId) {
      rows = await ctx.db
        .query("kasbon")
        .withIndex("by_officer", (q) => q.eq("officerId", args.officerId!))
        .collect();
    } else {
      rows = await ctx.db.query("kasbon").collect();
    }
    if (args.status) {
      rows = rows.filter((r) => r.status === args.status);
    }
    return rows.map((r) => ({ ...r, officerNama: officerMap.get(r.officerId)?.nama ?? "" }));
  },
});

export const getMyKasbon = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const officer = await ctx.db
      .query("officers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (!officer) return [];
    return await ctx.db
      .query("kasbon")
      .withIndex("by_officer", (q) => q.eq("officerId", officer._id))
      .collect();
  },
});

export const createKasbon = mutation({
  args: {
    officerId: v.id("officers"),
    jumlah: v.number(),
    cicilanPerBulan: v.number(),
    tanggalPinjam: v.string(),
    keterangan: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["admin", "finance"]);
    await ctx.db.insert("kasbon", {
      officerId: args.officerId,
      jumlah: args.jumlah,
      sisa: args.jumlah,
      cicilanPerBulan: args.cicilanPerBulan,
      tanggalPinjam: args.tanggalPinjam,
      keterangan: args.keterangan,
      status: "aktif",
      dicatatOleh: user._id,
    });
    return null;
  },
});

export const bayarKasbon = mutation({
  args: { kasbonId: v.id("kasbon"), jumlahBayar: v.number() },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["admin", "finance"]);
    const kasbon = await ctx.db.get(args.kasbonId);
    if (!kasbon) throw new ConvexError({ code: "NOT_FOUND", message: "Kasbon tidak ditemukan" });
    const newSisa = Math.max(0, kasbon.sisa - args.jumlahBayar);
    await ctx.db.patch(args.kasbonId, {
      sisa: newSisa,
      status: newSisa === 0 ? "lunas" : "aktif",
    });
    // Record transaction
    const today = new Date().toISOString().slice(0, 10);
    await ctx.db.insert("transaksiKeuangan", {
      officerId: kasbon.officerId,
      tanggal: today,
      tipe: "pengeluaran",
      kategori: "cicilan_kasbon",
      jumlah: args.jumlahBayar,
      keterangan: `Cicilan kasbon`,
      periode: today.slice(0, 7),
      kasbonId: args.kasbonId,
      dicatatOleh: user._id,
    });
    return null;
  },
});

// ─── Transaksi Manual ───────────────────────────────────────────────────────

export const listTransaksi = query({
  args: {
    officerId: v.optional(v.id("officers")),
    periode: v.string(),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "finance", "hr", "supervisor"]);
    const officers = await ctx.db.query("officers").collect();
    const officerMap = new Map(officers.map((o) => [o._id, o]));

    let rows: Doc<"transaksiKeuangan">[];
    if (args.officerId) {
      rows = await ctx.db
        .query("transaksiKeuangan")
        .withIndex("by_officer_periode", (q) =>
          q.eq("officerId", args.officerId!).eq("periode", args.periode),
        )
        .collect();
    } else {
      rows = await ctx.db
        .query("transaksiKeuangan")
        .withIndex("by_periode", (q) => q.eq("periode", args.periode))
        .collect();
    }
    return rows.map((r) => ({ ...r, officerNama: officerMap.get(r.officerId)?.nama ?? "" }));
  },
});

export const getMyTransaksi = query({
  args: { periode: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const officer = await ctx.db
      .query("officers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (!officer) return [];
    return await ctx.db
      .query("transaksiKeuangan")
      .withIndex("by_officer_periode", (q) =>
        q.eq("officerId", officer._id).eq("periode", args.periode),
      )
      .collect();
  },
});

export const addTransaksiManual = mutation({
  args: {
    officerId: v.id("officers"),
    tanggal: v.string(),
    tipe: v.union(v.literal("pemasukan"), v.literal("pengeluaran")),
    kategori: v.string(),
    jumlah: v.number(),
    keterangan: v.optional(v.string()),
    periode: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["admin", "finance"]);
    await ctx.db.insert("transaksiKeuangan", { ...args, dicatatOleh: user._id });
    return null;
  },
});

export const deleteTransaksi = mutation({
  args: { transaksiId: v.id("transaksiKeuangan") },
  handler: async (ctx, _args) => {
    await requireRole(ctx, ["admin", "finance"]);
    await ctx.db.delete(_args.transaksiId);
    return null;
  },
});

// ─── Rekap Gaji ─────────────────────────────────────────────────────────────

export const listRekap = query({
  args: { periode: v.string() },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "finance", "hr", "supervisor"]);
    const rows = await ctx.db
      .query("rekapGaji")
      .withIndex("by_periode", (q) => q.eq("periode", args.periode))
      .collect();
    const officers = await ctx.db.query("officers").collect();
    const officerMap = new Map(officers.map((o) => [o._id, o]));
    return rows.map((r) => ({ ...r, officerNama: officerMap.get(r.officerId)?.nama ?? "" }));
  },
});

export const getMyRekap = query({
  args: { periode: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const officer = await ctx.db
      .query("officers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (!officer) return null;
    return await ctx.db
      .query("rekapGaji")
      .withIndex("by_officer_periode", (q) =>
        q.eq("officerId", officer._id).eq("periode", args.periode),
      )
      .unique();
  },
});

export const generateRekap = mutation({
  args: { officerId: v.id("officers"), periode: v.string() },
  handler: async (ctx, args): Promise<Id<"rekapGaji">> => {
    const user = await requireRole(ctx, ["admin", "finance"]);
    const officer = await ctx.db.get(args.officerId);
    if (!officer) throw new ConvexError({ code: "NOT_FOUND", message: "Petugas tidak ditemukan" });

    const komponen = await ctx.db
      .query("gajiKomponen")
      .withIndex("by_officer", (q) => q.eq("officerId", args.officerId))
      .unique();

    const { mulai, selesai } = periodeToRange(args.periode);
    const aturan = await getAturan(ctx);
    const { totalPemasukan, totalPotongan, gajiBersih, breakdown } = await hitungRekap(
      ctx, args.officerId, args.periode, mulai, selesai, komponen, aturan,
    );

    // Upsert
    const existing = await ctx.db
      .query("rekapGaji")
      .withIndex("by_officer_periode", (q) =>
        q.eq("officerId", args.officerId).eq("periode", args.periode),
      )
      .unique();

    if (existing) {
      if (existing.status === "final") {
        throw new ConvexError({ code: "CONFLICT", message: "Rekap sudah difinalisasi, tidak bisa digenerate ulang" });
      }
      await ctx.db.patch(existing._id, { totalPemasukan, totalPotongan, gajiBersih, breakdown });
      return existing._id;
    } else {
      return await ctx.db.insert("rekapGaji", {
        officerId: args.officerId,
        periode: args.periode,
        totalPemasukan,
        totalPotongan,
        gajiBersih,
        status: "draft",
        breakdown,
      });
    }
  },
});

export const generateRekapAllOfficers = mutation({
  args: { periode: v.string() },
  handler: async (ctx, args): Promise<{ sukses: number; gagal: number }> => {
    await requireRole(ctx, ["admin", "finance"]);
    const officers = await ctx.db.query("officers").filter((q) => q.eq(q.field("status"), "aktif")).collect();
    const aturan = await getAturan(ctx);
    const { mulai, selesai } = periodeToRange(args.periode);
    let sukses = 0;
    let gagal = 0;
    for (const o of officers) {
      try {
        const komponen = await ctx.db
          .query("gajiKomponen")
          .withIndex("by_officer", (q) => q.eq("officerId", o._id))
          .unique();
        if (!komponen) { gagal++; continue; }

        const existing = await ctx.db
          .query("rekapGaji")
          .withIndex("by_officer_periode", (q) =>
            q.eq("officerId", o._id).eq("periode", args.periode),
          )
          .unique();
        if (existing?.status === "final") { sukses++; continue; }

        const { totalPemasukan, totalPotongan, gajiBersih, breakdown } = await hitungRekap(
          ctx, o._id, args.periode, mulai, selesai, komponen, aturan,
        );

        if (existing) {
          await ctx.db.patch(existing._id, { totalPemasukan, totalPotongan, gajiBersih, breakdown });
        } else {
          await ctx.db.insert("rekapGaji", { officerId: o._id, periode: args.periode, totalPemasukan, totalPotongan, gajiBersih, status: "draft", breakdown });
        }
        sukses++;
      } catch {
        gagal++;
      }
    }
    return { sukses, gagal };
  },
});

export const finalisasiRekap = mutation({
  args: { rekapId: v.id("rekapGaji") },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["admin", "finance"]);
    const rekap = await ctx.db.get(args.rekapId);
    if (!rekap) throw new ConvexError({ code: "NOT_FOUND", message: "Rekap tidak ditemukan" });
    if (rekap.status === "final") throw new ConvexError({ code: "CONFLICT", message: "Sudah final" });
    await ctx.db.patch(args.rekapId, {
      status: "final",
      difinalisasiOleh: user._id,
      difinalisasiAt: new Date().toISOString(),
    });
    return null;
  },
});

export const batalFinalisasi = mutation({
  args: { rekapId: v.id("rekapGaji") },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"]);
    await ctx.db.patch(args.rekapId, { status: "draft", difinalisasiOleh: undefined, difinalisasiAt: undefined });
    return null;
  },
});
