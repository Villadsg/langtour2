import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { auth } from "./auth";

// Get schedules for a tour
export const getSchedulesForTour = query({
  args: { tourId: v.id("tours") },
  handler: async (ctx, { tourId }) => {
    const schedules = await ctx.db
      .query("schedules")
      .withIndex("by_tour", (q) => q.eq("tourId", tourId))
      .collect();

    // Transform to match frontend expectations
    return schedules.map((s) => ({
      ...s,
      id: s._id,
      tour_id: s.tourId,
      scheduled_date: new Date(s.scheduledDate).toISOString(),
      max_participants: s.maxParticipants,
      meeting_point: s.meetingPoint,
      additional_info: s.additionalInfo,
    }));
  },
});

// Get schedule by ID
export const getScheduleById = query({
  args: { scheduleId: v.id("schedules") },
  handler: async (ctx, { scheduleId }) => {
    const schedule = await ctx.db.get(scheduleId);
    if (!schedule) return null;

    return {
      ...schedule,
      id: schedule._id,
      tour_id: schedule.tourId,
      scheduled_date: new Date(schedule.scheduledDate).toISOString(),
      max_participants: schedule.maxParticipants,
      meeting_point: schedule.meetingPoint,
      additional_info: schedule.additionalInfo,
    };
  },
});

// Get upcoming scheduled tours with tour data
export const getUpcomingScheduledTours = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    const schedules = await ctx.db
      .query("schedules")
      .withIndex("by_date", (q) => q.gt("scheduledDate", now))
      .order("asc")
      .collect();

    // Enrich with tour data
    const enrichedSchedules = await Promise.all(
      schedules.map(async (schedule) => {
        const tour = await ctx.db.get(schedule.tourId);
        return {
          ...schedule,
          id: schedule._id,
          tour_id: schedule.tourId,
          scheduled_date: new Date(schedule.scheduledDate).toISOString(),
          max_participants: schedule.maxParticipants,
          meeting_point: schedule.meetingPoint,
          additional_info: schedule.additionalInfo,
          tours: tour
            ? {
                ...tour.description,
                id: tour._id,
                imageUrl: tour.imageUrl,
                creatorId: tour.creatorId,
              }
            : null,
        };
      })
    );

    return enrichedSchedules;
  },
});

// Get next scheduled tour for a specific tour
export const getNextScheduledTour = query({
  args: { tourId: v.id("tours") },
  handler: async (ctx, { tourId }) => {
    const now = Date.now();

    const schedules = await ctx.db
      .query("schedules")
      .withIndex("by_tour", (q) => q.eq("tourId", tourId))
      .collect();

    // Filter future schedules and sort by date
    const futureSchedules = schedules
      .filter((s) => s.scheduledDate > now)
      .sort((a, b) => a.scheduledDate - b.scheduledDate);

    if (futureSchedules.length === 0) return null;

    const schedule = futureSchedules[0];
    return {
      ...schedule,
      id: schedule._id,
      tour_id: schedule.tourId,
      scheduled_date: new Date(schedule.scheduledDate).toISOString(),
      max_participants: schedule.maxParticipants,
      meeting_point: schedule.meetingPoint,
      additional_info: schedule.additionalInfo,
    };
  },
});

// Create a schedule
export const createSchedule = mutation({
  args: {
    tourId: v.id("tours"),
    scheduledDate: v.number(),
    maxParticipants: v.number(),
    meetingPoint: v.string(),
    additionalInfo: v.optional(v.string()),
    price: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Verify user owns the tour or is admin
    const tour = await ctx.db.get(args.tourId);
    if (!tour) throw new Error("Tour not found");

    const role = await ctx.db
      .query("userRoles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (tour.creatorId !== userId && role?.role !== "admin") {
      throw new Error("Not authorized to schedule this tour");
    }

    const scheduleId = await ctx.db.insert("schedules", {
      tourId: args.tourId,
      scheduledDate: args.scheduledDate,
      maxParticipants: args.maxParticipants,
      meetingPoint: args.meetingPoint,
      additionalInfo: args.additionalInfo,
      price: args.price,
    });

    return scheduleId;
  },
});

// Cancel (delete) a schedule
export const cancelSchedule = mutation({
  args: { scheduleId: v.id("schedules") },
  handler: async (ctx, { scheduleId }) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const schedule = await ctx.db.get(scheduleId);
    if (!schedule) throw new Error("Schedule not found");

    const tour = await ctx.db.get(schedule.tourId);
    if (!tour) throw new Error("Tour not found");

    // Check ownership or admin status
    const role = await ctx.db
      .query("userRoles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (tour.creatorId !== userId && role?.role !== "admin") {
      throw new Error("Not authorized to cancel this schedule");
    }

    // Delete related bookings
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_schedule", (q) => q.eq("scheduleId", scheduleId))
      .collect();

    for (const booking of bookings) {
      await ctx.db.delete(booking._id);
    }

    await ctx.db.delete(scheduleId);

    return { success: true };
  },
});
