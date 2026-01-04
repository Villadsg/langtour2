import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  // Tours table
  tours: defineTable({
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
    creatorId: v.string(),
  }).index("by_creator", ["creatorId"]),

  // Schedules table
  schedules: defineTable({
    tourId: v.id("tours"),
    scheduledDate: v.number(),
    maxParticipants: v.number(),
    meetingPoint: v.string(),
    additionalInfo: v.optional(v.string()),
    price: v.optional(v.number()),
  })
    .index("by_tour", ["tourId"])
    .index("by_date", ["scheduledDate"]),

  // Bookings table
  bookings: defineTable({
    scheduleId: v.id("schedules"),
    userId: v.string(),
    name: v.string(),
    email: v.string(),
    participants: v.number(),
    notes: v.optional(v.string()),
    attended: v.optional(v.boolean()),
    attendedAt: v.optional(v.number()),
  })
    .index("by_schedule", ["scheduleId"])
    .index("by_user", ["userId"]),

  // Ratings table
  ratings: defineTable({
    tourId: v.id("tours"),
    userId: v.string(),
    languageLearningRating: v.number(),
    informativeRating: v.number(),
    funRating: v.number(),
    comment: v.optional(v.string()),
  })
    .index("by_tour", ["tourId"])
    .index("by_user_and_tour", ["userId", "tourId"]),

  // Notifications table
  notifications: defineTable({
    tourId: v.id("tours"),
    email: v.string(),
    createdAt: v.number(),
  }).index("by_tour", ["tourId"]),

  // Public profiles table
  publicProfiles: defineTable({
    userId: v.string(),
    username: v.string(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  // User roles table
  userRoles: defineTable({
    userId: v.string(),
    role: v.string(),
  }).index("by_user", ["userId"]),
});
