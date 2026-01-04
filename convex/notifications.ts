import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Save notification request
export const saveNotification = mutation({
  args: {
    tourId: v.id("tours"),
    email: v.string(),
  },
  handler: async (ctx, { tourId, email }) => {
    const notificationId = await ctx.db.insert("notifications", {
      tourId,
      email,
      createdAt: Date.now(),
    });

    return notificationId;
  },
});

// Get notifications for a tour
export const getNotificationsForTour = query({
  args: { tourId: v.id("tours") },
  handler: async (ctx, { tourId }) => {
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_tour", (q) => q.eq("tourId", tourId))
      .collect();

    return notifications;
  },
});
