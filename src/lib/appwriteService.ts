import { account, databases, storage, ID, Permission, Role, Query } from '$lib/appwrite';
import { writable } from 'svelte/store';
import type { Models } from 'appwrite';
import type { Tour } from './stores/tourStore';

const databaseId = '6609473fbde756e5dc45'; 
const bucketId = '66efdb420000df196b64';
const toursCollectionId = '6804030500128adf1d19';
const schedulesCollectionId = 'schedules'; // You'll need to create this in Appwrite
const bookingsCollectionId = 'bookings'; // You'll need to create this in Appwrite
const participantsCollectionId = 'participants'; // You'll need to create this in Appwrite
const ratingsCollectionId = 'ratings'; // You'll need to create this in Appwrite

// Create a store for the current user
export const currentUser = writable<Models.User<Models.Preferences> | null>(null);

// Create a store for the admin status
export const isAdmin = writable<boolean>(false);

// Create a store for the user's created tours
export const userCreatedTours = writable<any[]>([]);

type DocumentData = Record<string, any>;

export const AppwriteService = {
  
  databaseId,
  bucketId,
  toursCollectionId,
  schedulesCollectionId,
  bookingsCollectionId,
  participantsCollectionId,
  ratingsCollectionId,
  
  // Create a document in a specific collection
  async createDocument(collectionId: string, data: DocumentData, permissions: string[] = []) {
    try {
      console.log('Creating document with data:', data);
      // Make sure we're only sending valid data to Appwrite
      // Remove any undefined or null values
      const cleanData = Object.entries(data).reduce((acc, [key, value]) => {
        if (value !== undefined && value !== null) {
          acc[key] = value;
        }
        return acc;
      }, {} as Record<string, any>);
      
      return await databases.createDocument(databaseId, collectionId, ID.unique(), cleanData);
    } catch (error: any) {
      console.error('Error creating document:', error);
      if (error.code === 400) {
        console.error('Bad request details:', error.message, error.response);
      }
      throw error;
    }
  },

  // Get a document by collection and document ID
  async getDocument(collectionId: string, documentId: string) {
    return await databases.getDocument(databaseId, collectionId, documentId);
  },

  // Update a document in a specific collection
  async updateDocument(collectionId: string, documentId: string, data: DocumentData) {
    return await databases.updateDocument(databaseId, collectionId, documentId, data);
  },

  // Delete a document by collection and document ID
  async deleteDocument(collectionId: string, documentId: string) {
    return await databases.deleteDocument(databaseId, collectionId, documentId);
  },

  // List documents in a collection with optional queries
  async listDocuments(collectionId: string, queries: string[] = []) {
    return await databases.listDocuments(databaseId, collectionId, queries);
  },

  // Upload a file to a bucket
  async uploadFile(file: File, userId?: string) {
    const permissions = [
      Permission.read(Role.any()),
    ];
    
    if (userId) {
      permissions.push(Permission.update(Role.user(userId)));
      permissions.push(Permission.delete(Role.user(userId)));
    }
    
    return await storage.createFile(bucketId, ID.unique(), file, permissions);
  },

  // Delete a file by its file ID
  async deleteFile(fileId: string) {
    return await storage.deleteFile(bucketId, fileId);
  },
  
  // Get a preview URL for a file
  getFilePreviewUrl(fileId: string, width?: number, height?: number) {
    // Use the getFileView method to get the URL directly
    return storage.getFileView(bucketId, fileId).toString();
  },

  // Get the current logged-in user's account
  async getAccount(): Promise<Models.User<Models.Preferences> | null> {
    try {
      const user = await account.get();
      currentUser.set(user);
      
      // Check if user has admin label
      if (user && user.labels && user.labels.includes('admin')) {
        isAdmin.set(true);
      } else {
        isAdmin.set(false);
      }
      
      // Fetch tours created by this user
      if (user) {
        try {
          const response = await this.getUserCreatedTours(user.$id);
          userCreatedTours.set(response.documents);
        } catch (error) {
          console.error('Error fetching user created tours:', error);
          userCreatedTours.set([]);
        }
      }
      
      return user;
    } catch (error) {
      currentUser.set(null);
      isAdmin.set(false);
      userCreatedTours.set([]);
      return null;
    }
  },
  
  // Check if the current user has admin privileges
  hasAdminAccess(): boolean {
    let adminStatus = false;
    isAdmin.subscribe(value => {
      adminStatus = value;
    })();
    return adminStatus;
  },

  // Create a new user account
  async createAccount(email: string, password: string, name: string) {
    try {
      return await account.create(ID.unique(), email, password, name);
    } catch (error) {
      console.error('Error creating account:', error);
      throw error;
    }
  },

  // Login with email and password
  async login(email: string, password: string) {
    try {
      const session = await account.createEmailPasswordSession(email, password);
      await this.getAccount(); // Update the currentUser store
      return session;
    } catch (error) {
      console.error('Error logging in:', error);
      throw error;
    }
  },

  // Log out the current user
  async logout() {
    try {
      await account.deleteSession('current');
      currentUser.set(null);
      isAdmin.set(false);
    } catch (error) {
      console.error('Error logging out:', error);
      throw error;
    }
  },

  // Tour specific methods
  async createTour(tourData: Partial<Tour>, userId?: string) {
    try {
      console.log('Creating tour with data:', tourData);
      
      // Store tour data as JSON in the description field
      const { imageUrl, ...tourDataToStore } = tourData;
      
      // Make sure we have a valid description JSON
      const descriptionJson = JSON.stringify(tourDataToStore);
      
      // Create a clean document object with only the required fields
      const documentData: Record<string, any> = {
        description: descriptionJson
      };
      
      // Only add imageUrl if it exists and is not empty
      if (imageUrl) {
        documentData.imageUrl = imageUrl;
      }
      
      console.log('Document data to be sent:', documentData);
      
      // Create the document without permissions for now to simplify
      return await this.createDocument(toursCollectionId, documentData);
    } catch (error) {
      console.error('Error in createTour:', error);
      throw error;
    }
  },

  async updateTour(tourId: string, tourData: Partial<Tour>) {
    try {
      console.log('Updating tour with ID:', tourId, 'Data:', tourData);
      
      // Store tour data as JSON in the description field
      const { imageUrl, ...tourDataToStore } = tourData;
      
      // Make sure we have a valid description JSON
      const descriptionJson = JSON.stringify(tourDataToStore);
      
      // Create a clean document object with only the required fields
      const documentData: Record<string, any> = {
        description: descriptionJson
      };
      
      // Only add imageUrl if it exists and is not empty
      if (imageUrl) {
        documentData.imageUrl = imageUrl;
      }
      
      console.log('Document data to be updated:', documentData);
      
      return await this.updateDocument(toursCollectionId, tourId, documentData);
    } catch (error) {
      console.error('Error in updateTour:', error);
      throw error;
    }
  },

  async deleteTour(tourId: string) {
    return await this.deleteDocument(toursCollectionId, tourId);
  },

  async getTour(tourId: string) {
    return await this.getDocument(toursCollectionId, tourId);
  },

  async getAllTours() {
    try {
      console.log('Fetching all tours from collection:', toursCollectionId);
      const result = await this.listDocuments(toursCollectionId);
      console.log('Tours fetched successfully, count:', result.documents.length);
      return result;
    } catch (error: any) {
      console.error('Error fetching tours:', error);
      // Add more detailed error information
      if (error.code) {
        console.error('Appwrite error code:', error.code);
      }
      throw error;
    }
  },
  
  // Save notification to the new collection
  async saveNotification(tourId: string, email: string) {
    try {
      const notificationData = {
        notify: JSON.stringify({ email, tourId })
      };
      return await this.createDocument('6805078c001412076682', notificationData);
    } catch (error) {
      console.error('Error saving notification:', error);
      throw error;
    }
  },
  
  // Save a user's rating for a tour
  async saveTourRating(tourId: string, userId: string, rating: number) {
    try {
      // First, get the current tour document
      const tourDoc = await this.getDocument(toursCollectionId, tourId);
      
      // Parse existing ratings or create a new array
      let ratings: {userId: string, rating: number}[] = [];
      
      if (tourDoc.rating && typeof tourDoc.rating === 'string') {
        try {
          ratings = JSON.parse(tourDoc.rating);
          // Ensure it's an array
          if (!Array.isArray(ratings)) {
            ratings = [];
          }
        } catch (parseError) {
          console.error('Error parsing existing ratings:', parseError);
          ratings = [];
        }
      }
      
      // Check if user has already rated this tour
      const existingRatingIndex = ratings.findIndex(r => r.userId === userId);
      
      if (existingRatingIndex !== -1) {
        // Update existing rating
        ratings[existingRatingIndex].rating = rating;
      } else {
        // Add new rating
        ratings.push({ userId, rating });
      }
      
      // Update the document with the new ratings array
      const updateData = {
        rating: JSON.stringify(ratings)
      };
      
      return await this.updateDocument(toursCollectionId, tourId, updateData);
    } catch (error) {
      console.error('Error saving tour rating:', error);
      throw error;
    }
  },
  
  // Calculate average rating for a tour
  getAverageRating(tour: any): number {
    if (!tour.rating || typeof tour.rating !== 'string') {
      return 0;
    }
    
    try {
      const ratings = JSON.parse(tour.rating);
      if (!Array.isArray(ratings) || ratings.length === 0) {
        return 0;
      }
      
      const sum = ratings.reduce((acc: number, curr: any) => acc + curr.rating, 0);
      return Math.round((sum / ratings.length) * 10) / 10; // Round to 1 decimal place
    } catch (error) {
      console.error('Error calculating average rating:', error);
      return 0;
    }
  },
  
  // Get user's rating for a tour
  getUserRating(tour: any, userId: string): number {
    if (!tour.rating || typeof tour.rating !== 'string') {
      return 0;
    }
    
    try {
      const ratings = JSON.parse(tour.rating);
      if (!Array.isArray(ratings) || ratings.length === 0) {
        return 0;
      }
      
      const userRating = ratings.find((r: any) => r.userId === userId);
      return userRating ? userRating.rating : 0;
    } catch (error) {
      console.error('Error getting user rating:', error);
      return 0;
    }
  },
  
  // Get tours created by a specific user
  async getUserCreatedTours(userId: string) {
    try {
      // We need to fetch all tours and filter by creator
      const response = await this.getAllTours();
      
      // Filter tours where the creator is the current user
      // This assumes tour data includes a creatorId field in the JSON description
      const userTours = response.documents.filter(doc => {
        try {
          if (doc.description && typeof doc.description === 'string') {
            const tourData = JSON.parse(doc.description);
            return tourData.creatorId === userId;
          }
        } catch (error) {
          console.error('Error parsing tour data:', error);
        }
        return false;
      });
      
      return { documents: userTours };
    } catch (error) {
      console.error('Error getting user created tours:', error);
      throw error;
    }
  },
  
  // Schedule a tour
  async scheduleTour(tourId: string, scheduledDate: Date, maxParticipants: number, meetingPoint: string, additionalInfo: string = '') {
    try {
      const scheduleData = {
        tourId,
        scheduledDate: scheduledDate.toISOString(),
        maxParticipants,
        meetingPoint,
        additionalInfo,
        createdAt: new Date().toISOString(),
        status: 'scheduled' // scheduled, completed, cancelled
      };
      
      return await this.createDocument(schedulesCollectionId, scheduleData);
    } catch (error) {
      console.error('Error scheduling tour:', error);
      throw error;
    }
  },
  
  // Get scheduled tours for a specific tour
  async getScheduledTours(tourId: string) {
    try {
      return await databases.listDocuments(
        databaseId, 
        schedulesCollectionId, 
        [Query.equal('tourId', tourId)]
      );
    } catch (error) {
      console.error('Error getting scheduled tours:', error);
      throw error;
    }
  },
  
  // Get all upcoming scheduled tours
  async getUpcomingScheduledTours() {
    try {
      const now = new Date().toISOString();
      return await databases.listDocuments(
        databaseId, 
        schedulesCollectionId, 
        [
          Query.greaterThan('scheduledDate', now),
          Query.equal('status', 'scheduled')
        ]
      );
    } catch (error) {
      console.error('Error getting upcoming scheduled tours:', error);
      throw error;
    }
  },
  
  // Book a tour for a user
  async bookTour(scheduleId: string, userId: string, name: string, email: string, participants: number = 1, notes: string = '') {
    try {
      const bookingData = {
        scheduleId,
        userId,
        name,
        email,
        participants,
        notes,
        status: 'confirmed', // confirmed, cancelled, attended
        bookedAt: new Date().toISOString()
      };
      
      return await this.createDocument(bookingsCollectionId, bookingData);
    } catch (error) {
      console.error('Error booking tour:', error);
      throw error;
    }
  },
  
  // Get bookings for a scheduled tour
  async getBookingsForSchedule(scheduleId: string) {
    try {
      return await databases.listDocuments(
        databaseId, 
        bookingsCollectionId, 
        [Query.equal('scheduleId', scheduleId)]
      );
    } catch (error) {
      console.error('Error getting bookings for schedule:', error);
      throw error;
    }
  },
  
  // Get bookings for a user
  async getUserBookings(userId: string) {
    try {
      return await databases.listDocuments(
        databaseId, 
        bookingsCollectionId, 
        [Query.equal('userId', userId)]
      );
    } catch (error) {
      console.error('Error getting user bookings:', error);
      throw error;
    }
  },
  
  // Mark a booking as attended (participant)
  async markAsAttended(bookingId: string) {
    try {
      // First update the booking status
      await this.updateDocument(bookingsCollectionId, bookingId, {
        status: 'attended'
      });
      
      // Get the booking to get the userId and scheduleId
      const booking = await this.getDocument(bookingsCollectionId, bookingId);
      
      // Get the schedule to get the tourId
      const schedule = await this.getDocument(schedulesCollectionId, booking.scheduleId);
      
      // Create a participant record
      const participantData = {
        userId: booking.userId,
        tourId: schedule.tourId,
        scheduleId: booking.scheduleId,
        bookingId: bookingId,
        attendedAt: new Date().toISOString()
      };
      
      return await this.createDocument(participantsCollectionId, participantData);
    } catch (error) {
      console.error('Error marking as attended:', error);
      throw error;
    }
  },
  
  // Check if a user has attended a tour
  async hasUserAttendedTour(userId: string, tourId: string) {
    try {
      const result = await databases.listDocuments(
        databaseId, 
        participantsCollectionId, 
        [
          Query.equal('userId', userId),
          Query.equal('tourId', tourId)
        ]
      );
      
      return result.documents.length > 0;
    } catch (error) {
      console.error('Error checking if user attended tour:', error);
      return false;
    }
  },
  
  // Submit multi-dimensional ratings for a tour
  async submitTourRatings(
    tourId: string, 
    userId: string, 
    languageLearningRating: number, 
    informativeRating: number, 
    funRating: number, 
    comment: string = ''
  ) {
    try {
      // Check if user has attended the tour
      const hasAttended = await this.hasUserAttendedTour(userId, tourId);
      if (!hasAttended) {
        throw new Error('Only users who have attended the tour can submit ratings');
      }
      
      const ratingData = {
        tourId,
        userId,
        languageLearningRating,
        informativeRating,
        funRating,
        comment,
        createdAt: new Date().toISOString()
      };
      
      return await this.createDocument(ratingsCollectionId, ratingData);
    } catch (error) {
      console.error('Error submitting tour ratings:', error);
      throw error;
    }
  },
  
  // Get ratings for a tour
  async getTourRatings(tourId: string) {
    try {
      return await databases.listDocuments(
        databaseId, 
        ratingsCollectionId, 
        [Query.equal('tourId', tourId)]
      );
    } catch (error) {
      console.error('Error getting tour ratings:', error);
      throw error;
    }
  },
  
  // Calculate average ratings for a tour
  async getAverageTourRatings(tourId: string) {
    try {
      const ratings = await this.getTourRatings(tourId);
      
      if (ratings.documents.length === 0) {
        return {
          languageLearning: 0,
          informative: 0,
          fun: 0,
          overall: 0,
          count: 0
        };
      }
      
      let totalLanguageLearning = 0;
      let totalInformative = 0;
      let totalFun = 0;
      
      ratings.documents.forEach(rating => {
        totalLanguageLearning += rating.languageLearningRating;
        totalInformative += rating.informativeRating;
        totalFun += rating.funRating;
      });
      
      const count = ratings.documents.length;
      const languageLearning = Math.round((totalLanguageLearning / count) * 10) / 10;
      const informative = Math.round((totalInformative / count) * 10) / 10;
      const fun = Math.round((totalFun / count) * 10) / 10;
      const overall = Math.round(((languageLearning + informative + fun) / 3) * 10) / 10;
      
      return {
        languageLearning,
        informative,
        fun,
        overall,
        count
      };
    } catch (error) {
      console.error('Error calculating average tour ratings:', error);
      return {
        languageLearning: 0,
        informative: 0,
        fun: 0,
        overall: 0,
        count: 0
      };
    }
  },
  
  // Check if a user has already rated a tour
  async hasUserRatedTour(userId: string, tourId: string) {
    try {
      const result = await databases.listDocuments(
        databaseId, 
        ratingsCollectionId, 
        [
          Query.equal('userId', userId),
          Query.equal('tourId', tourId)
        ]
      );
      
      return result.documents.length > 0;
    } catch (error) {
      console.error('Error checking if user rated tour:', error);
      return false;
    }
  }
};
