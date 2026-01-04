import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { auth } from "./auth";

// Get ratings for a tour
export const getTourRatings = query({
  args: { tourId: v.id("tours") },
  handler: async (ctx, { tourId }) => {
    const ratings = await ctx.db
      .query("ratings")
      .withIndex("by_tour", (q) => q.eq("tourId", tourId))
      .collect();

    return ratings.map((r) => ({
      ...r,
      id: r._id,
      tour_id: r.tourId,
      user_id: r.userId,
      language_learning_rating: r.languageLearningRating,
      informative_rating: r.informativeRating,
      fun_rating: r.funRating,
    }));
  },
});

// Get average ratings for a tour
export const getAverageTourRatings = query({
  args: { tourId: v.id("tours") },
  handler: async (ctx, { tourId }) => {
    const ratings = await ctx.db
      .query("ratings")
      .withIndex("by_tour", (q) => q.eq("tourId", tourId))
      .collect();

    if (ratings.length === 0) {
      return {
        languageLearning: 0,
        informative: 0,
        fun: 0,
        overall: 0,
        count: 0,
      };
    }

    let languageLearningSum = 0;
    let informativeSum = 0;
    let funSum = 0;

    ratings.forEach((rating) => {
      languageLearningSum += rating.languageLearningRating || 0;
      informativeSum += rating.informativeRating || 0;
      funSum += rating.funRating || 0;
    });

    const count = ratings.length;
    const languageLearning = languageLearningSum / count;
    const informative = informativeSum / count;
    const fun = funSum / count;
    const overall = (languageLearning + informative + fun) / 3;

    return { languageLearning, informative, fun, overall, count };
  },
});

// Get average ratings for a creator (all their tours)
export const getCreatorAverageRatings = query({
  args: { creatorId: v.string() },
  handler: async (ctx, { creatorId }) => {
    // Get all tours by this creator
    const tours = await ctx.db
      .query("tours")
      .withIndex("by_creator", (q) => q.eq("creatorId", creatorId))
      .collect();

    if (tours.length === 0) {
      return {
        languageLearning: 0,
        informative: 0,
        fun: 0,
        overall: 0,
        count: 0,
      };
    }

    // Get all ratings for these tours
    let allRatings: any[] = [];
    for (const tour of tours) {
      const ratings = await ctx.db
        .query("ratings")
        .withIndex("by_tour", (q) => q.eq("tourId", tour._id))
        .collect();
      allRatings = [...allRatings, ...ratings];
    }

    if (allRatings.length === 0) {
      return {
        languageLearning: 0,
        informative: 0,
        fun: 0,
        overall: 0,
        count: 0,
      };
    }

    let languageLearningSum = 0;
    let informativeSum = 0;
    let funSum = 0;

    allRatings.forEach((rating) => {
      languageLearningSum += rating.languageLearningRating || 0;
      informativeSum += rating.informativeRating || 0;
      funSum += rating.funRating || 0;
    });

    const count = allRatings.length;
    const languageLearning = languageLearningSum / count;
    const informative = informativeSum / count;
    const fun = funSum / count;
    const overall = (languageLearning + informative + fun) / 3;

    return { languageLearning, informative, fun, overall, count };
  },
});

// Check if user has rated a tour
export const hasUserRatedTour = query({
  args: { userId: v.string(), tourId: v.id("tours") },
  handler: async (ctx, { userId, tourId }) => {
    const ratings = await ctx.db
      .query("ratings")
      .withIndex("by_tour", (q) => q.eq("tourId", tourId))
      .collect();

    return ratings.some((r) => r.userId === userId);
  },
});

// Submit tour rating
export const submitTourRatings = mutation({
  args: {
    tourId: v.id("tours"),
    languageLearningRating: v.number(),
    informativeRating: v.number(),
    funRating: v.number(),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Check if user has already rated this tour
    const existingRatings = await ctx.db
      .query("ratings")
      .withIndex("by_tour", (q) => q.eq("tourId", args.tourId))
      .collect();

    const alreadyRated = existingRatings.some((r) => r.userId === userId);
    if (alreadyRated) {
      throw new Error("You have already rated this tour");
    }

    const ratingId = await ctx.db.insert("ratings", {
      tourId: args.tourId,
      userId,
      languageLearningRating: args.languageLearningRating,
      informativeRating: args.informativeRating,
      funRating: args.funRating,
      comment: args.comment,
    });

    return ratingId;
  },
});
