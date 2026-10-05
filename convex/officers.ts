import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireRole, requireUser, roleOf } from "./lib/auth";
import { officerStatusValidator } from "./schema/officers";

const officerFields = {
  nama: v.string(),
  nik: v.string(),
  jabatan: v.string(),
  telepon: v.optional(v.string()),
  email: v.optional(v.string()),
  lokasiTugas: v.string(),
  status: officerStatusValidator,
  tanggalMasuk: v.optional(v.string()),
  catatan: v.optional(v.string()),
  reguId: v.optional(v.id("regu")),
  seragam: v.optional(v.string()),
};

export const list = query({
  args: { status: v.optional(officerStatusValidator) },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    if (args.status) {
      const status = args.status;
      return await ctx.db
        .query("officers")
        .withIndex("by_status", (q) => q.eq("status", status))
        .take(500);
    }
    return await ctx.db.query("officers").take(500);
  },
});

export const get = query({
  args: { officerId: v.id("officers") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    return await ctx.db.get(args.officerId);
  },
});

export const stats = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    const all = await ctx.db.query("officers").take(500);
    return {
      total: all.length,
      aktif: all.filter((o) => o.status === "aktif").length,
      cuti: all.filter((o) => o.status === "cuti").length,
      nonaktif: all.filter((o) => o.status === "nonaktif").length,
    };
  },
});

export const create = mutation({
  args: officerFields,
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "supervisor"]);
    const existing = await ctx.db
      .query("officers")
      .withIndex("by_nik", (q) => q.eq("nik", args.nik))
      .first();
    if (existing) {
      throw new ConvexError({
        code: "CONFLICT",
        message: "NIK sudah terdaftar",
      });
    }
    return await ctx.db.insert("officers", args);
  },
});

export const update = mutation({
  args: { officerId: v.id("officers"), ...officerFields },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "supervisor"]);
    const { officerId, ...fields } = args;
    const officer = await ctx.db.get(officerId);
    if (!officer) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Petugas tidak ditemukan",
      });
    }
    if (fields.nik !== officer.nik) {
      const dup = await ctx.db
        .query("officers")
        .withIndex("by_nik", (q) => q.eq("nik", fields.nik))
        .first();
      if (dup) {
        throw new ConvexError({
          code: "CONFLICT",
          message: "NIK sudah terdaftar",
        });
      }
    }
    await ctx.db.patch(officerId, fields);
    return null;
  },
});

export const getMyOfficer = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    return await ctx.db
      .query("officers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
  },
});

export const getMyOfficerWithAtasan = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const officer = await ctx.db
      .query("officers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    if (!officer) return null;

    // Resolve atasan via regu: the danru of the officer's regu is their atasan.
    // If an acting danru is set, that takes priority.
    let atasan: { nama: string; jabatan: string } | null = null;
    if (officer.reguId) {
      const regu = await ctx.db.get(officer.reguId);
      if (regu) {
        const atasanId = regu.actingDanruId ?? regu.danruId ?? null;
        // Avoid pointing an officer to themselves as their own atasan
        if (atasanId && atasanId !== officer._id) {
          const atasanDoc = await ctx.db.get(atasanId);
          if (atasanDoc) {
            atasan = { nama: atasanDoc.nama, jabatan: atasanDoc.jabatan };
          }
        }
      }
    }

    return {
      officer: { nama: officer.nama, jabatan: officer.jabatan },
      atasan,
    };
  },
});

export const linkUser = mutation({
  args: { officerId: v.id("officers"), userId: v.id("users") },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "supervisor"]);
    // Ensure target officer exists
    const officer = await ctx.db.get(args.officerId);
    if (!officer) throw new ConvexError({ code: "NOT_FOUND", message: "Petugas tidak ditemukan" });
    // Ensure this user is not already linked to another officer
    const existing = await ctx.db
      .query("officers")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    if (existing && existing._id !== args.officerId) {
      throw new ConvexError({ code: "CONFLICT", message: "Akun ini sudah terhubung ke petugas lain" });
    }
    await ctx.db.patch(args.officerId, { userId: args.userId });
    return null;
  },
});

export const unlinkUser = mutation({
  args: { officerId: v.id("officers") },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "supervisor"]);
    const officer = await ctx.db.get(args.officerId);
    if (!officer) throw new ConvexError({ code: "NOT_FOUND", message: "Petugas tidak ditemukan" });
    await ctx.db.patch(args.officerId, { userId: undefined });
    return null;
  },
});

export const remove = mutation({
  args: { officerId: v.id("officers") },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["admin"]);
    if (roleOf(user) !== "admin") {
      throw new ConvexError({ code: "FORBIDDEN", message: "Khusus admin" });
    }
    await ctx.db.delete(args.officerId);
    return null;
  },
});
