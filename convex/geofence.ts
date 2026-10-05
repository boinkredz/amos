import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireRole, requireUser } from "./lib/auth";

// ─── Geo Fence CRUD ───────────────────────────────────────────────────────────

export const listBySite = query({
  args: { siteId: v.id("sites"), aktifOnly: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const zones =
      args.aktifOnly !== false
        ? await ctx.db
            .query("geoFence")
            .withIndex("by_site_aktif", (q) => q.eq("siteId", args.siteId).eq("aktif", true))
            .collect()
        : await ctx.db
            .query("geoFence")
            .withIndex("by_site", (q) => q.eq("siteId", args.siteId))
            .collect();
    return zones;
  },
});

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    const zones = await ctx.db.query("geoFence").collect();
    return await Promise.all(
      zones.map(async (z) => {
        const site = await ctx.db.get(z.siteId);
        return { ...z, site };
      }),
    );
  },
});

export const create = mutation({
  args: {
    siteId: v.id("sites"),
    nama: v.string(),
    lat: v.number(),
    lng: v.number(),
    radius: v.number(),
    keterangan: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "supervisor"]);
    const site = await ctx.db.get(args.siteId);
    if (!site) throw new ConvexError({ code: "NOT_FOUND", message: "Site tidak ditemukan" });
    return await ctx.db.insert("geoFence", { ...args, aktif: true });
  },
});

export const update = mutation({
  args: {
    zoneId: v.id("geoFence"),
    siteId: v.optional(v.id("sites")),
    nama: v.string(),
    lat: v.number(),
    lng: v.number(),
    radius: v.number(),
    keterangan: v.optional(v.string()),
    aktif: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "supervisor"]);
    const { zoneId, ...fields } = args;
    const zone = await ctx.db.get(zoneId);
    if (!zone) throw new ConvexError({ code: "NOT_FOUND", message: "Zona tidak ditemukan" });
    if (fields.siteId) {
      const site = await ctx.db.get(fields.siteId);
      if (!site) throw new ConvexError({ code: "NOT_FOUND", message: "Site tidak ditemukan" });
    }
    await ctx.db.patch(zoneId, fields);
    return null;
  },
});

export const remove = mutation({
  args: { zoneId: v.id("geoFence") },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"]);
    const zone = await ctx.db.get(args.zoneId);
    if (!zone) throw new ConvexError({ code: "NOT_FOUND", message: "Zona tidak ditemukan" });
    await ctx.db.delete(args.zoneId);
    return null;
  },
});

// ─── Validation helper (server-side) ─────────────────────────────────────────
// Returns the first active zone that contains the given GPS point
export const checkPointInZone = query({
  args: {
    siteId: v.id("sites"),
    lat: v.number(),
    lng: v.number(),
  },
  handler: async (ctx, args): Promise<{ inZone: boolean; zoneName: string | null; distance: number | null }> => {
    await requireUser(ctx);
    const zones = await ctx.db
      .query("geoFence")
      .withIndex("by_site_aktif", (q) => q.eq("siteId", args.siteId).eq("aktif", true))
      .collect();

    for (const zone of zones) {
      const dist = haversineDistance(args.lat, args.lng, zone.lat, zone.lng);
      if (dist <= zone.radius) {
        return { inZone: true, zoneName: zone.nama, distance: Math.round(dist) };
      }
    }
    return { inZone: false, zoneName: null, distance: null };
  },
});

// ─── Haversine formula (meters) ───────────────────────────────────────────────
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
