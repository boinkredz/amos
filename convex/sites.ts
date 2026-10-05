import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireRole, requireUser } from "./lib/auth";

// ─── Sites ────────────────────────────────────────────────────────────────────

export const list = query({
  args: { aktifOnly: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const sites =
      args.aktifOnly === true
        ? await ctx.db
            .query("sites")
            .withIndex("by_aktif", (q) => q.eq("aktif", true))
            .collect()
        : await ctx.db.query("sites").collect();

    // Enrich with officer count
    return await Promise.all(
      sites.map(async (site) => {
        const count = await ctx.db
          .query("siteOfficers")
          .withIndex("by_site_aktif", (q) =>
            q.eq("siteId", site._id).eq("aktif", true),
          )
          .collect();
        return { ...site, jumlahPetugas: count.length };
      }),
    );
  },
});

export const get = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    return await ctx.db.get(args.siteId);
  },
});

export const create = mutation({
  args: {
    nama: v.string(),
    kode: v.string(),
    alamat: v.string(),
    kota: v.optional(v.string()),
    koordinat: v.optional(v.object({ lat: v.number(), lng: v.number() })),
    keterangan: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "supervisor"]);
    const existing = await ctx.db
      .query("sites")
      .withIndex("by_kode", (q) => q.eq("kode", args.kode.toUpperCase()))
      .first();
    if (existing) {
      throw new ConvexError({ code: "CONFLICT", message: "Kode site sudah digunakan" });
    }
    return await ctx.db.insert("sites", {
      ...args,
      kode: args.kode.toUpperCase(),
      aktif: true,
    });
  },
});

export const update = mutation({
  args: {
    siteId: v.id("sites"),
    nama: v.string(),
    kode: v.string(),
    alamat: v.string(),
    kota: v.optional(v.string()),
    koordinat: v.optional(v.object({ lat: v.number(), lng: v.number() })),
    keterangan: v.optional(v.string()),
    aktif: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "supervisor"]);
    const { siteId, ...fields } = args;
    const site = await ctx.db.get(siteId);
    if (!site) throw new ConvexError({ code: "NOT_FOUND", message: "Site tidak ditemukan" });

    // Check kode uniqueness if changed
    if (fields.kode.toUpperCase() !== site.kode) {
      const dup = await ctx.db
        .query("sites")
        .withIndex("by_kode", (q) => q.eq("kode", fields.kode.toUpperCase()))
        .first();
      if (dup) throw new ConvexError({ code: "CONFLICT", message: "Kode site sudah digunakan" });
    }
    await ctx.db.patch(siteId, { ...fields, kode: fields.kode.toUpperCase() });
    return null;
  },
});

export const remove = mutation({
  args: { siteId: v.id("sites") },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"]);
    // Remove all officer assignments
    const assignments = await ctx.db
      .query("siteOfficers")
      .withIndex("by_site", (q) => q.eq("siteId", args.siteId))
      .collect();
    for (const a of assignments) await ctx.db.delete(a._id);
    await ctx.db.delete(args.siteId);
    return null;
  },
});

// ─── Site Officers ────────────────────────────────────────────────────────────

export const listOfficers = query({
  args: { siteId: v.id("sites"), aktifOnly: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const rows =
      args.aktifOnly !== false
        ? await ctx.db
            .query("siteOfficers")
            .withIndex("by_site_aktif", (q) =>
              q.eq("siteId", args.siteId).eq("aktif", true),
            )
            .collect()
        : await ctx.db
            .query("siteOfficers")
            .withIndex("by_site", (q) => q.eq("siteId", args.siteId))
            .collect();

    return await Promise.all(
      rows.map(async (row) => {
        const officer = await ctx.db.get(row.officerId);
        return { ...row, officer };
      }),
    );
  },
});

export const assignOfficer = mutation({
  args: {
    siteId: v.id("sites"),
    officerId: v.id("officers"),
    tanggalMulai: v.string(),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "supervisor"]);
    // Deactivate existing active assignment for this officer at this site
    const existing = await ctx.db
      .query("siteOfficers")
      .withIndex("by_site_aktif", (q) =>
        q.eq("siteId", args.siteId).eq("aktif", true),
      )
      .filter((q) => q.eq(q.field("officerId"), args.officerId))
      .first();
    if (existing) {
      throw new ConvexError({
        code: "CONFLICT",
        message: "Petugas sudah ditugaskan di site ini",
      });
    }
    return await ctx.db.insert("siteOfficers", { ...args, aktif: true });
  },
});

export const unassignOfficer = mutation({
  args: { siteOfficerId: v.id("siteOfficers"), tanggalSelesai: v.string() },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "supervisor"]);
    await ctx.db.patch(args.siteOfficerId, {
      aktif: false,
      tanggalSelesai: args.tanggalSelesai,
    });
    return null;
  },
});

// Get all sites an officer is assigned to (active)
export const getOfficerSites = query({
  args: { officerId: v.id("officers") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const rows = await ctx.db
      .query("siteOfficers")
      .withIndex("by_officer", (q) => q.eq("officerId", args.officerId))
      .filter((q) => q.eq(q.field("aktif"), true))
      .collect();
    return await Promise.all(
      rows.map(async (row) => {
        const site = await ctx.db.get(row.siteId);
        return { ...row, site };
      }),
    );
  },
});
