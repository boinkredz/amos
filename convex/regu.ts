import { ConvexError, v } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireRole, requireUser } from "./lib/auth";

type OfficerRef = { _id: Id<"officers">; nama: string; jabatan: string } | null;

type ReguWithNames = Doc<"regu"> & {
  danru: OfficerRef;
  wadanru: OfficerRef;
  actingDanru: OfficerRef;
  jumlahAnggota: number;
};

async function resolveOfficer(
  ctx: QueryCtx,
  id: Id<"officers"> | undefined,
): Promise<OfficerRef> {
  if (!id) return null;
  const doc = await ctx.db.get(id);
  if (!doc) return null;
  return { _id: doc._id, nama: doc.nama, jabatan: doc.jabatan };
}

async function enrichRegu(ctx: QueryCtx, r: Doc<"regu">): Promise<ReguWithNames> {
  const [danru, wadanru, actingDanru] = await Promise.all([
    resolveOfficer(ctx, r.danruId),
    resolveOfficer(ctx, r.wadanruId),
    resolveOfficer(ctx, r.actingDanruId),
  ]);
  const anggota = await ctx.db
    .query("officers")
    .withIndex("by_regu", (q) => q.eq("reguId", r._id))
    .collect();
  return { ...r, danru, wadanru, actingDanru, jumlahAnggota: anggota.length };
}

export const list = query({
  args: {},
  handler: async (ctx): Promise<ReguWithNames[]> => {
    await requireUser(ctx);
    const regus = await ctx.db.query("regu").collect();
    return await Promise.all(regus.map((r) => enrichRegu(ctx, r)));
  },
});

export const listAktif = query({
  args: {},
  handler: async (ctx): Promise<ReguWithNames[]> => {
    await requireUser(ctx);
    const regus = await ctx.db
      .query("regu")
      .withIndex("by_aktif", (q) => q.eq("aktif", true))
      .collect();
    return await Promise.all(regus.map((r) => enrichRegu(ctx, r)));
  },
});

export const create = mutation({
  args: {
    nama: v.string(),
    isNonShift: v.boolean(),
    tanggalMulaiRotasi: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "supervisor"]);
    return await ctx.db.insert("regu", {
      nama: args.nama,
      isNonShift: args.isNonShift,
      tanggalMulaiRotasi: args.tanggalMulaiRotasi,
      aktif: true,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("regu"),
    nama: v.optional(v.string()),
    danruId: v.optional(v.id("officers")),
    wadanruId: v.optional(v.id("officers")),
    actingDanruId: v.optional(v.id("officers")),
    aktif: v.optional(v.boolean()),
    tanggalMulaiRotasi: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "supervisor"]);
    const doc = await ctx.db.get(args.id);
    if (!doc) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Regu tidak ditemukan" });
    }
    const updates: Partial<Doc<"regu">> = {};
    if (args.nama !== undefined) updates.nama = args.nama;
    if (args.danruId !== undefined) updates.danruId = args.danruId;
    if (args.wadanruId !== undefined) updates.wadanruId = args.wadanruId;
    if (args.actingDanruId !== undefined) updates.actingDanruId = args.actingDanruId;
    if (args.aktif !== undefined) updates.aktif = args.aktif;
    if (args.tanggalMulaiRotasi !== undefined)
      updates.tanggalMulaiRotasi = args.tanggalMulaiRotasi;
    await ctx.db.patch(args.id, updates);
    return null;
  },
});

export const setActingDanru = mutation({
  args: {
    id: v.id("regu"),
    actingDanruId: v.optional(v.id("officers")),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "supervisor", "kepala_sekuriti"]);
    const doc = await ctx.db.get(args.id);
    if (!doc) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Regu tidak ditemukan" });
    }
    await ctx.db.patch(args.id, { actingDanruId: args.actingDanruId });
    return null;
  },
});

export const remove = mutation({
  args: { id: v.id("regu") },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"]);
    const doc = await ctx.db.get(args.id);
    if (!doc) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Regu tidak ditemukan" });
    }
    // Detach officers assigned to this regu
    const anggota = await ctx.db
      .query("officers")
      .withIndex("by_regu", (q) => q.eq("reguId", args.id))
      .collect();
    for (const o of anggota) {
      await ctx.db.patch(o._id, { reguId: undefined });
    }
    await ctx.db.delete(args.id);
    return null;
  },
});
