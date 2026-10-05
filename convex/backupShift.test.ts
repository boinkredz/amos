import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";
import { countBackupShifts } from "./lib/backup";

const TOKEN = "https://test|admin";

async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    await ctx.db.insert("users", { tokenIdentifier: TOKEN, role: "admin" });
    const mk = (nama: string) =>
      ctx.db.insert("officers", { nama, nik: nama, jabatan: "Anggota", lokasiTugas: "-", status: "aktif" });
    const utama = await mk("Andi");
    const cadangan = await mk("Budi");
    const libur = await mk("Citra");
    const sibuk = await mk("Dedi");
    const pagi = await ctx.db.insert("shifts", { nama: "Pagi", jamMulai: "07:00", jamSelesai: "19:00" });
    const liburShift = await ctx.db.insert("shifts", { nama: "Libur", jamMulai: "00:00", jamSelesai: "00:00" });
    const tanggal = "2026-09-29";
    const original = await ctx.db.insert("shiftAssignments", { officerId: utama, shiftId: pagi, tanggal, kode: "P" });
    const liburRow = await ctx.db.insert("shiftAssignments", { officerId: libur, shiftId: liburShift, tanggal, kode: "L" });
    await ctx.db.insert("shiftAssignments", { officerId: sibuk, shiftId: pagi, tanggal, kode: "P" });
    return { utama, cadangan, libur, sibuk, pagi, liburShift, original, liburRow, tanggal };
  });
  return { t, as: t.withIdentity({ tokenIdentifier: TOKEN }), ...ids };
}

describe("backupShift", () => {
  it("lists only free or off-duty officers as candidates", async () => {
    const { as, original, cadangan, libur } = await setup();
    const list = await as.query(api.backupShift.listCandidates, { assignmentId: original });
    expect(list.map((c) => c._id).sort()).toEqual([cadangan, libur].sort());
  });

  it("marks the original berhalangan, creates a SOC backup, and counts it as a bonus", async () => {
    const { t, as, original, cadangan, utama, tanggal } = await setup();
    const backupId = await as.mutation(api.backupShift.assignBackup, {
      assignmentId: original, backupOfficerId: cadangan, alasan: "sakit",
    });
    await t.run(async (ctx) => {
      const orig = await ctx.db.get(original);
      const backup = await ctx.db.get(backupId);
      expect(orig?.berhalangan?.backupOfficerId).toBe(cadangan);
      expect(backup?.kode).toBe("SOC/P");
      expect(backup?.backupInfo?.menggantikanOfficerId).toBe(utama);
      const absensi = await ctx.db.query("absensi").withIndex("by_assignment", (q) => q.eq("assignmentId", original)).first();
      expect(absensi?.status).toBe("sakit");
      expect(await countBackupShifts(ctx, cadangan, tanggal, tanggal)).toBe(1);
    });
  });

  it("cancel restores both schedules, including a backup who was on Libur", async () => {
    const { t, as, original, libur, liburShift, tanggal } = await setup();
    await as.mutation(api.backupShift.assignBackup, { assignmentId: original, backupOfficerId: libur, alasan: "izin" });
    await as.mutation(api.backupShift.cancelBackup, { assignmentId: original });
    await t.run(async (ctx) => {
      const orig = await ctx.db.get(original);
      expect(orig?.berhalangan).toBeUndefined();
      const absensi = await ctx.db.query("absensi").withIndex("by_assignment", (q) => q.eq("assignmentId", original)).first();
      expect(absensi).toBeNull();
      const liburRow = await ctx.db.query("shiftAssignments")
        .withIndex("by_officer_date", (q) => q.eq("officerId", libur).eq("tanggal", tanggal)).first();
      expect(liburRow?.kode).toBe("L");
      expect(liburRow?.shiftId).toBe(liburShift);
      expect(liburRow?.backupInfo).toBeUndefined();
    });
  });

  it("rejects a backup who already works that day", async () => {
    const { as, original, sibuk } = await setup();
    await expect(
      as.mutation(api.backupShift.assignBackup, { assignmentId: original, backupOfficerId: sibuk, alasan: "sakit" }),
    ).rejects.toThrow();
  });
});
