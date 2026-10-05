import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel.js";
import { requireRole, requireUser, MANAGE_OPS_ROLES } from "./lib/auth";
import { patroliStatusValidator } from "./schema/patroli";

// ─── Rute Patroli ─────────────────────────────────────────────────────────────

export const listRute = query({
  args: {
    siteId: v.optional(v.id("sites")),
    aktifOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);

    let rutes;
    if (args.siteId) {
      const siteId = args.siteId;
      rutes = await ctx.db
        .query("rutePatroli")
        .withIndex("by_site", (q) => q.eq("siteId", siteId))
        .collect();
    } else if (args.aktifOnly) {
      rutes = await ctx.db
        .query("rutePatroli")
        .withIndex("by_aktif", (q) => q.eq("aktif", true))
        .collect();
    } else {
      rutes = await ctx.db.query("rutePatroli").collect();
    }

    if (args.aktifOnly) {
      rutes = rutes.filter((r) => r.aktif);
    }

    return await Promise.all(
      rutes.map(async (rute) => {
        const checkpoints = await ctx.db
          .query("checkpoint")
          .withIndex("by_rute", (q) => q.eq("ruteId", rute._id))
          .collect();
        const site = rute.siteId ? await ctx.db.get(rute.siteId) : null;
        return {
          ...rute,
          jumlahCheckpoint: checkpoints.length,
          site: site
            ? { _id: site._id, nama: site.nama, kode: site.kode }
            : null,
        };
      }),
    );
  },
});

export const createRute = mutation({
  args: {
    nama: v.string(),
    siteId: v.optional(v.id("sites")),
    estimasiMenit: v.number(),
    keterangan: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, MANAGE_OPS_ROLES);
    return await ctx.db.insert("rutePatroli", { ...args, aktif: true });
  },
});

export const updateRute = mutation({
  args: {
    ruteId: v.id("rutePatroli"),
    nama: v.string(),
    siteId: v.optional(v.id("sites")),
    estimasiMenit: v.number(),
    keterangan: v.optional(v.string()),
    aktif: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, MANAGE_OPS_ROLES);
    const { ruteId, ...fields } = args;
    const rute = await ctx.db.get(ruteId);
    if (!rute) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Rute tidak ditemukan" });
    }
    await ctx.db.patch(ruteId, fields);
    return null;
  },
});

export const deleteRute = mutation({
  args: { ruteId: v.id("rutePatroli") },
  handler: async (ctx, args) => {
    await requireRole(ctx, MANAGE_OPS_ROLES);
    // Delete all checkpoints first
    const cps = await ctx.db
      .query("checkpoint")
      .withIndex("by_rute", (q) => q.eq("ruteId", args.ruteId))
      .collect();
    for (const cp of cps) {
      await ctx.db.delete(cp._id);
    }
    await ctx.db.delete(args.ruteId);
    return null;
  },
});

// ─── Checkpoints ─────────────────────────────────────────────────────────────

export const listCheckpoints = query({
  args: { ruteId: v.id("rutePatroli") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    return await ctx.db
      .query("checkpoint")
      .withIndex("by_rute_urutan", (q) => q.eq("ruteId", args.ruteId))
      .collect();
  },
});

export const createCheckpoint = mutation({
  args: {
    ruteId: v.id("rutePatroli"),
    nama: v.string(),
    urutan: v.number(),
    deskripsi: v.optional(v.string()),
    koordinat: v.optional(v.object({ lat: v.number(), lng: v.number() })),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, MANAGE_OPS_ROLES);
    return await ctx.db.insert("checkpoint", args);
  },
});

export const updateCheckpoint = mutation({
  args: {
    checkpointId: v.id("checkpoint"),
    nama: v.string(),
    urutan: v.number(),
    deskripsi: v.optional(v.string()),
    koordinat: v.optional(v.object({ lat: v.number(), lng: v.number() })),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, MANAGE_OPS_ROLES);
    const { checkpointId, ...fields } = args;
    const cp = await ctx.db.get(checkpointId);
    if (!cp) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Checkpoint tidak ditemukan" });
    }
    await ctx.db.patch(checkpointId, fields);
    return null;
  },
});

export const deleteCheckpoint = mutation({
  args: { checkpointId: v.id("checkpoint") },
  handler: async (ctx, args) => {
    await requireRole(ctx, MANAGE_OPS_ROLES);
    await ctx.db.delete(args.checkpointId);
    return null;
  },
});

export const getTugasById = query({
  args: { tugasId: v.id("tugasPatroli") },
  handler: async (ctx, args): Promise<{
    _id: Id<"tugasPatroli">;
    ruteId: Id<"rutePatroli">;
    officerId: Id<"officers">;
    tanggal: string;
    jamMulaiRencana: string;
    jamSelesaiRencana: string;
    status: "dijadwalkan" | "berlangsung" | "selesai" | "dibatalkan";
    waktuMulai?: string;
    waktuSelesai?: string;
    catatan?: string;
    catatanHasil?: string;
    lokasiTerakhir?: { lat: number; lng: number };
    laporanDisubmit?: boolean;
    _creationTime: number;
    rute: { _id: string; nama: string; estimasiMenit: number } | null;
    officer: { _id: string; nama: string; jabatan: string } | null;
    totalCheckpoints: number;
    checkpointsDikunjungi: number;
  } | null> => {
    await requireUser(ctx);
    const tugas = await ctx.db.get(args.tugasId);
    if (!tugas) return null;
    const [rute, officer] = await Promise.all([
      ctx.db.get(tugas.ruteId),
      ctx.db.get(tugas.officerId),
    ]);
    const checkpoints = await ctx.db
      .query("checkpoint")
      .withIndex("by_rute", (q) => q.eq("ruteId", tugas.ruteId))
      .collect();
    const checklist = await ctx.db
      .query("checklistPatroli")
      .withIndex("by_tugas", (q) => q.eq("tugasId", tugas._id))
      .collect();
    return {
      ...tugas,
      rute: rute ? { _id: rute._id, nama: rute.nama, estimasiMenit: rute.estimasiMenit } : null,
      officer: officer ? { _id: officer._id, nama: officer.nama, jabatan: officer.jabatan } : null,
      totalCheckpoints: checkpoints.length,
      checkpointsDikunjungi: checklist.filter((c) => c.dikunjungi).length,
    };
  },
});

// ─── Tugas Patroli ────────────────────────────────────────────────────────────

export const listTugas = query({
  args: { tanggal: v.string() },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const tasks = await ctx.db
      .query("tugasPatroli")
      .withIndex("by_date", (q) => q.eq("tanggal", args.tanggal))
      .collect();

    return await Promise.all(
      tasks.map(async (t) => {
        const [rute, officer] = await Promise.all([
          ctx.db.get(t.ruteId),
          ctx.db.get(t.officerId),
        ]);
        const site = t.siteId ? await ctx.db.get(t.siteId) : null;
        const checkpoints = await ctx.db
          .query("checkpoint")
          .withIndex("by_rute", (q) => q.eq("ruteId", t.ruteId))
          .collect();
        const checklist = await ctx.db
          .query("checklistPatroli")
          .withIndex("by_tugas", (q) => q.eq("tugasId", t._id))
          .collect();
        return {
          ...t,
          rute: rute ? { _id: rute._id, nama: rute.nama, estimasiMenit: rute.estimasiMenit } : null,
          officer: officer
            ? { _id: officer._id, nama: officer.nama, jabatan: officer.jabatan }
            : null,
          site: site ? { _id: site._id, nama: site.nama, kode: site.kode } : null,
          totalCheckpoints: checkpoints.length,
          checkpointsDikunjungi: checklist.filter((c) => c.dikunjungi).length,
        };
      }),
    );
  },
});

export const listTugasRange = query({
  args: {
    tanggalMulai: v.string(),
    tanggalSelesai: v.string(),
    officerId: v.optional(v.id("officers")),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);

    let tasks;
    if (args.officerId) {
      const officerId = args.officerId;
      tasks = await ctx.db
        .query("tugasPatroli")
        .withIndex("by_officer_date", (q) =>
          q
            .eq("officerId", officerId)
            .gte("tanggal", args.tanggalMulai)
            .lte("tanggal", args.tanggalSelesai),
        )
        .collect();
    } else {
      tasks = await ctx.db
        .query("tugasPatroli")
        .withIndex("by_date", (q) =>
          q.gte("tanggal", args.tanggalMulai).lte("tanggal", args.tanggalSelesai),
        )
        .collect();
    }

    return await Promise.all(
      tasks.map(async (t) => {
        const [rute, officer] = await Promise.all([
          ctx.db.get(t.ruteId),
          ctx.db.get(t.officerId),
        ]);
        const site = t.siteId ? await ctx.db.get(t.siteId) : null;
        const checkpoints = await ctx.db
          .query("checkpoint")
          .withIndex("by_rute", (q) => q.eq("ruteId", t.ruteId))
          .collect();
        const checklist = await ctx.db
          .query("checklistPatroli")
          .withIndex("by_tugas", (q) => q.eq("tugasId", t._id))
          .collect();
        return {
          ...t,
          rute: rute ? { _id: rute._id, nama: rute.nama, estimasiMenit: rute.estimasiMenit } : null,
          officer: officer
            ? { _id: officer._id, nama: officer.nama, jabatan: officer.jabatan }
            : null,
          site: site ? { _id: site._id, nama: site.nama, kode: site.kode } : null,
          totalCheckpoints: checkpoints.length,
          checkpointsDikunjungi: checklist.filter((c) => c.dikunjungi).length,
        };
      }),
    );
  },
});

export const createTugas = mutation({
  args: {
    ruteId: v.id("rutePatroli"),
    officerId: v.id("officers"),
    reguId: v.optional(v.id("regu")),
    siteId: v.optional(v.id("sites")),
    tanggal: v.string(),
    jamMulaiRencana: v.string(),
    jamSelesaiRencana: v.string(),
    catatan: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, MANAGE_OPS_ROLES);
    return await ctx.db.insert("tugasPatroli", {
      ...args,
      status: "dijadwalkan",
    });
  },
});

export const createTugasRegu = mutation({
  args: {
    ruteId: v.id("rutePatroli"),
    reguId: v.id("regu"),
    siteId: v.optional(v.id("sites")),
    tanggal: v.string(),
    jamMulaiRencana: v.string(),
    jamSelesaiRencana: v.string(),
    catatan: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<number> => {
    await requireRole(ctx, MANAGE_OPS_ROLES);

    const anggota = await ctx.db
      .query("officers")
      .withIndex("by_regu", (q) => q.eq("reguId", args.reguId))
      .collect();
    const aktifAnggota = anggota.filter((o) => o.status === "aktif");

    if (aktifAnggota.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Regu tidak memiliki anggota aktif",
      });
    }

    for (const officer of aktifAnggota) {
      await ctx.db.insert("tugasPatroli", {
        ruteId: args.ruteId,
        officerId: officer._id,
        reguId: args.reguId,
        siteId: args.siteId,
        tanggal: args.tanggal,
        jamMulaiRencana: args.jamMulaiRencana,
        jamSelesaiRencana: args.jamSelesaiRencana,
        catatan: args.catatan,
        status: "dijadwalkan",
      });
    }

    return aktifAnggota.length;
  },
});

export const updateTugas = mutation({
  args: {
    tugasId: v.id("tugasPatroli"),
    ruteId: v.optional(v.id("rutePatroli")),
    officerId: v.optional(v.id("officers")),
    siteId: v.optional(v.id("sites")),
    tanggal: v.optional(v.string()),
    jamMulaiRencana: v.optional(v.string()),
    jamSelesaiRencana: v.optional(v.string()),
    catatan: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, MANAGE_OPS_ROLES);
    const { tugasId, ...fields } = args;
    const tugas = await ctx.db.get(tugasId);
    if (!tugas) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Tugas tidak ditemukan" });
    }
    await ctx.db.patch(tugasId, fields);
    return null;
  },
});

export const updateTugasStatus = mutation({
  args: {
    tugasId: v.id("tugasPatroli"),
    status: patroliStatusValidator,
    waktuMulai: v.optional(v.string()),
    waktuSelesai: v.optional(v.string()),
    catatanHasil: v.optional(v.string()),
    lokasiTerakhir: v.optional(v.object({ lat: v.number(), lng: v.number() })),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, MANAGE_OPS_ROLES);
    const { tugasId, ...fields } = args;
    await ctx.db.patch(tugasId, fields);
    return null;
  },
});

export const deleteTugas = mutation({
  args: { tugasId: v.id("tugasPatroli") },
  handler: async (ctx, args) => {
    await requireRole(ctx, MANAGE_OPS_ROLES);
    // Clean up associated checklist items first
    const checklist = await ctx.db
      .query("checklistPatroli")
      .withIndex("by_tugas", (q) => q.eq("tugasId", args.tugasId))
      .collect();
    for (const c of checklist) {
      await ctx.db.delete(c._id);
    }
    await ctx.db.delete(args.tugasId);
    return null;
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

// ─── Checklist ────────────────────────────────────────────────────────────────

export const saveChecklist = mutation({
  args: {
    tugasId: v.id("tugasPatroli"),
    checkpointId: v.id("checkpoint"),
    dikunjungi: v.boolean(),
    waktuKunjungan: v.optional(v.string()),
    lokasiKunjungan: v.optional(v.object({ lat: v.number(), lng: v.number() })),
    temuanStatus: v.union(
      v.literal("normal"),
      v.literal("temuan"),
      v.literal("darurat"),
    ),
    catatan: v.optional(v.string()),
    fotoId: v.optional(v.id("_storage")),
    validasiGPS: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);

    const fotoUrl = args.fotoId
      ? (await ctx.storage.getUrl(args.fotoId)) ?? undefined
      : undefined;

    const existing = await ctx.db
      .query("checklistPatroli")
      .withIndex("by_tugas_checkpoint", (q) =>
        q.eq("tugasId", args.tugasId).eq("checkpointId", args.checkpointId),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        dikunjungi: args.dikunjungi,
        waktuKunjungan: args.waktuKunjungan,
        lokasiKunjungan: args.lokasiKunjungan,
        temuanStatus: args.temuanStatus,
        catatan: args.catatan,
        fotoId: args.fotoId,
        fotoUrl,
        validasiGPS: args.validasiGPS,
      });
      return existing._id;
    }

    return await ctx.db.insert("checklistPatroli", { ...args, fotoUrl });
  },
});

export const getChecklist = query({
  args: { tugasId: v.id("tugasPatroli") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    return await ctx.db
      .query("checklistPatroli")
      .withIndex("by_tugas", (q) => q.eq("tugasId", args.tugasId))
      .collect();
  },
});

// ─── Stats ────────────────────────────────────────────────────────────────────

export const patroliStats = query({
  args: { bulan: v.string() }, // "YYYY-MM"
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const start = args.bulan + "-01";
    const end = args.bulan + "-31";
    const tasks = await ctx.db
      .query("tugasPatroli")
      .withIndex("by_date", (q) => q.gte("tanggal", start).lte("tanggal", end))
      .collect();
    return {
      total: tasks.length,
      dijadwalkan: tasks.filter((t) => t.status === "dijadwalkan").length,
      berlangsung: tasks.filter((t) => t.status === "berlangsung").length,
      selesai: tasks.filter((t) => t.status === "selesai").length,
      dibatalkan: tasks.filter((t) => t.status === "dibatalkan").length,
    };
  },
});
