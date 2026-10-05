import { defineTable } from "convex/server";
import { v } from "convex/values";

export const ROLES = [
  "admin",
  "manager_operasional",
  "kepala_sekuriti",
  "supervisor",
  "koordinator",
  "danru",
  "wadanru",
  "anggota",
  "finance",
  "hr",
] as const;

export type Role = (typeof ROLES)[number];

export const roleValidator = v.union(
  v.literal("admin"),
  v.literal("manager_operasional"),
  v.literal("kepala_sekuriti"),
  v.literal("supervisor"),
  v.literal("koordinator"),
  v.literal("danru"),
  v.literal("wadanru"),
  v.literal("anggota"),
  v.literal("finance"),
  v.literal("hr"),
  // Legacy role — kept for backward compatibility during migration
  v.literal("petugas"),
);

/** Roles that require device lock */
// TEMPORARILY DISABLED — set back to ["supervisor", "danru", "wadanru", "anggota"] to re-enable
export const DEVICE_LOCKED_ROLES: ReadonlyArray<Role> = [];

/** Numeric hierarchy level per role (smaller = higher authority) */
export const ROLE_LEVEL: Record<Role, number> = {
  admin: 0,
  manager_operasional: 1,
  kepala_sekuriti: 2,
  supervisor: 3,
  koordinator: 4,
  danru: 5,
  wadanru: 6,
  anggota: 7,
  finance: 8,
  hr: 9,
};

/** Label display per role (Bahasa Indonesia) */
export const ROLE_LABELS: Record<Role, string> = {
  admin: "Super Admin",
  manager_operasional: "SOC Manager",
  kepala_sekuriti: "Chief Security Officer (CSO)",
  supervisor: "Supervisor",
  koordinator: "Admin",
  danru: "Danru",
  wadanru: "Wadanru",
  anggota: "Anggota Regu",
  finance: "Finance",
  hr: "HR",
};

export const users = defineTable({
  tokenIdentifier: v.string(),
  name: v.optional(v.string()),
  email: v.optional(v.string()),
  role: v.optional(roleValidator),
}).index("by_token", ["tokenIdentifier"]);
