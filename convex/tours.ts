import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { auth } from "./auth";

// Get all tours
export const getAllTours = query({
  args: {},
  handler: async (ctx) => {
    const tours = await ctx.db.query("tours").collect();

    // Transform to match the existing frontend format
    return tours.map((tour) => ({
      ...tour.description,
      $id: tour._id,
      id: tour._id,
      _id: tour._id,
      description: JSON.stringify(tour.description),
      imageUrl: tour.imageUrl,
      creatorId: tour.creatorId,
      tourType: tour.description.tourType || "person",
      price: tour.description.price ?? 0,
    }));
  },
});

// Get single tour by ID
export const getTour = query({
  args: { tourId: v.id("tours") },
  handler: async (ctx, { tourId }) => {
    const tour = await ctx.db.get(tourId);
    if (!tour) return null;

    return {
      ...tour,
      id: tour._id,
      $id: tour._id,
    };
  },
});

// Get tour by ID (string version for compatibility)
export const getTourById = query({
  args: { tourId: v.string() },
  handler: async (ctx, { tourId }) => {
    try {
      const tour = await ctx.db.get(tourId as any);
      if (!tour) return null;

      return {
        ...tour,
        id: tour._id,
        $id: tour._id,
      };
    } catch {
      return null;
    }
  },
});

// Get tours by creator
export const getToursByCreator = query({
  args: { creatorId: v.string() },
  handler: async (ctx, { creatorId }) => {
    const tours = await ctx.db
      .query("tours")
      .withIndex("by_creator", (q) => q.eq("creatorId", creatorId))
      .collect();

    return tours.map((tour) => ({
      ...tour.description,
      $id: tour._id,
      id: tour._id,
      _id: tour._id,
      description: JSON.stringify(tour.description),
      imageUrl: tour.imageUrl,
      creatorId: tour.creatorId,
    }));
  },
});

// Create a new tour
export const createTour = mutation({
  args: {
    description: v.object({
      name: v.string(),
      cityId: v.string(),
      languageTaught: v.string(),
      instructionLanguage: v.string(),
      langDifficulty: v.optional(v.string()),
      description: v.string(),
      tourType: v.optional(v.string()),
      price: v.optional(v.number()),
    }),
    imageUrl: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Set default price based on tour type
    const description = { ...args.description };
    if (description.tourType === "app") {
      description.price = 0;
    } else if (!description.price) {
      description.price = 24;
    }

    const tourId = await ctx.db.insert("tours", {
      description,
      imageUrl: args.imageUrl,
      imageStorageId: args.imageStorageId,
      creatorId: userId,
    });

    return tourId;
  },
});

// Update a tour
export const updateTour = mutation({
  args: {
    tourId: v.id("tours"),
    description: v.optional(
      v.object({
        name: v.string(),
        cityId: v.string(),
        languageTaught: v.string(),
        instructionLanguage: v.string(),
        langDifficulty: v.optional(v.string()),
        description: v.string(),
        tourType: v.optional(v.string()),
        price: v.optional(v.number()),
      })
    ),
    imageUrl: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const tour = await ctx.db.get(args.tourId);
    if (!tour) throw new Error("Tour not found");

    // Check ownership or admin status
    const role = await ctx.db
      .query("userRoles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (tour.creatorId !== userId && role?.role !== "admin") {
      throw new Error("Not authorized to update this tour");
    }

    const updates: any = {};
    if (args.description) updates.description = args.description;
    if (args.imageUrl !== undefined) updates.imageUrl = args.imageUrl;
    if (args.imageStorageId !== undefined)
      updates.imageStorageId = args.imageStorageId;

    await ctx.db.patch(args.tourId, updates);

    return { success: true };
  },
});

// Delete a tour (with cascading delete)
export const deleteTour = mutation({
  args: { tourId: v.id("tours") },
  handler: async (ctx, { tourId }) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const tour = await ctx.db.get(tourId);
    if (!tour) throw new Error("Tour not found");

    // Check ownership or admin status
    const role = await ctx.db
      .query("userRoles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (tour.creatorId !== userId && role?.role !== "admin") {
      throw new Error("Not authorized to delete this tour");
    }

    // Delete related schedules and their bookings
    const schedules = await ctx.db
      .query("schedules")
      .withIndex("by_tour", (q) => q.eq("tourId", tourId))
      .collect();

    for (const schedule of schedules) {
      // Delete bookings for each schedule
      const bookings = await ctx.db
        .query("bookings")
        .withIndex("by_schedule", (q) => q.eq("scheduleId", schedule._id))
        .collect();

      for (const booking of bookings) {
        await ctx.db.delete(booking._id);
      }

      await ctx.db.delete(schedule._id);
    }

    // Delete ratings
    const ratings = await ctx.db
      .query("ratings")
      .withIndex("by_tour", (q) => q.eq("tourId", tourId))
      .collect();

    for (const rating of ratings) {
      await ctx.db.delete(rating._id);
    }

    // Delete notifications
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_tour", (q) => q.eq("tourId", tourId))
      .collect();

    for (const notification of notifications) {
      await ctx.db.delete(notification._id);
    }

    // Delete tour image from storage if exists
    if (tour.imageStorageId) {
      await ctx.storage.delete(tour.imageStorageId);
    }

    // Delete the tour
    await ctx.db.delete(tourId);

    return { success: true };
  },
});

// Get tour creator ID
export const getTourCreatorId = query({
  args: { tourId: v.id("tours") },
  handler: async (ctx, { tourId }) => {
    const tour = await ctx.db.get(tourId);
    return tour?.creatorId || null;
  },
});
