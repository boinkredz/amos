import { ConvexError, v } from "convex/values";
import { query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireRole, roleOf, MANAGE_OPS_ROLES } from "./lib/auth";
import type { Role } from "./lib/auth";
import { getAturan } from "./lib/aturanAbsensi";
import { kebutuhanKey } from "./lib/monitoring";
import { hariIniWib, hitungKekurangan, hitungKpiPersonel, jumlahHari, MAX_KPI_DAYS } from "./lib/kpi";

const KPI_ROLES: ReadonlyArray<Role> = [...MANAGE_OPS_ROLES, "hr", "danru"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const getRekapKpi = query({
  args: { tanggalMulai: v.string(), tanggalSelesai: v.string() },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, KPI_ROLES);
    const { tanggalMulai: mulai, tanggalSelesai: selesai } = args;
    if (!DATE_RE.test(mulai) || !DATE_RE.test(selesai) || mulai > selesai) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Rentang tanggal tidak valid" });
    }
    if (jumlahHari(mulai, selesai) > MAX_KPI_DAYS) {
      throw new ConvexError({ code: "BAD_REQUEST", message: `Maksimal ${MAX_KPI_DAYS} hari per laporan` });
    }

    // Danru only sees their own regu
    let allowed: Set<Id<"officers">> | null = null;
    if (roleOf(user) === "danru") {
      const me = await ctx.db.query("officers").withIndex("by_user", (q) => q.eq("userId", user._id)).unique();
      allowed = new Set(me ? [me._id] : []);
      if (me?.reguId) {
        const reguId = me.reguId;
        const anggota = await ctx.db.query("officers").withIndex("by_regu", (q) => q.eq("reguId", reguId)).collect();
        for (const o of anggota) allowed.add(o._id);
      }
    }
    const inScope = (id: Id<"officers">) => allowed === null || allowed.has(id);

    const [assignmentDocs, absensiDocs, kebutuhanRows, shifts, sites, approvedSwaps, aturan] = await Promise.all([
      ctx.db.query("shiftAssignments").withIndex("by_date", (q) => q.gte("tanggal", mulai).lte("tanggal", selesai)).collect(),
      ctx.db.query("absensi").withIndex("by_date", (q) => q.gte("tanggal", mulai).lte("tanggal", selesai)).collect(),
      ctx.db.query("kebutuhanPersonel").collect(),
      ctx.db.query("shifts").collect(),
      ctx.db.query("sites").collect(),
      ctx.db.query("shiftSwapRequests").withIndex("by_status", (q) => q.eq("status", "approved")).order("desc").take(500),
      getAturan(ctx),
    ]);

    const assignments = assignmentDocs.map((a) => ({
      id: a._id as string,
      officerId: a.officerId as string,
      tanggal: a.tanggal,
      siteId: (a.siteId ?? null) as string | null,
      shiftId: a.shiftId as string,
      kode: a.kode,
      berhalangan: !!a.berhalangan,
      isBackup: !!a.backupInfo,
    }));
    const absensi = absensiDocs.map((a) => ({
      assignmentId: a.assignmentId as string,
      officerId: a.officerId as string,
      status: a.status,
      waktuMasuk: a.waktuMasuk,
      keterlambatanMenit: a.keterlambatanMenit,
      isPulangCepat: a.isPulangCepat,
    }));

    // Approved swaps whose shift date falls inside the period count for both officers
    const tukar = new Map<string, number>();
    for (const s of approvedSwaps) {
      const a = await ctx.db.get(s.requesterAssignmentId);
      if (!a || a.tanggal < mulai || a.tanggal > selesai) continue;
      for (const id of [s.requesterId, s.targetId]) tukar.set(id, (tukar.get(id) ?? 0) + 1);
    }

    const hariIni = hariIniWib(Date.now());
    const personelRows = hitungKpiPersonel(
      assignments.filter((a) => inScope(a.officerId as Id<"officers">)),
      absensi.filter((a) => inScope(a.officerId as Id<"officers">)),
      new Map([...tukar].filter(([id]) => inScope(id as Id<"officers">))),
      aturan,
      hariIni,
    );

    const officers = await Promise.all(personelRows.map((r) => ctx.db.get(r.officerId as Id<"officers">)));
    const reguIds = [...new Set(officers.flatMap((o) => (o?.reguId ? [o.reguId] : [])))];
    const regus = await Promise.all(reguIds.map((id) => ctx.db.get(id)));
    const reguNama = new Map(regus.flatMap((r) => (r ? [[r._id as string, r.nama] as const] : [])));

    const personel = personelRows
      .map((r, i) => ({
        ...r,
        nama: officers[i]?.nama ?? "—",
        jabatan: officers[i]?.jabatan ?? "",
        regu: officers[i]?.reguId ? (reguNama.get(officers[i]!.reguId!) ?? "") : "",
      }))
      .sort((a, b) => a.nama.localeCompare(b.nama));

    // Shortage is a site-level metric, so it uses the whole roster (not scoped to a regu)
    const kebutuhan = new Map(kebutuhanRows.map((k) => [kebutuhanKey(k.siteId ?? null, k.shiftId), k.jumlah]));
    const shiftById = new Map(shifts.map((s) => [s._id as string, s]));
    const siteById = new Map(sites.map((s) => [s._id as string, s]));
    const kekurangan = hitungKekurangan(assignments, absensi, kebutuhan, hariIni)
      .map((k) => ({
        ...k,
        siteNama: k.siteId ? (siteById.get(k.siteId)?.nama ?? "—") : "Tanpa site",
        shiftNama: shiftById.get(k.shiftId)?.nama ?? "Shift",
      }))
      .sort((a, b) => a.siteNama.localeCompare(b.siteNama) || a.shiftNama.localeCompare(b.shiftNama));

    return { personel, kekurangan, aturan };
  },
});
