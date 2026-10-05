import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireRole, requireUser, roleOf } from "./lib/auth";
import {
  kondisiValidator,
  kategoriValidator,
  tindakLanjutStatusValidator,
} from "./schema/perlengkapan";

// ── Master Perlengkapan ────────────────────────────────────────────────────

export const listMaster = query({
  args: { siteId: v.optional(v.id("sites")) },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    if (args.siteId) {
      const siteId = args.siteId;
      return await ctx.db
        .query("masterPerlengkapan")
        .withIndex("by_site", (q) => q.eq("siteId", siteId))
        .collect();
    }
    return await ctx.db.query("masterPerlengkapan").take(500);
  },
});

export const createMaster = mutation({
  args: {
    nama: v.string(),
    kategori: kategoriValidator,
    jumlahStandar: v.number(),
    siteId: v.id("sites"),
    keterangan: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "supervisor"]);
    return await ctx.db.insert("masterPerlengkapan", {
      ...args,
      aktif: true,
    });
  },
});

export const updateMaster = mutation({
  args: {
    id: v.id("masterPerlengkapan"),
    nama: v.optional(v.string()),
    kategori: v.optional(kategoriValidator),
    jumlahStandar: v.optional(v.number()),
    aktif: v.optional(v.boolean()),
    keterangan: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "supervisor"]);
    const { id, ...fields } = args;
    await ctx.db.patch(id, fields);
  },
});

export const deleteMaster = mutation({
  args: { id: v.id("masterPerlengkapan") },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"]);
    await ctx.db.delete(args.id);
  },
});

// ── Cek Perlengkapan ──────────────────────────────────────────────────────

export const submitCek = mutation({
  args: {
    shiftAssignmentId: v.id("shiftAssignments"),
    siteId: v.id("sites"),
    tanggal: v.string(),
    items: v.array(
      v.object({
        perlengkapanId: v.id("masterPerlengkapan"),
        kondisi: kondisiValidator,
        jumlahTersedia: v.number(),
        keterangan: v.optional(v.string()),
        foto: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    // find officer linked to this user
    const officer = await ctx.db
      .query("officers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (!officer) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Data petugas tidak ditemukan" });
    }
    const cekId = await ctx.db.insert("cekPerlengkapan", {
      officerId: officer._id,
      shiftAssignmentId: args.shiftAssignmentId,
      siteId: args.siteId,
      tanggal: args.tanggal,
      items: args.items,
      waktuCek: new Date().toISOString(),
    });
    // auto-create tindakLanjut for rusak/hilang items
    for (const item of args.items) {
      if (item.kondisi === "rusak" || item.kondisi === "hilang") {
        await ctx.db.insert("tindakLanjut", {
          perlengkapanId: item.perlengkapanId,
          siteId: args.siteId,
          jenis: item.kondisi,
          status: "open",
          catatan: item.keterangan,
          updatedBy: user._id,
          cekPerlengkapanId: cekId,
        });
      }
    }
    return cekId;
  },
});

export const listCekBySiteDate = query({
  args: { siteId: v.id("sites"), tanggal: v.string() },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const list = await ctx.db
      .query("cekPerlengkapan")
      .withIndex("by_site_date", (q) =>
        q.eq("siteId", args.siteId).eq("tanggal", args.tanggal),
      )
      .collect();
    return await Promise.all(
      list.map(async (cek) => {
        const officer = await ctx.db.get(cek.officerId);
        const assignment = await ctx.db.get(cek.shiftAssignmentId);
        const shift = assignment?.shiftId ? await ctx.db.get(assignment.shiftId) : null;
        return { ...cek, officerNama: officer?.nama, shiftNama: shift?.nama };
      }),
    );
  },
});

export const getCekByAssignment = query({
  args: { shiftAssignmentId: v.id("shiftAssignments") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    return await ctx.db
      .query("cekPerlengkapan")
      .withIndex("by_assignment", (q) =>
        q.eq("shiftAssignmentId", args.shiftAssignmentId),
      )
      .first();
  },
});

// ── Tindak Lanjut ─────────────────────────────────────────────────────────

export const listTindakLanjutBySite = query({
  args: {
    siteId: v.id("sites"),
    status: v.optional(tindakLanjutStatusValidator),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    let list;
    if (args.status) {
      const status = args.status;
      list = await ctx.db
        .query("tindakLanjut")
        .withIndex("by_site_status", (q) =>
          q.eq("siteId", args.siteId).eq("status", status),
        )
        .collect();
    } else {
      list = await ctx.db
        .query("tindakLanjut")
        .withIndex("by_site_status", (q) => q.eq("siteId", args.siteId))
        .collect();
    }
    return await Promise.all(
      list.map(async (tl) => {
        const alat = await ctx.db.get(tl.perlengkapanId);
        const updater = await ctx.db.get(tl.updatedBy);
        return { ...tl, alatNama: alat?.nama, updaterNama: updater?.name };
      }),
    );
  },
});

export const updateTindakLanjut = mutation({
  args: {
    id: v.id("tindakLanjut"),
    status: tindakLanjutStatusValidator,
    catatan: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["admin", "supervisor"]);
    const { id, ...fields } = args;
    await ctx.db.patch(id, { ...fields, updatedBy: user._id });
  },
});

// ── Serah Terima ──────────────────────────────────────────────────────────

export const submitSerahTerima = mutation({
  args: {
    siteId: v.id("sites"),
    tanggal: v.string(),
    shiftKeluarAssignmentId: v.id("shiftAssignments"),
    cekPerlengkapan: v.array(
      v.object({
        perlengkapanId: v.id("masterPerlengkapan"),
        kondisi: kondisiValidator,
        jumlahTersedia: v.number(),
        keterangan: v.optional(v.string()),
      }),
    ),
    catatanKejadian: v.string(),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    return await ctx.db.insert("serahTerima", {
      siteId: args.siteId,
      tanggal: args.tanggal,
      shiftKeluarAssignmentId: args.shiftKeluarAssignmentId,
      cekPerlengkapan: args.cekPerlengkapan,
      catatanKejadian: args.catatanKejadian,
      konfirmasiMasuk: false,
      waktuSerah: new Date().toISOString(),
      status: "menunggu",
    });
  },
});

export const konfirmasiSerahTerima = mutation({
  args: {
    id: v.id("serahTerima"),
    shiftMasukAssignmentId: v.id("shiftAssignments"),
    catatanMasuk: v.optional(v.string()),
    adaMasalah: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    await ctx.db.patch(args.id, {
      shiftMasukAssignmentId: args.shiftMasukAssignmentId,
      konfirmasiMasuk: true,
      catatanMasuk: args.catatanMasuk,
      waktuKonfirmasi: new Date().toISOString(),
      status: args.adaMasalah ? "ada_masalah" : "selesai",
    });
  },
});

export const listSerahTerimaBySite = query({
  args: { siteId: v.id("sites"), tanggal: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    let list;
    if (args.tanggal) {
      const tanggal = args.tanggal;
      list = await ctx.db
        .query("serahTerima")
        .withIndex("by_site_date", (q) =>
          q.eq("siteId", args.siteId).eq("tanggal", tanggal),
        )
        .collect();
    } else {
      list = await ctx.db
        .query("serahTerima")
        .withIndex("by_site_date", (q) => q.eq("siteId", args.siteId))
        .order("desc")
        .take(50);
    }
    return await Promise.all(
      list.map(async (st) => {
        const assignKeluar = await ctx.db.get(st.shiftKeluarAssignmentId);
        const shiftKeluar = assignKeluar?.shiftId ? await ctx.db.get(assignKeluar.shiftId) : null;
        const officerKeluar = assignKeluar?.officerId ? await ctx.db.get(assignKeluar.officerId) : null;
        const assignMasuk = st.shiftMasukAssignmentId
          ? await ctx.db.get(st.shiftMasukAssignmentId)
          : null;
        const officerMasuk = assignMasuk?.officerId ? await ctx.db.get(assignMasuk.officerId) : null;
        return {
          ...st,
          shiftKeluarNama: shiftKeluar?.nama,
          officerKeluarNama: officerKeluar?.nama,
          officerMasukNama: officerMasuk?.nama,
        };
      }),
    );
  },
});

export const listSerahTerimaMenunggu = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    const list = await ctx.db
      .query("serahTerima")
      .withIndex("by_status", (q) => q.eq("status", "menunggu"))
      .take(50);
    return await Promise.all(
      list.map(async (st) => {
        const site = await ctx.db.get(st.siteId);
        const assignKeluar = await ctx.db.get(st.shiftKeluarAssignmentId);
        const shiftKeluar = assignKeluar?.shiftId ? await ctx.db.get(assignKeluar.shiftId) : null;
        const officerKeluar = assignKeluar?.officerId ? await ctx.db.get(assignKeluar.officerId) : null;
        return {
          ...st,
          siteNama: site?.nama,
          shiftKeluarNama: shiftKeluar?.nama,
          officerKeluarNama: officerKeluar?.nama,
        };
      }),
    );
  },
});

// My today's assignment for shift context
export const getMyTodayAssignment = query({
  args: {},
  handler: async (ctx): Promise<{
    assignmentId: string;
    siteId: string | null;
    shiftNama: string;
    tanggal: string;
  } | null> => {
    const user = await requireUser(ctx);
    const officer = await ctx.db
      .query("officers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (!officer) return null;
    const today = new Date().toISOString().slice(0, 10);
    const assignment = await ctx.db
      .query("shiftAssignments")
      .withIndex("by_officer_date", (q) =>
        q.eq("officerId", officer._id).eq("tanggal", today),
      )
      .first();
    if (!assignment) return null;
    const shift = await ctx.db.get(assignment.shiftId);
    return {
      assignmentId: assignment._id,
      siteId: assignment.siteId ?? null,
      shiftNama: shift?.nama ?? "Shift",
      tanggal: today,
    };
  },
});
