import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireRole, requireUser } from "./lib/auth";
import {
  approverUsers, aturanOtomatisCuti, describePersetujuan, getApprovalSetting, hitungHari, requireApprover,
} from "./lib/approval";
import { notifyOfficer, notifyUsers } from "./lib/notify";

const JATAH_CUTI = 12;

export const getCutiBalance = query({
  args: { officerId: v.id("officers") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const tahun = new Date().getFullYear();
    const balance = await ctx.db
      .query("cutiBalance")
      .withIndex("by_officer_year", (q) =>
        q.eq("officerId", args.officerId).eq("tahun", tahun),
      )
      .unique();
    // Default if not created yet
    return (
      balance ?? {
        officerId: args.officerId,
        tahun,
        jatahTotal: JATAH_CUTI,
        terpakai: 0,
        sisa: JATAH_CUTI,
      }
    );
  },
});

export const getMyCutiBalance = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const officer = await ctx.db
      .query("officers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (!officer) return null;
    const tahun = new Date().getFullYear();
    const balance = await ctx.db
      .query("cutiBalance")
      .withIndex("by_officer_year", (q) =>
        q.eq("officerId", officer._id).eq("tahun", tahun),
      )
      .unique();
    return (
      balance ?? {
        officerId: officer._id,
        tahun,
        jatahTotal: JATAH_CUTI,
        terpakai: 0,
        sisa: JATAH_CUTI,
      }
    );
  },
});

export const requestCuti = mutation({
  args: {
    jenis: v.union(v.literal("cuti"), v.literal("sakit")),
    tanggalMulai: v.string(),
    tanggalSelesai: v.string(),
    alasan: v.string(),
    suratSakit: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const officer = await ctx.db
      .query("officers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (!officer) throw new ConvexError({ code: "NOT_FOUND", message: "Data petugas tidak ditemukan" });
    if (args.tanggalSelesai < args.tanggalMulai) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Tanggal selesai harus setelah tanggal mulai" });
    }

    // For cuti, check saldo
    if (args.jenis === "cuti") {
      const tahun = new Date(args.tanggalMulai).getFullYear();
      const balance = await ctx.db
        .query("cutiBalance")
        .withIndex("by_officer_year", (q) =>
          q.eq("officerId", officer._id).eq("tahun", tahun),
        )
        .unique();
      const sisa = balance?.sisa ?? JATAH_CUTI;

      // Count days requested
      const start = new Date(args.tanggalMulai + "T12:00:00Z");
      const end = new Date(args.tanggalSelesai + "T12:00:00Z");
      const days =
        Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      if (days > sisa) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: `Saldo cuti tidak cukup. Tersisa ${sisa} hari, pengajuan ${days} hari.`,
        });
      }
    }

    const cutiId = await ctx.db.insert("cutiRequests", {
      officerId: officer._id,
      jenis: args.jenis,
      tanggalMulai: args.tanggalMulai,
      tanggalSelesai: args.tanggalSelesai,
      alasan: args.alasan,
      suratSakit: args.suratSakit,
      status: "pending",
      createdBy: user._id,
    });
    await prosesPengajuanBaru(ctx, cutiId);
    return cutiId;
  },
});

// Admin can also submit on behalf of an officer
export const requestCutiForOfficer = mutation({
  args: {
    officerId: v.id("officers"),
    jenis: v.union(v.literal("cuti"), v.literal("sakit")),
    tanggalMulai: v.string(),
    tanggalSelesai: v.string(),
    alasan: v.string(),
    suratSakit: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["admin", "supervisor", "hr"]);
    if (args.tanggalSelesai < args.tanggalMulai) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Tanggal selesai harus setelah tanggal mulai" });
    }
    const cutiId = await ctx.db.insert("cutiRequests", {
      officerId: args.officerId,
      jenis: args.jenis,
      tanggalMulai: args.tanggalMulai,
      tanggalSelesai: args.tanggalSelesai,
      alasan: args.alasan,
      suratSakit: args.suratSakit,
      status: "pending",
      createdBy: user._id,
    });
    await prosesPengajuanBaru(ctx, cutiId);
    return cutiId;
  },
});

export const approveCuti = mutation({
  args: { cutiId: v.id("cutiRequests"), catatan: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const sebagai = requireApprover(user, await getApprovalSetting(ctx, "cuti"), "cuti");
    const cuti = await ctx.db.get(args.cutiId);
    if (!cuti) throw new ConvexError({ code: "NOT_FOUND", message: "Pengajuan tidak ditemukan" });
    if (cuti.status !== "pending") throw new ConvexError({ code: "CONFLICT", message: "Pengajuan sudah diproses" });

    await terapkanCuti(ctx, cuti, {
      keputusan: "approved",
      oleh: user._id,
      sebagai,
      waktu: new Date().toISOString(),
    }, args.catatan);
    return null;
  },
});

type Persetujuan = NonNullable<Doc<"cutiRequests">["persetujuan"]>;

/** Mark a leave request approved: deduct balance, mark absensi, and notify the officer. */
async function terapkanCuti(ctx: MutationCtx, cuti: Doc<"cutiRequests">, persetujuan: Persetujuan, catatan?: string) {
    await ctx.db.patch(cuti._id, {
      status: "approved",
      approvedBy: persetujuan.oleh,
      catatan,
      persetujuan,
    });

    // For cuti (not sakit), deduct from balance
    if (cuti.jenis === "cuti") {
      const tahun = new Date(cuti.tanggalMulai).getFullYear();
      const balance = await ctx.db
        .query("cutiBalance")
        .withIndex("by_officer_year", (q) =>
          q.eq("officerId", cuti.officerId).eq("tahun", tahun),
        )
        .unique();

      const days = hitungHari(cuti.tanggalMulai, cuti.tanggalSelesai);

      if (balance) {
        await ctx.db.patch(balance._id, {
          terpakai: balance.terpakai + days,
          sisa: Math.max(0, balance.sisa - days),
        });
      } else {
        await ctx.db.insert("cutiBalance", {
          officerId: cuti.officerId,
          tahun,
          jatahTotal: JATAH_CUTI,
          terpakai: days,
          sisa: Math.max(0, JATAH_CUTI - days),
        });
      }
    }

    // Mark shiftAssignments in the date range with cuti status
    const start = cuti.tanggalMulai;
    const end = cuti.tanggalSelesai;
    const assignments = await ctx.db
      .query("shiftAssignments")
      .withIndex("by_officer_date", (q) =>
        q.eq("officerId", cuti.officerId).gte("tanggal", start).lte("tanggal", end),
      )
      .take(100);

    const absensiStatus = cuti.jenis === "cuti" ? "izin" : "sakit";
    for (const a of assignments) {
      const existing = await ctx.db
        .query("absensi")
        .withIndex("by_assignment", (q) => q.eq("assignmentId", a._id))
        .first();
      if (!existing) {
        await ctx.db.insert("absensi", {
          assignmentId: a._id,
          officerId: a.officerId,
          siteId: a.siteId,
          tanggal: a.tanggal,
          status: absensiStatus,
          keterangan: cuti.alasan,
          dicatatOleh: persetujuan.oleh,
        });
      }
    }

    const label = cuti.jenis === "cuti" ? "Cuti" : "Izin sakit";
    const olehText = persetujuan.sebagai === "otomatis" ? "otomatis" : "";
    await notifyOfficer(ctx, cuti.officerId, `${label} disetujui ${olehText}`.trim(), `${cuti.tanggalMulai} s/d ${cuti.tanggalSelesai}.`);
}

/** After a request is created: auto-approve by rule, otherwise notify approvers. */
async function prosesPengajuanBaru(ctx: MutationCtx, cutiId: Id<"cutiRequests">) {
  const cuti = await ctx.db.get(cutiId);
  if (!cuti) return;
  const setting = await getApprovalSetting(ctx, "cuti");
  const aturan = aturanOtomatisCuti(setting, cuti);
  if (aturan) {
    await terapkanCuti(ctx, cuti, { keputusan: "approved", sebagai: "otomatis", waktu: new Date().toISOString(), aturan });
    return;
  }
  const officer = await ctx.db.get(cuti.officerId);
  await notifyUsers(
    ctx,
    await approverUsers(ctx, setting),
    "Pengajuan cuti baru",
    `${officer?.nama ?? "Petugas"} · ${cuti.jenis === "cuti" ? "Cuti" : "Sakit"} ${cuti.tanggalMulai} s/d ${cuti.tanggalSelesai}`,
  );
}

export const rejectCuti = mutation({
  args: { cutiId: v.id("cutiRequests"), catatan: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const sebagai = requireApprover(user, await getApprovalSetting(ctx, "cuti"), "cuti");
    const cuti = await ctx.db.get(args.cutiId);
    if (!cuti) throw new ConvexError({ code: "NOT_FOUND", message: "Pengajuan tidak ditemukan" });
    if (cuti.status !== "pending") throw new ConvexError({ code: "CONFLICT", message: "Pengajuan sudah diproses" });
    await ctx.db.patch(args.cutiId, {
      status: "rejected",
      approvedBy: user._id,
      catatan: args.catatan,
      persetujuan: { keputusan: "rejected", oleh: user._id, sebagai, waktu: new Date().toISOString() },
    });
    await notifyOfficer(ctx, cuti.officerId, "Pengajuan cuti ditolak", args.catatan ?? `${cuti.tanggalMulai} s/d ${cuti.tanggalSelesai}`);
    return null;
  },
});

export const listCutiRequests = query({
  args: {
    status: v.optional(
      v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
    ),
    officerId: v.optional(v.id("officers")),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    let list;
    if (args.officerId) {
      list = await ctx.db
        .query("cutiRequests")
        .withIndex("by_officer", (q) => q.eq("officerId", args.officerId!))
        .order("desc")
        .take(100);
    } else if (args.status) {
      const status = args.status;
      list = await ctx.db
        .query("cutiRequests")
        .withIndex("by_status", (q) => q.eq("status", status))
        .order("desc")
        .take(100);
    } else {
      list = await ctx.db.query("cutiRequests").order("desc").take(100);
    }

    return await Promise.all(
      list.map(async (c) => {
        const officer = await ctx.db.get(c.officerId);
        let suratSakitUrl: string | null = null;
        if (c.suratSakit) {
          suratSakitUrl = await ctx.storage
            .getUrl(c.suratSakit as `${string}`)
            .catch(() => null);
        }
        return { ...c, officerNama: officer?.nama, suratSakitUrl, keputusan: await describePersetujuan(ctx, c) };
      }),
    );
  },
});

export const getMyCutiRequests = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const officer = await ctx.db
      .query("officers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (!officer) return [];
    const list = await ctx.db
      .query("cutiRequests")
      .withIndex("by_officer", (q) => q.eq("officerId", officer._id))
      .order("desc")
      .take(50);
    return await Promise.all(
      list.map(async (c) => {
        let suratSakitUrl: string | null = null;
        if (c.suratSakit) {
          suratSakitUrl = await ctx.storage
            .getUrl(c.suratSakit as `${string}`)
            .catch(() => null);
        }
        return { ...c, officerNama: undefined, suratSakitUrl, keputusan: await describePersetujuan(ctx, c) };
      }),
    );
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const resetCutiAllOfficers = mutation({
  args: { tahun: v.number() },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"]);
    const officers = await ctx.db.query("officers").take(500);
    for (const officer of officers) {
      const existing = await ctx.db
        .query("cutiBalance")
        .withIndex("by_officer_year", (q) =>
          q.eq("officerId", officer._id).eq("tahun", args.tahun),
        )
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, {
          jatahTotal: JATAH_CUTI,
          terpakai: 0,
          sisa: JATAH_CUTI,
        });
      } else {
        await ctx.db.insert("cutiBalance", {
          officerId: officer._id,
          tahun: args.tahun,
          jatahTotal: JATAH_CUTI,
          terpakai: 0,
          sisa: JATAH_CUTI,
        });
      }
    }
  },
});
