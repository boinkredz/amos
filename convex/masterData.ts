import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireRole, requireUser, MANAGE_PERSONNEL_ROLES } from "./lib/auth";

// ─── Jabatan ─────────────────────────────────────────────────────────────────

export const listJabatan = query({
  args: { aktifOnly: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    if (args.aktifOnly) {
      return await ctx.db
        .query("masterJabatan")
        .withIndex("by_aktif", (q) => q.eq("aktif", true))
        .collect();
    }
    return await ctx.db.query("masterJabatan").collect();
  },
});

export const createJabatan = mutation({
  args: { nama: v.string() },
  handler: async (ctx, args) => {
    await requireRole(ctx, MANAGE_PERSONNEL_ROLES);
    const existing = await ctx.db
      .query("masterJabatan")
      .filter((q) => q.eq(q.field("nama"), args.nama))
      .first();
    if (existing) {
      throw new ConvexError({ code: "CONFLICT", message: "Jabatan sudah ada" });
    }
    return await ctx.db.insert("masterJabatan", { nama: args.nama, aktif: true });
  },
});

export const updateJabatan = mutation({
  args: { id: v.id("masterJabatan"), nama: v.optional(v.string()), aktif: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    await requireRole(ctx, MANAGE_PERSONNEL_ROLES);
    const doc = await ctx.db.get(args.id);
    if (!doc) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Jabatan tidak ditemukan" });
    }
    const updates: Record<string, unknown> = {};
    if (args.nama !== undefined) updates.nama = args.nama;
    if (args.aktif !== undefined) updates.aktif = args.aktif;
    await ctx.db.patch(args.id, updates);
  },
});

export const deleteJabatan = mutation({
  args: { id: v.id("masterJabatan") },
  handler: async (ctx, args) => {
    await requireRole(ctx, MANAGE_PERSONNEL_ROLES);
    const doc = await ctx.db.get(args.id);
    if (!doc) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Jabatan tidak ditemukan" });
    }
    await ctx.db.delete(args.id);
  },
});

// ─── Lokasi Gedung ───────────────────────────────────────────────────────────

export const listLokasiGedung = query({
  args: { aktifOnly: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    if (args.aktifOnly) {
      return await ctx.db
        .query("masterLokasiGedung")
        .withIndex("by_aktif", (q) => q.eq("aktif", true))
        .collect();
    }
    return await ctx.db.query("masterLokasiGedung").collect();
  },
});

export const createLokasiGedung = mutation({
  args: { nama: v.string() },
  handler: async (ctx, args) => {
    await requireRole(ctx, MANAGE_PERSONNEL_ROLES);
    const existing = await ctx.db
      .query("masterLokasiGedung")
      .filter((q) => q.eq(q.field("nama"), args.nama))
      .first();
    if (existing) {
      throw new ConvexError({ code: "CONFLICT", message: "Lokasi gedung sudah ada" });
    }
    return await ctx.db.insert("masterLokasiGedung", { nama: args.nama, aktif: true });
  },
});

export const updateLokasiGedung = mutation({
  args: { id: v.id("masterLokasiGedung"), nama: v.optional(v.string()), aktif: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    await requireRole(ctx, MANAGE_PERSONNEL_ROLES);
    const doc = await ctx.db.get(args.id);
    if (!doc) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Lokasi gedung tidak ditemukan" });
    }
    const updates: Record<string, unknown> = {};
    if (args.nama !== undefined) updates.nama = args.nama;
    if (args.aktif !== undefined) updates.aktif = args.aktif;
    await ctx.db.patch(args.id, updates);
  },
});

export const deleteLokasiGedung = mutation({
  args: { id: v.id("masterLokasiGedung") },
  handler: async (ctx, args) => {
    await requireRole(ctx, MANAGE_PERSONNEL_ROLES);
    const doc = await ctx.db.get(args.id);
    if (!doc) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Lokasi gedung tidak ditemukan" });
    }
    await ctx.db.delete(args.id);
  },
});
