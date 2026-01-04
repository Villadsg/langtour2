import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { auth } from "./auth";

// Get current authenticated user with profile and role
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;

    // Get user's role
    const role = await ctx.db
      .query("userRoles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    // Get user's profile
    const profile = await ctx.db
      .query("publicProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    return {
      id: userId,
      role: role?.role || "user",
      username: profile?.username,
      isAdmin: role?.role === "admin",
    };
  },
});

// Check if current user is admin
export const isAdmin = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return false;

    const role = await ctx.db
      .query("userRoles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    return role?.role === "admin";
  },
});

// Get username by user ID
export const getUsernameById = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const profile = await ctx.db
      .query("publicProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    return profile?.username || `User ${userId.substring(0, 8)}`;
  },
});

// Update user profile
export const updateProfile = mutation({
  args: { username: v.string() },
  handler: async (ctx, { username }) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existingProfile = await ctx.db
      .query("publicProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existingProfile) {
      await ctx.db.patch(existingProfile._id, {
        username,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("publicProfiles", {
        userId,
        username,
        updatedAt: Date.now(),
      });
    }

    return { success: true };
  },
});

// Create public profile (called after signup)
export const createProfile = mutation({
  args: { username: v.string() },
  handler: async (ctx, { username }) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Check if profile already exists
    const existingProfile = await ctx.db
      .query("publicProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existingProfile) {
      return existingProfile;
    }

    const profileId = await ctx.db.insert("publicProfiles", {
      userId,
      username,
      updatedAt: Date.now(),
    });

    return { _id: profileId, userId, username };
  },
});

// Set user role (admin only)
export const setUserRole = mutation({
  args: { targetUserId: v.string(), role: v.string() },
  handler: async (ctx, { targetUserId, role }) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Check if current user is admin
    const currentUserRole = await ctx.db
      .query("userRoles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (currentUserRole?.role !== "admin") {
      throw new Error("Not authorized");
    }

    // Update or create role for target user
    const existingRole = await ctx.db
      .query("userRoles")
      .withIndex("by_user", (q) => q.eq("userId", targetUserId))
      .first();

    if (existingRole) {
      await ctx.db.patch(existingRole._id, { role });
    } else {
      await ctx.db.insert("userRoles", { userId: targetUserId, role });
    }

    return { success: true };
  },
});
