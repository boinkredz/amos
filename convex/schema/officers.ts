import { defineTable } from "convex/server";
import { v } from "convex/values";

export const officerStatusValidator = v.union(
  v.literal("aktif"),
  v.literal("cuti"),
  v.literal("nonaktif"),
);

export const officers = defineTable({
  // Optional link to an authenticated app user
  userId: v.optional(v.id("users")),
  nama: v.string(),
  nik: v.string(),
  jabatan: v.string(),
  telepon: v.optional(v.string()),
  email: v.optional(v.string()),
  lokasiTugas: v.string(),
  status: officerStatusValidator,
  tanggalMasuk: v.optional(v.string()), // ISO 8601 UTC
  catatan: v.optional(v.string()),
  // Face descriptors for self-attendance (array of 128-dim arrays, stored as JSON string)
  faceDescriptors: v.optional(v.string()),
  faceEnrolledAt: v.optional(v.string()),
  // Convex storage ID for the profile photo used in Absen Mandiri header
  profilePhotoStorageId: v.optional(v.string()),
  // Regu assignment (danru/wadanru resolved via the regu record)
  reguId: v.optional(v.id("regu")),
  // Ukuran / jenis seragam petugas (opsional)
  seragam: v.optional(v.string()),
})
  .index("by_nik", ["nik"])
  .index("by_status", ["status"])
  .index("by_user", ["userId"])
  .index("by_regu", ["reguId"]);
