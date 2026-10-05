import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireRole, requireUser, roleOf } from "./lib/auth";
import { getApprovalSetting, peranApprover, userInfo } from "./lib/approval";
import type { ApprovalJenis } from "./lib/approval";
import { ROLE_LABELS } from "./schema/users";
import { approvalJenisValidator } from "./schema/approval";

const JENIS: ApprovalJenis[] = ["cuti", "tukar_shift"];

export const listConfig = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, ["admin"]);
    return await Promise.all(
      JENIS.map(async (jenis) => {
        const s = await getApprovalSetting(ctx, jenis);
        return {
          jenis,
          ...s,
          utama: await userInfo(ctx, s.approverUtamaId),
          cadangan: await userInfo(ctx, s.approverCadanganId),
        };
      }),
    );
  },
});

export const listApproverCandidates = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, ["admin"]);
    const users = await ctx.db.query("users").take(300);
    return users
      .filter((u) => roleOf(u) !== "anggota")
      .map((u) => ({ _id: u._id, name: u.name ?? u.email ?? "Tanpa nama", roleLabel: ROLE_LABELS[roleOf(u)] }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const saveConfig = mutation({
  args: {
    jenis: approvalJenisValidator,
    approverUtamaId: v.optional(v.id("users")),
    approverCadanganId: v.optional(v.id("users")),
    otomatisAktif: v.boolean(),
    otomatisMaksHari: v.optional(v.number()),
    otomatisSesamaRegu: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const admin = await requireRole(ctx, ["admin"]);
    if (args.approverUtamaId && args.approverUtamaId === args.approverCadanganId) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Approver utama dan cadangan harus berbeda orang" });
    }
    if (args.approverCadanganId && !args.approverUtamaId) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Pilih approver utama terlebih dahulu" });
    }
    if (args.otomatisMaksHari !== undefined && (!Number.isInteger(args.otomatisMaksHari) || args.otomatisMaksHari < 1 || args.otomatisMaksHari > 14)) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Batas hari otomatis harus 1–14" });
    }
    const data = {
      jenis: args.jenis,
      approverUtamaId: args.approverUtamaId,
      approverCadanganId: args.approverCadanganId,
      otomatisAktif: args.otomatisAktif,
      otomatisMaksHari: args.otomatisMaksHari,
      otomatisSesamaRegu: args.otomatisSesamaRegu,
      updatedBy: admin._id,
    };
    const existing = await ctx.db.query("approvalConfig").withIndex("by_jenis", (q) => q.eq("jenis", args.jenis)).unique();
    if (existing) await ctx.db.replace(existing._id, data);
    else await ctx.db.insert("approvalConfig", data);
    return null;
  },
});

/** Whether the current user may approve each request type (drives the Setujui/Tolak buttons). */
export const getMyApproverAccess = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const role = roleOf(user);
    const entries = await Promise.all(
      JENIS.map(async (jenis) => {
        const s = await getApprovalSetting(ctx, jenis);
        return [jenis, peranApprover(user._id, role, s, jenis)] as const;
      }),
    );
    return Object.fromEntries(entries) as Record<ApprovalJenis, ReturnType<typeof peranApprover>>;
  },
});
