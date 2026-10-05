import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireRole, requireUser } from "./lib/auth";
import { getAturan, type AturanAbsensi } from "./lib/aturanAbsensi";

export const get = query({
  args: {},
  handler: async (ctx): Promise<AturanAbsensi> => {
    await requireUser(ctx);
    return await getAturan(ctx);
  },
});

export const update = mutation({
  args: {
    toleransiTerlambatMenit: v.number(),
    dendaTerlambat: v.number(),
    dendaPulangCepat: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["admin", "finance", "hr"]);
    const values = {
      toleransiTerlambatMenit: Math.max(0, Math.round(args.toleransiTerlambatMenit)),
      dendaTerlambat: Math.max(0, args.dendaTerlambat),
      dendaPulangCepat: Math.max(0, args.dendaPulangCepat),
      updatedBy: user._id,
    };
    const existing = await ctx.db.query("aturanAbsensi").first();
    if (existing) {
      await ctx.db.patch(existing._id, values);
    } else {
      await ctx.db.insert("aturanAbsensi", values);
    }
    return null;
  },
});
