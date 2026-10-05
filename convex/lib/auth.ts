import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Role } from "../schema/users";
import { DEVICE_LOCKED_ROLES, ROLES } from "../schema/users";

export type { Role };
export { DEVICE_LOCKED_ROLES };

/** Roles that can manage operational tasks (supervisor and above, level <= 3) */
export const MANAGE_OPS_ROLES: ReadonlyArray<Role> = [
  "admin",
  "manager_operasional",
  "kepala_sekuriti",
  "supervisor",
  "koordinator",
];

/** Roles that can manage personnel & master data (jabatan, dsb) */
export const MANAGE_PERSONNEL_ROLES: ReadonlyArray<Role> = [
  "admin",
  "hr",
  "kepala_sekuriti",
  "manager_operasional",
];

export async function requireUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError({
      code: "UNAUTHENTICATED",
      message: "Anda belum masuk",
    });
  }
  const user = await ctx.db
    .query("users")
    .withIndex("by_token", (q) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier),
    )
    .unique();
  if (!user) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Pengguna tidak ditemukan",
    });
  }
  return user;
}

export function roleOf(user: Doc<"users">): Role {
  const raw = user.role;
  // Legacy: "petugas" maps to "anggota"
  if (!raw || raw === "petugas") return "anggota";
  // Guard against unknown values — fall back to "anggota"
  if ((ROLES as ReadonlyArray<string>).includes(raw)) {
    return raw as Role;
  }
  return "anggota";
}

export async function requireRole(
  ctx: QueryCtx | MutationCtx,
  allowed: ReadonlyArray<Role>,
): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (!allowed.includes(roleOf(user))) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Anda tidak memiliki izin untuk tindakan ini",
    });
  }
  return user;
}

/** Check if a role requires device lock */
export function isDeviceLocked(role: Role): boolean {
  return DEVICE_LOCKED_ROLES.includes(role);
}
