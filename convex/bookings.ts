import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { auth } from "./auth";

// Get bookings for a schedule
export const getBookingsForSchedule = query({
  args: { scheduleId: v.id("schedules") },
  handler: async (ctx, { scheduleId }) => {
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_schedule", (q) => q.eq("scheduleId", scheduleId))
      .collect();

    return bookings.map((b) => ({
      ...b,
      id: b._id,
      schedule_id: b.scheduleId,
      user_id: b.userId,
    }));
  },
});

// Get user bookings with schedule and tour data
export const getUserBookings = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Enrich with schedule and tour data
    const enrichedBookings = await Promise.all(
      bookings.map(async (booking) => {
        const schedule = await ctx.db.get(booking.scheduleId);
        let tour = null;
        if (schedule) {
          const tourDoc = await ctx.db.get(schedule.tourId);
          if (tourDoc) {
            tour = {
              ...tourDoc.description,
              id: tourDoc._id,
              imageUrl: tourDoc.imageUrl,
              creatorId: tourDoc.creatorId,
            };
          }
        }

        return {
          ...booking,
          id: booking._id,
          schedule_id: booking.scheduleId,
          user_id: booking.userId,
          schedules: schedule
            ? {
                ...schedule,
                id: schedule._id,
                tour_id: schedule.tourId,
                scheduled_date: new Date(schedule.scheduledDate).toISOString(),
                max_participants: schedule.maxParticipants,
                meeting_point: schedule.meetingPoint,
                additional_info: schedule.additionalInfo,
                tours: tour,
              }
            : null,
        };
      })
    );

    return enrichedBookings;
  },
});

// Book a tour
export const bookTour = mutation({
  args: {
    scheduleId: v.id("schedules"),
    name: v.string(),
    email: v.string(),
    participants: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Check schedule exists and has capacity
    const schedule = await ctx.db.get(args.scheduleId);
    if (!schedule) throw new Error("Schedule not found");

    // Get current participants count
    const existingBookings = await ctx.db
      .query("bookings")
      .withIndex("by_schedule", (q) => q.eq("scheduleId", args.scheduleId))
      .collect();

    const currentParticipants = existingBookings.reduce(
      (sum, b) => sum + (b.participants > 0 ? b.participants : 0),
      0
    );

    if (currentParticipants + args.participants > schedule.maxParticipants) {
      throw new Error(
        `Not enough space available. Only ${schedule.maxParticipants - currentParticipants} spots left.`
      );
    }

    const bookingId = await ctx.db.insert("bookings", {
      scheduleId: args.scheduleId,
      userId,
      name: args.name,
      email: args.email,
      participants: args.participants,
      notes: args.notes,
      attended: false,
    });

    return bookingId;
  },
});

// Cancel a booking
export const cancelBooking = mutation({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, { bookingId }) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const booking = await ctx.db.get(bookingId);
    if (!booking) throw new Error("Booking not found");

    // Check ownership or admin status
    const role = await ctx.db
      .query("userRoles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (booking.userId !== userId && role?.role !== "admin") {
      throw new Error("Not authorized to cancel this booking");
    }

    // Mark as cancelled by setting participants to -1
    await ctx.db.patch(bookingId, { participants: -1 });

    return { success: true };
  },
});

// Mark booking as attended
export const markAsAttended = mutation({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, { bookingId }) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const booking = await ctx.db.get(bookingId);
    if (!booking) throw new Error("Booking not found");

    // Get schedule to verify tour ownership
    const schedule = await ctx.db.get(booking.scheduleId);
    if (!schedule) throw new Error("Schedule not found");

    const tour = await ctx.db.get(schedule.tourId);
    if (!tour) throw new Error("Tour not found");

    // Check if user is tour owner or admin
    const role = await ctx.db
      .query("userRoles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (tour.creatorId !== userId && role?.role !== "admin") {
      throw new Error("Not authorized to mark attendance");
    }

    await ctx.db.patch(bookingId, {
      attended: true,
      attendedAt: Date.now(),
    });

    // Return booking with tour info for email notification
    return {
      ...booking,
      tourId: schedule.tourId,
      tourName: tour.description.name,
    };
  },
});

// Check if user has attended a tour
export const hasUserAttendedTour = query({
  args: { userId: v.string(), tourId: v.id("tours") },
  handler: async (ctx, { userId, tourId }) => {
    // Get all schedules for the tour
    const schedules = await ctx.db
      .query("schedules")
      .withIndex("by_tour", (q) => q.eq("tourId", tourId))
      .collect();

    // Check if user has an attended booking for any schedule
    for (const schedule of schedules) {
      const bookings = await ctx.db
        .query("bookings")
        .withIndex("by_schedule", (q) => q.eq("scheduleId", schedule._id))
        .collect();

      const attendedBooking = bookings.find(
        (b) => b.userId === userId && b.attended === true
      );

      if (attendedBooking) return true;
    }

    return false;
  },
});
