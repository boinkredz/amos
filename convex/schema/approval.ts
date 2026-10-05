import { defineTable } from "convex/server";
import { v } from "convex/values";

// Request types that go through the approval flow
export const approvalJenisValidator = v.union(v.literal("cuti"), v.literal("tukar_shift"));

export const persetujuanSebagaiValidator = v.union(
  v.literal("utama"),
  v.literal("cadangan"),
  v.literal("admin"),
  v.literal("otomatis"),
);

// Who decided a request and in what capacity (stored on the request)
export const persetujuanValidator = v.object({
  keputusan: v.union(v.literal("approved"), v.literal("rejected")),
  oleh: v.optional(v.id("users")), // empty for automatic approval
  sebagai: persetujuanSebagaiValidator,
  waktu: v.string(), // ISO 8601 UTC
  aturan: v.optional(v.string()), // rule description for automatic approval
});

// One row per request type
export const approvalConfig = defineTable({
  jenis: approvalJenisValidator,
  approverUtamaId: v.optional(v.id("users")),
  approverCadanganId: v.optional(v.id("users")),
  otomatisAktif: v.boolean(),
  // cuti: auto-approve leave of at most this many days
  otomatisMaksHari: v.optional(v.number()),
  // tukar_shift: auto-approve when both officers are in the same regu
  otomatisSesamaRegu: v.optional(v.boolean()),
  updatedBy: v.id("users"),
}).index("by_jenis", ["jenis"]);
