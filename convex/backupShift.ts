import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireRole, MANAGE_OPS_ROLES } from "./lib/auth";
import { backupKode } from "./lib/backup";
import { berhalanganAlasanValidator } from "./schema/shifts";
import { notifyOfficer } from "./lib/notify";

const LIBUR_KODE = "L";

function notFound(message: string): never {
  throw new ConvexError({ code: "NOT_FOUND", message });
}

function badRequest(message: string): never {
  throw new ConvexError({ code: "BAD_REQUEST", message });
}

type Candidate = {
  _id: Id<"officers">;
  nama: string;
  jabatan: string;
  reguNama: string | null;
  sedangLibur: boolean;
};

/** Officers free to back up a given assignment: no schedule that day, or scheduled as Libur. */
export const listCandidates = query({
  args: { assignmentId: v.id("shiftAssignments") },
  handler: async (ctx, args): Promise<Candidate[]> => {
    await requireRole(ctx, MANAGE_OPS_ROLES);
    const target = await ctx.db.get(args.assignmentId);
    if (!target) return [];

    const sameDay = await ctx.db
      .query("shiftAssignments")
      .withIndex("by_date", (q) => q.eq("tanggal", target.tanggal))
      .collect();
    const byOfficer = new Map<Id<"officers">, Doc<"shiftAssignments">>(
      sameDay.map((a) => [a.officerId, a]),
    );

    const officers = await ctx.db
      .query("officers")
      .withIndex("by_status", (q) => q.eq("status", "aktif"))
      .collect();
    const regus = await ctx.db.query("regu").collect();
    const reguNama = new Map<Id<"regu">, string>(regus.map((r) => [r._id, r.nama]));

    const result: Candidate[] = [];
    for (const o of officers) {
      if (o._id === target.officerId) continue;
      const existing = byOfficer.get(o._id);
      if (existing && existing.kode !== LIBUR_KODE) continue;
      result.push({
        _id: o._id,
        nama: o.nama,
        jabatan: o.jabatan,
        reguNama: o.reguId ? reguNama.get(o.reguId) ?? null : null,
        sedangLibur: !!existing,
      });
    }
    return result.sort((a, b) => a.nama.localeCompare(b.nama));
  },
});

export const assignBackup = mutation({
  args: {
    assignmentId: v.id("shiftAssignments"),
    backupOfficerId: v.id("officers"),
    alasan: berhalanganAlasanValidator,
    catatan: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"shiftAssignments">> => {
    const user = await requireRole(ctx, MANAGE_OPS_ROLES);
    const original = await ctx.db.get(args.assignmentId);
    if (!original) notFound("Jadwal tidak ditemukan");
    if (original.kode === LIBUR_KODE) badRequest("Jadwal libur tidak memerlukan backup");
    if (original.berhalangan) badRequest("Jadwal ini sudah memiliki backup");
    if (original.backupInfo) badRequest("Personel backup tidak bisa digantikan lagi. Batalkan backup ini dulu");
    if (args.backupOfficerId === original.officerId) badRequest("Pilih personel lain sebagai backup");

    const backupOfficer = await ctx.db.get(args.backupOfficerId);
    if (!backupOfficer || backupOfficer.status !== "aktif") badRequest("Personel backup tidak aktif");

    const originalAbsensi = await ctx.db
      .query("absensi")
      .withIndex("by_assignment", (q) => q.eq("assignmentId", original._id))
      .first();
    if (originalAbsensi?.waktuMasuk) {
      badRequest("Personel sudah absen masuk, tidak bisa ditandai berhalangan");
    }

    const shift = await ctx.db.get(original.shiftId);
    const kode = backupKode(original.kode, shift?.nama ?? "");
    const catatan = `Backup untuk ${(await ctx.db.get(original.officerId))?.nama ?? "personel"}`;

    // Backup takes the same shift, site and date. Reuse their Libur row if they had one.
    const existingBackup = await ctx.db
      .query("shiftAssignments")
      .withIndex("by_officer_date", (q) =>
        q.eq("officerId", args.backupOfficerId).eq("tanggal", original.tanggal),
      )
      .first();
    if (existingBackup && existingBackup.kode !== LIBUR_KODE) {
      throw new ConvexError({ code: "CONFLICT", message: `${backupOfficer.nama} sudah punya jadwal di tanggal ini` });
    }

    const backupFields = {
      shiftId: original.shiftId,
      siteId: original.siteId,
      kode,
      catatan,
    };
    let backupAssignmentId: Id<"shiftAssignments">;
    if (existingBackup) {
      await ctx.db.patch(existingBackup._id, {
        ...backupFields,
        backupInfo: {
          menggantikanAssignmentId: original._id,
          menggantikanOfficerId: original.officerId,
          sebelumnya: {
            shiftId: existingBackup.shiftId,
            siteId: existingBackup.siteId,
            kode: existingBackup.kode,
            catatan: existingBackup.catatan,
          },
        },
      });
      backupAssignmentId = existingBackup._id;
    } else {
      backupAssignmentId = await ctx.db.insert("shiftAssignments", {
        officerId: args.backupOfficerId,
        tanggal: original.tanggal,
        ...backupFields,
        backupInfo: {
          menggantikanAssignmentId: original._id,
          menggantikanOfficerId: original.officerId,
        },
      });
    }

    // Record the absence on the original officer's attendance (unless already recorded)
    let absensiId: Id<"absensi"> | undefined;
    if (!originalAbsensi) {
      absensiId = await ctx.db.insert("absensi", {
        assignmentId: original._id,
        officerId: original.officerId,
        siteId: original.siteId,
        tanggal: original.tanggal,
        status: args.alasan === "sakit" ? "sakit" : "izin",
        keterangan: args.catatan ? `Berhalangan: ${args.catatan}` : "Berhalangan, digantikan backup",
        dicatatOleh: user._id,
      });
    }

    await ctx.db.patch(original._id, {
      berhalangan: {
        alasan: args.alasan,
        catatan: args.catatan,
        backupAssignmentId,
        backupOfficerId: args.backupOfficerId,
        absensiId,
        dicatatOleh: user._id,
        waktu: new Date().toISOString(),
      },
    });

    const site = original.siteId ? await ctx.db.get(original.siteId) : null;
    await notifyOfficer(
      ctx,
      args.backupOfficerId,
      "Anda ditugaskan sebagai backup",
      `${original.tanggal} · ${shift?.nama ?? "Shift"} ${shift ? `(${shift.jamMulai}–${shift.jamSelesai})` : ""}${site ? ` · ${site.nama}` : ""}. ${catatan}.`,
    );

    return backupAssignmentId;
  },
});

/** Undo a backup. Accepts either the original (berhalangan) or the backup assignment. */
export const cancelBackup = mutation({
  args: { assignmentId: v.id("shiftAssignments") },
  handler: async (ctx, args) => {
    await requireRole(ctx, MANAGE_OPS_ROLES);
    const row = await ctx.db.get(args.assignmentId);
    if (!row) notFound("Jadwal tidak ditemukan");

    const original = row.backupInfo ? await ctx.db.get(row.backupInfo.menggantikanAssignmentId) : row;
    if (!original?.berhalangan) badRequest("Jadwal ini tidak memiliki backup");
    const info = original.berhalangan;
    const backup = await ctx.db.get(info.backupAssignmentId);

    if (backup) {
      const backupAbsensi = await ctx.db
        .query("absensi")
        .withIndex("by_assignment", (q) => q.eq("assignmentId", backup._id))
        .first();
      if (backupAbsensi?.waktuMasuk) {
        badRequest("Personel backup sudah absen masuk, backup tidak bisa dibatalkan");
      }
      if (backupAbsensi) await ctx.db.delete(backupAbsensi._id);

      const prev = backup.backupInfo?.sebelumnya;
      if (prev) {
        await ctx.db.patch(backup._id, {
          shiftId: prev.shiftId,
          siteId: prev.siteId,
          kode: prev.kode,
          catatan: prev.catatan,
          backupInfo: undefined,
        });
      } else {
        await ctx.db.delete(backup._id);
      }
    }

    if (info.absensiId) {
      const created = await ctx.db.get(info.absensiId);
      if (created) await ctx.db.delete(created._id);
    }
    await ctx.db.patch(original._id, { berhalangan: undefined });
    return null;
  },
});
