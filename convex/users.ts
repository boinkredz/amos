import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireRole, requireUser, roleOf } from "./lib/auth";
import { roleValidator } from "./schema/users";

export const updateCurrentUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // Check if we've already stored this identity before.
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (user !== null) {
      return user._id;
    }
    // First user to sign in becomes the admin of the app.
    const anyExistingUser = await ctx.db.query("users").first();
    return await ctx.db.insert("users", {
      name: identity.name,
      email: identity.email,
      tokenIdentifier: identity.tokenIdentifier,
      role: anyExistingUser === null ? "admin" : "anggota",
    });
  },
});

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "Called getCurrentUser without authentication present",
      });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    return user;
  },
});

export const getMyRole = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    return { userId: user._id, name: user.name, role: roleOf(user) };
  },
});

export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, ["admin"]);
    const users = await ctx.db.query("users").take(200);
    return users.map((u) => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      role: roleOf(u),
    }));
  },
});

export const setUserRole = mutation({
  args: { userId: v.id("users"), role: roleValidator },
  handler: async (ctx, args) => {
    const admin = await requireRole(ctx, ["admin"]);
    if (admin._id === args.userId && args.role !== "admin") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Anda tidak dapat menurunkan peran diri sendiri",
      });
    }
    await ctx.db.patch(args.userId, { role: args.role });
    return null;
  },
});
