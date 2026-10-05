import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireRole, MANAGE_OPS_ROLES } from "./lib/auth";
import type { Role } from "./lib/auth";
import { shiftWindow } from "./lib/aturanAbsensi";
import { buildMonitoring, kebutuhanKey } from "./lib/monitoring";
import { notifyOfficer } from "./lib/notify";

// Danru can watch their site and send reminders, but not change requirements or assign backups
const MONITOR_ROLES: ReadonlyArray<Role> = [...MANAGE_OPS_ROLES, "danru"];

export const getMonitoring = query({
  args: { tanggal: v.string() },
  handler: async (ctx, args) => {
    await requireRole(ctx, MONITOR_ROLES);

    const [assignments, absensiRows, kebutuhanRows, shifts, sites] = await Promise.all([
      ctx.db.query("shiftAssignments").withIndex("by_date", (q) => q.eq("tanggal", args.tanggal)).collect(),
      ctx.db.query("absensi").withIndex("by_date", (q) => q.eq("tanggal", args.tanggal)).collect(),
      ctx.db.query("kebutuhanPersonel").collect(),
      ctx.db.query("shifts").collect(),
      ctx.db.query("sites").collect(),
    ]);

    const absensiByAssignment = new Map(absensiRows.map((a) => [a.assignmentId, a]));
    const kebutuhan = new Map(kebutuhanRows.map((k) => [kebutuhanKey(k.siteId ?? null, k.shiftId), k.jumlah]));
    const officers = await Promise.all(assignments.map((a) => ctx.db.get(a.officerId)));

    const rows = assignments.map((a, i) => {
      const ab = absensiByAssignment.get(a._id);
      return {
        assignmentId: a._id,
        officerId: a.officerId,
        officerNama: officers[i]?.nama ?? "—",
        jabatan: officers[i]?.jabatan ?? "",
        siteId: a.siteId ?? null,
        shiftId: a.shiftId,
        kode: a.kode,
        berhalangan: !!a.berhalangan,
        isBackup: !!a.backupInfo,
        waktuMasuk: ab?.waktuMasuk,
        isLate: ab?.isLate,
        pengingatWaktu: a.pengingat?.waktu,
      };
    });

    const shiftById = new Map(shifts.map((s) => [s._id, s]));
    const siteById = new Map(sites.map((s) => [s._id, s]));

    return buildMonitoring(rows, kebutuhan)
      .map((g) => {
        const shift = shiftById.get(g.shiftId as Id<"shifts">);
        const site = g.siteId ? siteById.get(g.siteId as Id<"sites">) : undefined;
        const win = shift ? shiftWindow(args.tanggal, shift.jamMulai, shift.jamSelesai) : null;
        return {
          ...g,
          shiftNama: shift?.nama ?? "Shift",
          jamMulai: shift?.jamMulai ?? "",
          jamSelesai: shift?.jamSelesai ?? "",
          warnaTema: shift?.warnaTema,
          siteNama: site?.nama ?? "Tanpa site",
          startMs: win?.startMs ?? 0,
          endMs: win?.endMs ?? 0,
        };
      })
      .sort((a, b) => a.startMs - b.startMs || a.siteNama.localeCompare(b.siteNama));
  },
});

export const listKebutuhan = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, MONITOR_ROLES);
    return await ctx.db.query("kebutuhanPersonel").collect();
  },
});

export const setKebutuhan = mutation({
  args: { siteId: v.optional(v.id("sites")), shiftId: v.id("shifts"), jumlah: v.number() },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, MANAGE_OPS_ROLES);
    if (!Number.isInteger(args.jumlah) || args.jumlah < 1 || args.jumlah > 500) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Kebutuhan harus angka 1–500" });
    }
    const existing = (
      await ctx.db.query("kebutuhanPersonel").withIndex("by_shift", (q) => q.eq("shiftId", args.shiftId)).collect()
    ).find((k) => (k.siteId ?? null) === (args.siteId ?? null));

    if (existing) {
      await ctx.db.patch(existing._id, { jumlah: args.jumlah, updatedBy: user._id });
    } else {
      await ctx.db.insert("kebutuhanPersonel", {
        siteId: args.siteId,
        shiftId: args.shiftId,
        jumlah: args.jumlah,
        updatedBy: user._id,
      });
    }
    return null;
  },
});

/** Manual reminder for officers who have not checked in yet. Returns how many were reminded. */
export const kirimPengingat = mutation({
  args: { assignmentIds: v.array(v.id("shiftAssignments")) },
  handler: async (ctx, args): Promise<number> => {
    const user = await requireRole(ctx, MONITOR_ROLES);
    if (args.assignmentIds.length > 200) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Terlalu banyak personel sekaligus" });
    }
    const waktu = new Date().toISOString();
    let count = 0;
    for (const id of args.assignmentIds) {
      const a = await ctx.db.get(id);
      if (!a || a.berhalangan || a.kode === "L") continue;
      const ab = await ctx.db.query("absensi").withIndex("by_assignment", (q) => q.eq("assignmentId", id)).first();
      if (ab?.waktuMasuk) continue;
      await ctx.db.patch(id, { pengingat: { waktu, dikirimOleh: user._id } });
      const shift = await ctx.db.get(a.shiftId);
      await notifyOfficer(
        ctx,
        a.officerId,
        "Segera check-in",
        `Shift ${shift?.nama ?? ""} ${shift ? `mulai ${shift.jamMulai} WIB` : ""}. Anda belum check-in, mohon segera absen masuk.`,
      );
      count++;
    }
    return count;
  },
});
