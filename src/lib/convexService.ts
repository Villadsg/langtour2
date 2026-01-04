import { convex } from "./convex";
import { api } from "../../convex/_generated/api";
import { writable } from "svelte/store";
import type { Id } from "../../convex/_generated/dataModel";

// Create stores for state management (matching supabaseService)
export const currentUser = writable<any | null>(null);
export const isAdmin = writable<boolean>(false);
export const userCreatedTours = writable<any[]>([]);

export const ConvexService = {
  // Authentication methods
  async getAccount() {
    try {
      const user = await convex.query(api.users.getCurrentUser, {});
      currentUser.set(user);

      if (user) {
        isAdmin.set(user.isAdmin === true);

        // Fetch user created tours
        const tours = await convex.query(api.tours.getToursByCreator, {
          creatorId: user.id,
        });
        userCreatedTours.set(tours || []);
      } else {
        currentUser.set(null);
        isAdmin.set(false);
        userCreatedTours.set([]);
      }

      return user;
    } catch (error) {
      console.error("Error getting account:", error);
      currentUser.set(null);
      isAdmin.set(false);
      userCreatedTours.set([]);
      return null;
    }
  },

  hasAdminAccess(): boolean {
    let adminStatus = false;
    isAdmin.subscribe((value) => {
      adminStatus = value;
    })();
    return adminStatus;
  },

  // Authentication methods using Convex Auth
  async createAccount(email: string, password: string, name: string) {
    try {
      await convex.action(api.auth.signIn, {
        provider: "password",
        params: {
          email,
          password,
          flow: "signUp",
          name,
        },
      });

      // Create the public profile
      await convex.mutation(api.users.createProfile, {
        username: name || email.split("@")[0],
      });

      // Fetch the user after signup
      const user = await this.getAccount();
      return user;
    } catch (error) {
      console.error("Error creating account:", error);
      throw error;
    }
  },

  async login(email: string, password: string) {
    try {
      await convex.action(api.auth.signIn, {
        provider: "password",
        params: {
          email,
          password,
          flow: "signIn",
        },
      });

      // Fetch the user after login
      const user = await this.getAccount();
      return user;
    } catch (error) {
      console.error("Error logging in:", error);
      throw error;
    }
  },

  async logout() {
    try {
      await convex.action(api.auth.signOut, {});
    } catch (error) {
      console.error("Error logging out:", error);
    }
    currentUser.set(null);
    isAdmin.set(false);
    userCreatedTours.set([]);
  },

  async resendConfirmationEmail(email: string) {
    // Convex Auth handles email verification differently
    // This is a placeholder - email verification may need additional setup
    console.log("Resend confirmation email requested for:", email);
    return { success: true, message: "If email verification is enabled, a new email will be sent." };
  },

  // Tour methods
  async createTour(tourData: any, userId?: string) {
    try {
      const tourId = await convex.mutation(api.tours.createTour, {
        description: {
          name: tourData.name || "",
          cityId: tourData.cityId || "",
          languageTaught: tourData.languageTaught || "",
          instructionLanguage: tourData.instructionLanguage || "",
          langDifficulty: tourData.langDifficulty,
          description: tourData.description || "",
          tourType: tourData.tourType,
          price: tourData.price,
        },
        imageUrl: tourData.imageUrl,
      });
      return { _id: tourId, id: tourId };
    } catch (error) {
      console.error("Error creating tour:", error);
      throw error;
    }
  },

  async updateTour(tourId: string, tourData: any) {
    try {
      await convex.mutation(api.tours.updateTour, {
        tourId: tourId as Id<"tours">,
        description: tourData.description
          ? undefined
          : {
              name: tourData.name || "",
              cityId: tourData.cityId || "",
              languageTaught: tourData.languageTaught || "",
              instructionLanguage: tourData.instructionLanguage || "",
              langDifficulty: tourData.langDifficulty,
              description:
                typeof tourData.description === "string"
                  ? tourData.description
                  : tourData.description?.description || "",
              tourType: tourData.tourType,
              price: tourData.price,
            },
        imageUrl: tourData.imageUrl,
      });
      return { success: true };
    } catch (error) {
      console.error("Error updating tour:", error);
      throw error;
    }
  },

  async deleteTour(tourId: string) {
    try {
      await convex.mutation(api.tours.deleteTour, {
        tourId: tourId as Id<"tours">,
      });
      return { success: true };
    } catch (error) {
      console.error("Error deleting tour:", error);
      throw error;
    }
  },

  async getTour(tourId: string) {
    if (!tourId || tourId === "undefined") {
      console.error("Invalid tour ID provided to getTour:", tourId);
      return { data: null, error: new Error("Invalid tour ID provided") };
    }

    try {
      const tour = await convex.query(api.tours.getTourById, { tourId });
      return { data: tour, error: null };
    } catch (error) {
      console.error("Error getting tour:", error);
      return { data: null, error };
    }
  },

  async getAllTours() {
    try {
      const tours = await convex.query(api.tours.getAllTours, {});
      return {
        documents: tours,
        data: tours,
      };
    } catch (error) {
      console.error("Error getting all tours:", error);
      throw error;
    }
  },

  // File upload methods
  async uploadFile(file: File, userId?: string) {
    try {
      // Get upload URL
      const uploadUrl = await convex.mutation(api.storage.generateUploadUrl, {});

      // Upload file
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      const { storageId } = await response.json();

      // Get public URL
      const url = await convex.query(api.storage.getFileUrl, { storageId });

      return { id: storageId, url };
    } catch (error) {
      console.error("Error uploading file:", error);
      throw error;
    }
  },

  async deleteFile(fileId: string) {
    try {
      await convex.mutation(api.storage.deleteFile, {
        storageId: fileId as Id<"_storage">,
      });
    } catch (error) {
      console.error("Error deleting file:", error);
      throw error;
    }
  },

  getFilePreviewUrl(fileId: string): string {
    // For Convex, the URL is fetched asynchronously
    // This is a placeholder - actual implementation may need to be async
    return fileId;
  },

  // Schedule methods
  async scheduleTour(
    tourId: string,
    scheduledDate: Date,
    maxParticipants: number,
    meetingPoint: string,
    additionalInfo: string = "",
    price: number = 0
  ) {
    try {
      const scheduleId = await convex.mutation(api.schedules.createSchedule, {
        tourId: tourId as Id<"tours">,
        scheduledDate: scheduledDate.getTime(),
        maxParticipants,
        meetingPoint,
        additionalInfo,
        price,
      });
      return { _id: scheduleId, id: scheduleId };
    } catch (error) {
      console.error("Error scheduling tour:", error);
      throw error;
    }
  },

  async getScheduledTours(tourId: string) {
    if (!tourId || tourId === "undefined") {
      console.error("Invalid tour ID provided to getScheduledTours:", tourId);
      return { data: [], error: null };
    }

    try {
      const schedules = await convex.query(api.schedules.getSchedulesForTour, {
        tourId: tourId as Id<"tours">,
      });
      return { data: schedules || [], error: null };
    } catch (error) {
      console.error("Error getting scheduled tours:", error);
      return { data: [], error };
    }
  },

  async getScheduleById(scheduleId: string) {
    if (!scheduleId || scheduleId === "undefined") {
      console.error("Invalid schedule ID provided to getScheduleById:", scheduleId);
      return { data: null, error: new Error("Invalid schedule ID") };
    }

    try {
      const schedule = await convex.query(api.schedules.getScheduleById, {
        scheduleId: scheduleId as Id<"schedules">,
      });
      return { data: schedule, error: null };
    } catch (error) {
      console.error("Error getting schedule by ID:", error);
      return { data: null, error };
    }
  },

  async cancelSchedule(scheduleId: string) {
    if (!scheduleId || scheduleId === "undefined") {
      console.error("Invalid schedule ID provided to cancelSchedule:", scheduleId);
      return { success: false, error: new Error("Invalid schedule ID") };
    }

    try {
      await convex.mutation(api.schedules.cancelSchedule, {
        scheduleId: scheduleId as Id<"schedules">,
      });
      return { success: true, error: null };
    } catch (error) {
      console.error("Error canceling schedule:", error);
      return { success: false, error };
    }
  },

  async getUpcomingScheduledTours() {
    try {
      const schedules = await convex.query(api.schedules.getUpcomingScheduledTours, {});
      return {
        documents: schedules,
        data: schedules,
      };
    } catch (error) {
      console.error("Error getting upcoming scheduled tours:", error);
      throw error;
    }
  },

  // Booking methods
  async bookTour(
    scheduleId: string,
    userId: string,
    name: string,
    email: string,
    participants: number = 1,
    notes: string = ""
  ) {
    try {
      const bookingId = await convex.mutation(api.bookings.bookTour, {
        scheduleId: scheduleId as Id<"schedules">,
        name,
        email,
        participants,
        notes,
      });
      return { data: { _id: bookingId, id: bookingId }, error: null };
    } catch (error: any) {
      console.error("Error booking tour:", error);
      return { data: null, error: { message: error.message } };
    }
  },

  async cancelBooking(bookingId: string) {
    try {
      await convex.mutation(api.bookings.cancelBooking, {
        bookingId: bookingId as Id<"bookings">,
      });
      return { data: true, error: null };
    } catch (error: any) {
      console.error("Error cancelling booking:", error);
      return { data: null, error: { message: error.message } };
    }
  },

  async getBookingsForSchedule(scheduleId: string) {
    if (!scheduleId || scheduleId === "undefined") {
      console.error("Invalid schedule ID provided to getBookingsForSchedule:", scheduleId);
      return { data: [], error: null };
    }

    try {
      const bookings = await convex.query(api.bookings.getBookingsForSchedule, {
        scheduleId: scheduleId as Id<"schedules">,
      });
      return { data: bookings || [], error: null };
    } catch (error) {
      console.error("Error getting bookings for schedule:", error);
      return { data: [], error };
    }
  },

  async getUserBookings(userId: string) {
    try {
      const bookings = await convex.query(api.bookings.getUserBookings, {
        userId,
      });
      return {
        documents: bookings,
        data: bookings,
      };
    } catch (error) {
      console.error("Error getting user bookings:", error);
      throw error;
    }
  },

  // Attendance methods
  async markAsAttended(bookingId: string) {
    try {
      const result = await convex.mutation(api.bookings.markAsAttended, {
        bookingId: bookingId as Id<"bookings">,
      });

      // Send rating notification email
      if (result && result.tourId) {
        try {
          await convex.action(api.emails.sendRatingNotificationEmail, {
            email: result.email,
            tourId: result.tourId,
            userName: result.name,
          });
        } catch (emailError) {
          console.error("Error sending rating notification email:", emailError);
        }
      }

      return result;
    } catch (error) {
      console.error("Error marking as attended:", error);
      throw error;
    }
  },

  async hasUserAttendedTour(userId: string, tourId: string) {
    try {
      return await convex.query(api.bookings.hasUserAttendedTour, {
        userId,
        tourId: tourId as Id<"tours">,
      });
    } catch (error) {
      console.error("Error checking if user attended tour:", error);
      return false;
    }
  },

  // Rating methods
  getAverageRating(tour: any): number {
    try {
      if (tour.ratings && typeof tour.ratings === "object") {
        const ratings = Object.values(tour.ratings).filter(
          (r) => typeof r === "number"
        ) as number[];
        if (ratings.length > 0) {
          return ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
        }
      }

      if (typeof tour.rating === "number") {
        return tour.rating;
      }

      if (typeof tour.averageRating === "number") {
        return tour.averageRating;
      }

      return 0;
    } catch (error) {
      console.error("Error calculating average rating:", error);
      return 0;
    }
  },

  async submitTourRatings(
    tourId: string,
    userId: string,
    languageLearningRating: number,
    informativeRating: number,
    funRating: number,
    comment: string = ""
  ) {
    try {
      const ratingId = await convex.mutation(api.ratings.submitTourRatings, {
        tourId: tourId as Id<"tours">,
        languageLearningRating,
        informativeRating,
        funRating,
        comment,
      });
      return { _id: ratingId, id: ratingId };
    } catch (error) {
      console.error("Error submitting tour ratings:", error);
      throw error;
    }
  },

  async getTourRatings(tourId: string) {
    if (!tourId || tourId === "undefined") {
      console.error("Invalid tour ID provided to getTourRatings:", tourId);
      return { data: [], error: new Error("Invalid tour ID provided") };
    }

    try {
      const ratings = await convex.query(api.ratings.getTourRatings, {
        tourId: tourId as Id<"tours">,
      });
      return { data: ratings || [], error: null };
    } catch (error) {
      console.error("Error getting tour ratings:", error);
      return { data: [], error };
    }
  },

  async getAverageTourRatings(tourId: string) {
    try {
      return await convex.query(api.ratings.getAverageTourRatings, {
        tourId: tourId as Id<"tours">,
      });
    } catch (error) {
      console.error("Error getting average tour ratings:", error);
      return {
        languageLearning: 0,
        informative: 0,
        fun: 0,
        overall: 0,
        count: 0,
      };
    }
  },

  async hasUserRatedTour(userId: string, tourId: string) {
    try {
      return await convex.query(api.ratings.hasUserRatedTour, {
        userId,
        tourId: tourId as Id<"tours">,
      });
    } catch (error) {
      console.error("Error checking if user rated tour:", error);
      return false;
    }
  },

  async getTourCreatorId(tourId: string): Promise<string | null> {
    if (!tourId || tourId === "undefined") {
      console.error("Invalid tour ID provided to getTourCreatorId:", tourId);
      return null;
    }

    try {
      return await convex.query(api.tours.getTourCreatorId, {
        tourId: tourId as Id<"tours">,
      });
    } catch (error) {
      console.error("Error getting tour creator ID:", error);
      return null;
    }
  },

  async getCreatorTours(creatorId: string) {
    try {
      return await convex.query(api.tours.getToursByCreator, {
        creatorId,
      });
    } catch (error) {
      console.error("Error getting creator tours:", error);
      return [];
    }
  },

  async getCreatorAverageRatings(creatorId: string) {
    try {
      return await convex.query(api.ratings.getCreatorAverageRatings, {
        creatorId,
      });
    } catch (error) {
      console.error("Error getting creator average ratings:", error);
      return {
        languageLearning: 0,
        informative: 0,
        fun: 0,
        overall: 0,
        count: 0,
      };
    }
  },

  // Notification methods
  async saveNotification(tourId: string, email: string) {
    if (!tourId || tourId === "undefined") {
      console.error("Invalid tour ID provided to saveNotification:", tourId);
      return { data: null, error: new Error("Invalid tour ID provided") };
    }

    if (!email) {
      console.error("Email is required for saveNotification");
      return { data: null, error: new Error("Email is required") };
    }

    try {
      const notificationId = await convex.mutation(api.notifications.saveNotification, {
        tourId: tourId as Id<"tours">,
        email,
      });
      return { data: { _id: notificationId }, error: null };
    } catch (error) {
      console.error("Error saving notification:", error);
      return { data: null, error };
    }
  },

  // User methods
  async getUserCreatedTours(userId: string) {
    try {
      const tours = await convex.query(api.tours.getToursByCreator, {
        creatorId: userId,
      });
      return { data: tours, error: null };
    } catch (error) {
      console.error("Error getting user created tours:", error);
      return { data: [], error };
    }
  },

  async getUsernameById(userId: string): Promise<string | null> {
    if (!userId) {
      return null;
    }

    try {
      return await convex.query(api.users.getUsernameById, { userId });
    } catch (error) {
      console.error("Error getting username by ID:", error);
      return `User ${userId.substring(0, 8)}`;
    }
  },

  async updateUserProfile(name: string) {
    try {
      await convex.mutation(api.users.updateProfile, {
        username: name,
      });
      return { success: true };
    } catch (error) {
      console.error("Error updating user profile:", error);
      throw error;
    }
  },

  async getNextScheduledTour(tourId: string) {
    try {
      if (!tourId || tourId === "undefined") {
        console.error("Invalid tour ID provided to getNextScheduledTour:", tourId);
        return { data: null, error: null };
      }

      const schedule = await convex.query(api.schedules.getNextScheduledTour, {
        tourId: tourId as Id<"tours">,
      });
      return { data: schedule, error: null };
    } catch (error) {
      console.error("Error getting next scheduled tour:", error);
      return { data: null, error };
    }
  },
};
