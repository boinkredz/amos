/**
 * Dashboard summary queries — lightweight, bounded reads for the home page.
 */
import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireUser, roleOf } from "./lib/auth";

/** Today's absensi stats (hadir + terlambat = present) */
export const todayAbsensiStats = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const records = await ctx.db
      .query("absensi")
      .withIndex("by_date", (q) => q.eq("tanggal", today))
      .collect();
    return {
      hadir: records.filter((r) => r.status === "hadir" || r.status === "terlambat").length,
      alpha: records.filter((r) => r.status === "alpha").length,
      izin: records.filter((r) => r.status === "izin" || r.status === "sakit").length,
      total: records.length,
    };
  },
});

/** 5 most recent laporan harian */
export const recentLaporanHarian = query({
  args: {},
  handler: async (ctx): Promise<Array<{
    _id: string;
    tanggal: string;
    lokasiGedung: string;
    petugasNama: string;
    siteNama: string | null;
    _creationTime: number;
  }>> => {
    const user = await requireUser(ctx);
    const role = roleOf(user);
    let rows;
    if (role === "admin" || role === "supervisor" || role === "hr" || role === "finance") {
      rows = await ctx.db.query("laporanHarian").order("desc").take(5);
    } else {
      rows = await ctx.db
        .query("laporanHarian")
        .withIndex("by_created", (q) => q.eq("createdBy", user._id))
        .order("desc")
        .take(5);
    }
    return await Promise.all(
      rows.map(async (r) => {
        const site = r.siteId ? await ctx.db.get(r.siteId) : null;
        return {
          _id: r._id,
          tanggal: r.tanggal,
          lokasiGedung: r.lokasiGedung,
          petugasNama: r.namaPembuat,
          siteNama: site?.nama ?? null,
          _creationTime: r._creationTime,
        };
      }),
    );
  },
});

/** 5 most recent berita acara */
export const recentBeritaAcara = query({
  args: {},
  handler: async (ctx): Promise<Array<{
    _id: string;
    nomorBA: string;
    tanggal: string;
    jenisInsiden: string;
    lokasiGedung: string;
    petugasNama: string;
    _creationTime: number;
  }>> => {
    const user = await requireUser(ctx);
    const role = roleOf(user);
    let rows;
    if (role === "admin" || role === "supervisor" || role === "hr" || role === "finance") {
      rows = await ctx.db.query("beritaAcara").order("desc").take(5);
    } else {
      rows = await ctx.db
        .query("beritaAcara")
        .withIndex("by_created", (q) => q.eq("createdBy", user._id))
        .order("desc")
        .take(5);
    }
    return rows.map((r) => ({
      _id: r._id,
      nomorBA: r.nomorBA,
      tanggal: r.tanggal,
      jenisInsiden: r.jenisInsiden,
      lokasiGedung: r.lokasiGedung,
      petugasNama: r.petugasNama,
      _creationTime: r._creationTime,
    }));
  },
});

/** 5 most recent tugas patroli */
export const recentPatroli = query({
  args: {},
  handler: async (ctx): Promise<Array<{
    _id: string;
    tanggal: string;
    ruteNama: string | null;
    officerNama: string | null;
    status: string;
    selesai: boolean;
    _creationTime: number;
  }>> => {
    await requireUser(ctx);
    const rows = await ctx.db.query("tugasPatroli").order("desc").take(5);
    return await Promise.all(
      rows.map(async (r) => {
        const [rute, officer] = await Promise.all([
          ctx.db.get(r.ruteId),
          ctx.db.get(r.officerId),
        ]);
        const checkpoints = await ctx.db
          .query("checkpoint")
          .withIndex("by_rute", (q) => q.eq("ruteId", r.ruteId))
          .collect();
        const checklist = await ctx.db
          .query("checklistPatroli")
          .withIndex("by_tugas", (q) => q.eq("tugasId", r._id))
          .collect();
        const selesai =
          checkpoints.length > 0 &&
          checklist.filter((c) => c.dikunjungi).length >= checkpoints.length;
        return {
          _id: r._id,
          tanggal: r.tanggal,
          ruteNama: rute?.nama ?? null,
          officerNama: officer?.nama ?? null,
          status: selesai ? "Selesai" : "Berjalan",
          selesai,
          _creationTime: r._creationTime,
        };
      }),
    );
  },
});

/** 5 most recent serah terima shift */
export const recentSerahTerima = query({
  args: {},
  handler: async (ctx): Promise<Array<{
    _id: string;
    tanggal: string;
    siteNama: string | null;
    officerKeluarNama: string | null;
    officerMasukNama: string | null;
    status: string;
    _creationTime: number;
  }>> => {
    await requireUser(ctx);
    const rows = await ctx.db.query("serahTerima").order("desc").take(5);
    return await Promise.all(
      rows.map(async (r) => {
        const site = await ctx.db.get(r.siteId);
        const assignKeluar = await ctx.db.get(r.shiftKeluarAssignmentId);
        const officerKeluar = assignKeluar?.officerId ? await ctx.db.get(assignKeluar.officerId) : null;
        const assignMasuk = r.shiftMasukAssignmentId
          ? await ctx.db.get(r.shiftMasukAssignmentId)
          : null;
        const officerMasuk = assignMasuk?.officerId ? await ctx.db.get(assignMasuk.officerId) : null;
        return {
          _id: r._id,
          tanggal: r.tanggal,
          siteNama: site?.nama ?? null,
          officerKeluarNama: officerKeluar?.nama ?? null,
          officerMasukNama: officerMasuk?.nama ?? null,
          status: r.status,
          _creationTime: r._creationTime,
        };
      }),
    );
  },
});
