import { ConvexError } from "convex/values";
import type { Infer } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { approvalJenisValidator, persetujuanSebagaiValidator } from "../schema/approval";
import { MANAGE_OPS_ROLES, roleOf } from "./auth";
import type { Role } from "./auth";
import { ROLE_LABELS } from "../schema/users";

export type ApprovalJenis = Infer<typeof approvalJenisValidator>;
export type PersetujuanSebagai = Infer<typeof persetujuanSebagaiValidator>;

export type ApprovalSetting = {
  approverUtamaId: string | null;
  approverCadanganId: string | null;
  otomatisAktif: boolean;
  otomatisMaksHari: number;
  otomatisSesamaRegu: boolean;
};

export const DEFAULT_MAKS_HARI = 1;

// Who may approve when no approver has been configured yet (keeps the old behaviour)
export const FALLBACK_ROLES: Record<ApprovalJenis, ReadonlyArray<Role>> = {
  cuti: ["admin", "supervisor", "hr"],
  tukar_shift: MANAGE_OPS_ROLES,
};

export async function getApprovalSetting(ctx: QueryCtx, jenis: ApprovalJenis): Promise<ApprovalSetting> {
  const row = await ctx.db.query("approvalConfig").withIndex("by_jenis", (q) => q.eq("jenis", jenis)).unique();
  return {
    approverUtamaId: row?.approverUtamaId ?? null,
    approverCadanganId: row?.approverCadanganId ?? null,
    otomatisAktif: row?.otomatisAktif ?? false,
    otomatisMaksHari: row?.otomatisMaksHari ?? DEFAULT_MAKS_HARI,
    otomatisSesamaRegu: row?.otomatisSesamaRegu ?? true,
  };
}

/**
 * In which capacity can this user decide a request? null = not allowed.
 * Super Admin can always override. Without configured approvers, the old role list applies.
 */
export function peranApprover(
  userId: string,
  role: Role,
  setting: ApprovalSetting,
  jenis: ApprovalJenis,
): PersetujuanSebagai | null {
  if (setting.approverUtamaId === userId) return "utama";
  if (setting.approverCadanganId === userId) return "cadangan";
  if (role === "admin") return "admin";
  if (!setting.approverUtamaId && !setting.approverCadanganId && FALLBACK_ROLES[jenis].includes(role)) {
    return "utama";
  }
  return null;
}

export function requireApprover(user: Doc<"users">, setting: ApprovalSetting, jenis: ApprovalJenis): PersetujuanSebagai {
  const sebagai = peranApprover(user._id, roleOf(user), setting, jenis);
  if (!sebagai) {
    throw new ConvexError({ code: "FORBIDDEN", message: "Anda bukan approver untuk pengajuan ini" });
  }
  return sebagai;
}

export function hitungHari(mulai: string, selesai: string): number {
  return Math.round((Date.parse(`${selesai}T12:00:00Z`) - Date.parse(`${mulai}T12:00:00Z`)) / 86400000) + 1;
}

/** Rule text if the leave request qualifies for automatic approval. Sick leave always needs review. */
export function aturanOtomatisCuti(
  setting: ApprovalSetting,
  cuti: { jenis: "cuti" | "sakit"; tanggalMulai: string; tanggalSelesai: string },
): string | null {
  if (!setting.otomatisAktif || cuti.jenis !== "cuti") return null;
  const hari = hitungHari(cuti.tanggalMulai, cuti.tanggalSelesai);
  return hari <= setting.otomatisMaksHari ? `Cuti ${hari} hari (maks. ${setting.otomatisMaksHari} hari)` : null;
}

/** Rule text if the swap qualifies for automatic approval. */
export function aturanOtomatisTukar(
  setting: ApprovalSetting,
  reguPeminta: string | null,
  reguTujuan: string | null,
): string | null {
  if (!setting.otomatisAktif || !setting.otomatisSesamaRegu) return null;
  return reguPeminta && reguPeminta === reguTujuan ? "Tukar shift sesama regu" : null;
}

/** Users who should be told about a new request. */
export async function approverUsers(ctx: MutationCtx, setting: ApprovalSetting): Promise<Doc<"users">[]> {
  const ids = [setting.approverUtamaId, setting.approverCadanganId].filter((id): id is string => !!id);
  const users = await Promise.all(
    ids.map((id) => {
      const nid = ctx.db.normalizeId("users", id);
      return nid ? ctx.db.get(nid) : null;
    }),
  );
  return users.filter((u): u is Doc<"users"> => !!u);
}

export async function userInfo(ctx: QueryCtx, id: string | null) {
  if (!id) return null;
  const nid = ctx.db.normalizeId("users", id);
  const u = nid ? await ctx.db.get(nid) : null;
  return u ? { _id: u._id, name: u.name ?? u.email ?? "Tanpa nama", roleLabel: ROLE_LABELS[roleOf(u)] } : null;
}

/** Resolve the decision on a request into display data. Older rows only have approvedBy. */
export async function describePersetujuan(
  ctx: QueryCtx,
  req: Pick<Doc<"cutiRequests">, "persetujuan" | "approvedBy" | "status">,
) {
  if (req.status === "pending") return null;
  const p = req.persetujuan;
  const oleh = await userInfo(ctx, p?.oleh ?? req.approvedBy ?? null);
  return {
    keputusan: p?.keputusan ?? req.status,
    sebagai: p?.sebagai ?? null,
    waktu: p?.waktu ?? null,
    aturan: p?.aturan ?? null,
    olehNama: oleh?.name ?? null,
    olehPeran: oleh?.roleLabel ?? null,
  };
}
