import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireRole, requireUser, roleOf, isDeviceLocked } from "./lib/auth";

/**
 * Register a device for the current user.
 * Only applies to danru/anggota roles.
 * If user already has a different device registered, throws an error.
 */
export const registerDevice = mutation({
  args: {
    deviceFingerprint: v.string(),
    deviceInfo: v.string(),
  },
  handler: async (ctx, args): Promise<{ registered: boolean; blocked: boolean }> => {
    const user = await requireUser(ctx);
    const role = roleOf(user);

    // Non-locked roles don't need device registration
    if (!isDeviceLocked(role)) {
      return { registered: false, blocked: false };
    }

    // Check if user already has an active device
    const existing = await ctx.db
      .query("deviceRegistrations")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("aktif"), true))
      .first();

    if (existing) {
      // Same device — OK
      if (existing.deviceFingerprint === args.deviceFingerprint) {
        return { registered: true, blocked: false };
      }
      // Different device — BLOCK
      return { registered: false, blocked: true };
    }

    // First login — register this device
    await ctx.db.insert("deviceRegistrations", {
      userId: user._id,
      deviceFingerprint: args.deviceFingerprint,
      deviceInfo: args.deviceInfo,
      registeredAt: new Date().toISOString(),
      aktif: true,
    });

    return { registered: true, blocked: false };
  },
});

/**
 * Check if current user's device is valid.
 * Returns status for the frontend to show/block UI.
 */
export const checkDevice = query({
  args: {
    deviceFingerprint: v.string(),
  },
  handler: async (ctx, args): Promise<{ requiresLock: boolean; isValid: boolean; hasRegistration: boolean }> => {
    const user = await requireUser(ctx);
    const role = roleOf(user);

    if (!isDeviceLocked(role)) {
      return { requiresLock: false, isValid: true, hasRegistration: false };
    }

    const existing = await ctx.db
      .query("deviceRegistrations")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("aktif"), true))
      .first();

    if (!existing) {
      // No device registered yet — needs registration
      return { requiresLock: true, isValid: false, hasRegistration: false };
    }

    return {
      requiresLock: true,
      isValid: existing.deviceFingerprint === args.deviceFingerprint,
      hasRegistration: true,
    };
  },
});

/**
 * Admin: unlock a user's device (remove registration so they can login on a new device)
 */
export const unlockDevice = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<null> => {
    await requireRole(ctx, ["admin"]);

    const registrations = await ctx.db
      .query("deviceRegistrations")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("aktif"), true))
      .collect();

    for (const reg of registrations) {
      await ctx.db.patch(reg._id, { aktif: false });
    }

    return null;
  },
});

/**
 * Admin: list all device registrations (active only)
 */
export const listDevices = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, ["admin"]);

    const allRegistrations = await ctx.db
      .query("deviceRegistrations")
      .filter((q) => q.eq(q.field("aktif"), true))
      .collect();

    // Enrich with user info
    const results = await Promise.all(
      allRegistrations.map(async (reg) => {
        const user = await ctx.db.get(reg.userId);
        return {
          _id: reg._id,
          userId: reg.userId,
          userName: user?.name ?? "Unknown",
          userEmail: user?.email,
          userRole: user ? roleOf(user) : "anggota",
          deviceFingerprint: reg.deviceFingerprint,
          deviceInfo: reg.deviceInfo,
          registeredAt: reg.registeredAt,
        };
      }),
    );

    return results;
  },
});
