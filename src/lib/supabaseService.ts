import { supabase } from './supabase';
import { writable } from 'svelte/store';
import type { User } from '@supabase/supabase-js';
import type { Tour } from './stores/tourStore';

// Create stores for state management
export const currentUser = writable<User | null>(null);
export const isAdmin = writable<boolean>(false);
export const userCreatedTours = writable<any[]>([]);

type DocumentData = Record<string, any>;

export const SupabaseService = {
  // Authentication methods
  async getAccount() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      currentUser.set(user);
      
      // Check if user has admin role
      if (user) {
        try {
          // Use RPC function to avoid RLS recursion
          // We'll use a direct SQL query with RLS bypassed
          const { data, error } = await supabase.rpc('check_admin_role', {
            input_user_id: user.id
          });
          
          if (error) {
            console.error('Error checking admin role:', error);
            isAdmin.set(false); // Default to non-admin if there's an error
          } else {
            isAdmin.set(data === true);
          }
        } catch (roleError) {
          console.error('Exception checking admin role:', roleError);
          isAdmin.set(false); // Default to non-admin if there's an error
        }
        
        // Fetch user created tours
        const { data: tours } = await this.getUserCreatedTours(user.id);
        userCreatedTours.set(tours || []);
      } else {
        currentUser.set(null);
        isAdmin.set(false);
        userCreatedTours.set([]);
      }
      
      return user;
    } catch (error) {
      console.error('Error getting account:', error);
      currentUser.set(null);
      isAdmin.set(false);
      userCreatedTours.set([]);
      return null;
    }
  },
  
  hasAdminAccess(): boolean {
    let adminStatus = false;
    isAdmin.subscribe(value => {
      adminStatus = value;
    })();
    return adminStatus;
  },
  
  // Authentication methods
  async createAccount(email: string, password: string, name: string) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
          emailRedirectTo: window.location.origin + '/auth/confirm'
        }
      });
      
      if (error) throw error;
      return data.user;
    } catch (error) {
      console.error('Error creating account:', error);
      throw error;
    }
  },
  
  async resendConfirmationEmail(email: string) {
    try {
      if (!email) {
        throw new Error('Email is required');
      }
      
      const { data, error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: window.location.origin + '/auth/confirm'
        }
      });
      
      if (error) throw error;
      return { success: true, message: 'Confirmation email resent. Please check your inbox.' };
    } catch (error) {
      console.error('Error resending confirmation email:', error);
      throw error;
    }
  },
  
  async login(email: string, password: string) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) throw error;
      await this.getAccount(); // Update the currentUser store
      return data.session;
    } catch (error) {
      console.error('Error logging in:', error);
      throw error;
    }
  },
  
  async logout() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      currentUser.set(null);
      isAdmin.set(false);
      userCreatedTours.set([]);
    } catch (error) {
      console.error('Error logging out:', error);
      throw error;
    }
  },
  
  // Tour methods
  async createTour(tourData: Partial<Tour>, userId?: string) {
    try {
      console.log('Creating tour with data:', tourData);
      
      const { imageUrl, ...tourDataToStore } = tourData;
      
      if (!userId) {
        const { data: { user } } = await supabase.auth.getUser();
        userId = user?.id;
      }
      
      if (!userId) throw new Error('User ID is required to create a tour');
      
      const { data, error } = await supabase
        .from('tours')
        .insert({
          description: tourDataToStore,
          image_url: imageUrl,
          creator_id: userId
        })
        .select()
        .single();
        
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating tour:', error);
      throw error;
    }
  },
  
  async updateTour(tourId: string, tourData: Partial<Tour>) {
    try {
      const { imageUrl, ...tourDataToStore } = tourData;
      
      const updates: any = {};
      
      if (Object.keys(tourDataToStore).length > 0) {
        updates.description = tourDataToStore;
      }
      
      if (imageUrl !== undefined) {
        updates.image_url = imageUrl;
      }
      
      const { data, error } = await supabase
        .from('tours')
        .update(updates)
        .eq('id', tourId)
        .select()
        .single();
        
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating tour:', error);
      throw error;
    }
  },
  
  async deleteTour(tourId: string) {
    const { error } = await supabase.from('tours').delete().eq('id', tourId);
    if (error) throw error;
  },
  
  async getTour(tourId: string) {
    // Check if tourId is valid before making the request
    if (!tourId || tourId === 'undefined') {
      console.error('Invalid tour ID provided to getTour:', tourId);
      return { data: null, error: new Error('Invalid tour ID provided') };
    }

    try {
      const { data, error } = await supabase.from('tours').select('*').eq('id', tourId).single();
      
      if (error) {
        console.error('Error getting tour:', error);
        return { data: null, error };
      }
      
      return { data, error: null };
    } catch (err) {
      console.error('Exception in getTour:', err);
      return { data: null, error: err };
    }
  },
  
  async getAllTours() {
    const { data, error } = await supabase.from('tours').select('*');
    if (error) throw error;
    
    // Transform data to match the expected format
    const transformedData = data.map(tour => {
      const description = typeof tour.description === 'string' 
        ? JSON.parse(tour.description) 
        : tour.description;
        
      return {
        $id: tour.id,
        description: JSON.stringify(description),
        imageUrl: tour.image_url,
        ...description
      };
    });
    
    // Return in a format compatible with existing code
    return {
      documents: transformedData,
      data: transformedData
    };
  },
  
  // Upload a file to storage
  async uploadFile(file: File, userId?: string) {
    if (!userId) {
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id;
    }
    
    if (!userId) throw new Error('User ID is required to upload a file');
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;
    
    const { data, error } = await supabase.storage
      .from('tour-images')
      .upload(filePath, file);
      
    if (error) throw error;
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('tour-images')
      .getPublicUrl(filePath);
      
    return { id: data.path, url: publicUrl };
  },
  
  async deleteFile(fileId: string) {
    const { error } = await supabase.storage
      .from('tour-images')
      .remove([fileId]);
      
    if (error) throw error;
  },
  
  getFilePreviewUrl(fileId: string) {
    const { data: { publicUrl } } = supabase.storage
      .from('tour-images')
      .getPublicUrl(fileId);
      
    return publicUrl;
  },
  
  // Schedule methods
  async scheduleTour(tourId: string, scheduledDate: Date, maxParticipants: number, meetingPoint: string, additionalInfo: string = '') {
    const { data, error } = await supabase
      .from('schedules')
      .insert({
        tour_id: tourId,
        scheduled_date: scheduledDate.toISOString(),
        max_participants: maxParticipants,
        meeting_point: meetingPoint,
        additional_info: additionalInfo
      })
      .select()
      .single();
      
    if (error) throw error;
    return data;
  },
  
  async getScheduledTours(tourId: string) {
    // Check if tourId is valid before making the request
    if (!tourId || tourId === 'undefined') {
      console.error('Invalid tour ID provided to getScheduledTours:', tourId);
      return { data: [], error: null };
    }
    
    try {
      const { data, error } = await supabase
        .from('schedules')
        .select('*')
        .eq('tour_id', tourId);
        
      if (error) {
        console.error('Error getting scheduled tours:', error);
        throw error;
      }
      
      // Ensure we always return an array, even if data is null or undefined
      return { data: data || [], error: null };
    } catch (err) {
      console.error('Exception in getScheduledTours:', err);
      return { data: [], error: err };
    }
  },
  
  async getScheduleById(scheduleId: string) {
    // Check if scheduleId is valid
    if (!scheduleId || scheduleId === 'undefined') {
      console.error('Invalid schedule ID provided to getScheduleById:', scheduleId);
      return { data: null, error: new Error('Invalid schedule ID') };
    }
    
    try {
      console.log('Fetching schedule with ID:', scheduleId);
      const { data, error } = await supabase
        .from('schedules')
        .select('*')
        .eq('id', scheduleId)
        .single();
        
      if (error) {
        console.error('Error getting schedule by ID:', error);
        return { data: null, error };
      }
      
      console.log('Schedule data retrieved:', data);
      return { data, error: null };
    } catch (err) {
      console.error('Exception in getScheduleById:', err);
      return { data: null, error: err };
    }
  },
  
  async cancelSchedule(scheduleId: string) {
    // Check if scheduleId is valid
    if (!scheduleId || scheduleId === 'undefined') {
      console.error('Invalid schedule ID provided to cancelSchedule:', scheduleId);
      return { success: false, error: new Error('Invalid schedule ID') };
    }
    
    try {
      console.log('Canceling schedule with ID:', scheduleId);
      const { error } = await supabase
        .from('schedules')
        .delete()
        .eq('id', scheduleId);
        
      if (error) {
        console.error('Error canceling schedule:', error);
        return { success: false, error };
      }
      
      console.log('Schedule successfully canceled');
      return { success: true, error: null };
    } catch (err) {
      console.error('Exception in cancelSchedule:', err);
      return { success: false, error: err };
    }
  },
  
  async getUpcomingScheduledTours() {
    const now = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('schedules')
      .select(`
        *,
        tours:tour_id (*)
      `)
      .gt('scheduled_date', now)
      .order('scheduled_date', { ascending: true });
      
    if (error) throw error;
    return {
      documents: data,
      data: data
    };
  },
  
  // Booking methods
  async bookTour(scheduleId: string, userId: string, name: string, email: string, participants: number = 1, notes: string = '') {
    try {
      // First, check if the schedule exists
      const { data: scheduleData, error: scheduleError } = await supabase
        .from('schedules')
        .select('max_participants')
        .eq('id', scheduleId)
        .single();
      
      if (scheduleError) {
        console.error('Error fetching schedule:', scheduleError);
        return { error: { message: 'Schedule not found' } };
      }
      
      // Get the max participants from the schedule
      const maxParticipants = scheduleData.max_participants || 0;
      
      // Calculate current participants by summing up existing bookings
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('participants')
        .eq('schedule_id', scheduleId);
      
      if (bookingsError) {
        console.error('Error fetching bookings:', bookingsError);
        return { error: { message: 'Error checking availability' } };
      }
      
      // Sum up the participants from all bookings
      const currentParticipants = bookingsData.reduce((sum, booking) => sum + (booking.participants || 0), 0);
      
      // Check if there's enough space
      if (currentParticipants + participants > maxParticipants) {
        return { 
          error: { 
            message: `Not enough space available. Only ${maxParticipants - currentParticipants} spots left.` 
          } 
        };
      }
      
      // Create the booking
      const { data, error } = await supabase
        .from('bookings')
        .insert({
          schedule_id: scheduleId,
          user_id: userId,
          name: name,
          email: email,
          participants: participants,
          notes: notes
        })
        .select()
        .single();
      
      if (error) {
        console.error('Error creating booking:', error);
        return { error };
      }
      
      return { data, error: null };
    } catch (err) {
      console.error('Unexpected error in bookTour:', err);
      return { error: { message: 'An unexpected error occurred' } };
    }
  },
  
  async cancelBooking(bookingId: string) {
    try {
      // Instead of updating a status field, we'll add a cancelled_at timestamp
      // This approach works even if there's no explicit status column
      const { data, error } = await supabase
        .from('bookings')
        .update({ 
          cancelled_at: new Date().toISOString(),
          // Set participants to 0 to free up spots
          participants: 0
        })
        .eq('id', bookingId)
        .select()
        .single();
      
      if (error) {
        console.error('Error cancelling booking:', error);
        return { error };
      }
      
      return { data, error: null };
    } catch (err) {
      console.error('Unexpected error in cancelBooking:', err);
      return { error: { message: 'An unexpected error occurred' } };
    }
  },
  
  async getBookingsForSchedule(scheduleId: string) {
    // Check if scheduleId is valid before making the request
    if (!scheduleId || scheduleId === 'undefined') {
      console.error('Invalid schedule ID provided to getBookingsForSchedule:', scheduleId);
      return { data: [], error: null };
    }
    
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('schedule_id', scheduleId);
        
      if (error) {
        console.error('Error getting bookings for schedule:', error);
        throw error;
      }
      
      // Ensure we always return an array, even if data is null or undefined
      return { data: data || [], error: null };
    } catch (err) {
      console.error('Exception in getBookingsForSchedule:', err);
      return { data: [], error: err };
    }
  },
  
  async getUserBookings(userId: string) {
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        schedules:schedule_id (
          *,
          tours:tour_id (*)
        )
      `)
      .eq('user_id', userId);
      
    if (error) throw error;
    return {
      documents: data,
      data: data
    };
  },
  
  // Attendance methods (updated to use bookings table instead of participants)
  async markAsAttended(bookingId: string) {
    // Update the booking record directly
    const { data, error } = await supabase
      .from('bookings')
      .update({
        attended: true,
        attended_at: new Date().toISOString()
      })
      .eq('id', bookingId)
      .select('*, schedules:schedule_id (tour_id)')
      .single();
      
    if (error) throw error;
    
    // Send rating notification email to the participant
    if (data) {
      try {
        await this.sendRatingNotificationEmail(
          data.email,
          data.schedules.tour_id,
          data.name
        );
      } catch (emailError) {
        console.error('Error sending rating notification email:', emailError);
        // Continue with the function even if email fails
      }
    }
    
    return data;
  },
  
  async hasUserAttendedTour(userId: string, tourId: string) {
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        schedules:schedule_id (
          tour_id
        )
      `)
      .eq('schedules.tour_id', tourId)
      .eq('user_id', userId)
      .eq('attended', true);
      
    if (error) throw error;
    return data && data.length > 0;
  },
  
  // Calculate average rating for a tour from the tour object
  getAverageRating(tour: any): number {
    try {
      // If the tour has ratings property with numeric values
      if (tour.ratings && typeof tour.ratings === 'object') {
        const ratings = Object.values(tour.ratings).filter(r => typeof r === 'number') as number[];
        if (ratings.length > 0) {
          return ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
        }
      }
      
      // If the tour has a rating property
      if (typeof tour.rating === 'number') {
        return tour.rating;
      }
      
      // If the tour has an averageRating property
      if (typeof tour.averageRating === 'number') {
        return tour.averageRating;
      }
      
      return 0;
    } catch (error) {
      console.error('Error calculating average rating:', error);
      return 0;
    }
  },
  
  // Rating methods
  async submitTourRatings(
    tourId: string, 
    userId: string, 
    languageLearningRating: number, 
    informativeRating: number, 
    funRating: number, 
    comment: string = ''
  ) {
    const { data, error } = await supabase
      .from('ratings')
      .insert({
        tour_id: tourId,
        user_id: userId,
        language_learning_rating: languageLearningRating,
        informative_rating: informativeRating,
        fun_rating: funRating,
        comment: comment
      })
      .select()
      .single();
      
    if (error) throw error;
    return data;
  },
  
  async getTourRatings(tourId: string) {
    // Check if tourId is valid before making the request
    if (!tourId || tourId === 'undefined') {
      console.error('Invalid tour ID provided to getTourRatings:', tourId);
      return { data: [], error: new Error('Invalid tour ID provided') };
    }

    try {
      const { data, error } = await supabase
        .from('ratings')
        .select('*')
        .eq('tour_id', tourId);
        
      if (error) {
        console.error('Error getting tour ratings:', error);
        return { data: [], error };
      }
      
      return { data: data || [], error: null };
    } catch (err) {
      console.error('Exception in getTourRatings:', err);
      return { data: [], error: err };
    }
  },
  
  async getAverageTourRatings(tourId: string) {
    const { data: ratings, error } = await supabase
      .from('ratings')
      .select('language_learning_rating, informative_rating, fun_rating')
      .eq('tour_id', tourId);
      
    if (error) throw error;
    
    if (!ratings || ratings.length === 0) {
      return {
        languageLearning: 0,
        informative: 0,
        fun: 0,
        overall: 0,
        count: 0
      };
    }
    
    let languageLearningSum = 0;
    let informativeSum = 0;
    let funSum = 0;
    let count = 0;
    
    ratings.forEach(rating => {
      if (rating.language_learning_rating) {
        languageLearningSum += rating.language_learning_rating;
        count++;
      }
      if (rating.informative_rating) {
        informativeSum += rating.informative_rating;
      }
      if (rating.fun_rating) {
        funSum += rating.fun_rating;
      }
    });
    
    const languageLearningAvg = count > 0 ? languageLearningSum / count : 0;
    const informativeAvg = count > 0 ? informativeSum / count : 0;
    const funAvg = count > 0 ? funSum / count : 0;
    const overallAvg = (languageLearningAvg + informativeAvg + funAvg) / 3;
    
    return {
      languageLearning: languageLearningAvg,
      informative: informativeAvg,
      fun: funAvg,
      overall: overallAvg,
      count: count
    };
  },
  
  async hasUserRatedTour(userId: string, tourId: string) {
    const { data, error } = await supabase
      .from('ratings')
      .select('*')
      .eq('tour_id', tourId)
      .eq('user_id', userId);
      
    if (error) throw error;
    return data && data.length > 0;
  },
  
  async getTourCreatorId(tourId: string): Promise<string | null> {
    // Check if tourId is valid before making the request
    if (!tourId || tourId === 'undefined') {
      console.error('Invalid tour ID provided to getTourCreatorId:', tourId);
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('tours')
        .select('creator_id')
        .eq('id', tourId)
        .single();
        
      if (error) {
        console.error('Error getting tour creator ID:', error);
        return null;
      }
      
      return data?.creator_id || null;
    } catch (err) {
      console.error('Exception in getTourCreatorId:', err);
      return null;
    }
  },
  
  async getCreatorTours(creatorId: string) {
    const { data, error } = await supabase
      .from('tours')
      .select('*')
      .eq('creator_id', creatorId);
      
    if (error) throw error;
    return data;
  },
  
  async getCreatorAverageRatings(creatorId: string) {
    // Get all tours by this creator
    const { data: tours, error: toursError } = await supabase
      .from('tours')
      .select('id')
      .eq('creator_id', creatorId);
      
    if (toursError) throw toursError;
    
    if (!tours || tours.length === 0) {
      return {
        languageLearning: 0,
        informative: 0,
        fun: 0,
        overall: 0,
        count: 0
      };
    }
    
    // Get all ratings for these tours
    const tourIds = tours.map(tour => tour.id);
    
    const { data: ratings, error: ratingsError } = await supabase
      .from('ratings')
      .select('language_learning_rating, informative_rating, fun_rating')
      .in('tour_id', tourIds);
      
    if (ratingsError) throw ratingsError;
    
    if (!ratings || ratings.length === 0) {
      return {
        languageLearning: 0,
        informative: 0,
        fun: 0,
        overall: 0,
        count: 0
      };
    }
    
    let languageLearningSum = 0;
    let informativeSum = 0;
    let funSum = 0;
    let count = ratings.length;
    
    ratings.forEach(rating => {
      if (rating.language_learning_rating) {
        languageLearningSum += rating.language_learning_rating;
      }
      if (rating.informative_rating) {
        informativeSum += rating.informative_rating;
      }
      if (rating.fun_rating) {
        funSum += rating.fun_rating;
      }
    });
    
    const languageLearningAvg = count > 0 ? languageLearningSum / count : 0;
    const informativeAvg = count > 0 ? informativeSum / count : 0;
    const funAvg = count > 0 ? funSum / count : 0;
    const overallAvg = (languageLearningAvg + informativeAvg + funAvg) / 3;
    
    return {
      languageLearning: languageLearningAvg,
      informative: informativeAvg,
      fun: funAvg,
      overall: overallAvg,
      count: count
    };
  },
  
  // Notification methods
  async saveNotification(tourId: string, email: string) {
    // Check if tourId is valid before making the request
    if (!tourId || tourId === 'undefined') {
      console.error('Invalid tour ID provided to saveNotification:', tourId);
      return { data: null, error: new Error('Invalid tour ID provided') };
    }

    if (!email) {
      console.error('Email is required for saveNotification');
      return { data: null, error: new Error('Email is required') };
    }

    try {
      const { data, error } = await supabase
        .from('notifications')
        .insert({
          tour_id: tourId,
          email: email,
          created_at: new Date().toISOString()
        })
        .select()
        .single();
        
      if (error) {
        console.error('Error saving notification:', error);
        return { data: null, error };
      }
      
      return { data, error: null };
    } catch (err) {
      console.error('Exception in saveNotification:', err);
      return { data: null, error: err };
    }
  },
  
  async sendRatingNotificationEmail(email: string, tourId: string, userName: string) {
    if (!tourId || tourId === 'undefined') {
      console.error('Invalid tour ID provided to sendRatingNotificationEmail:', tourId);
      throw new Error('Invalid tour ID provided');
    }

    if (!email) {
      console.error('Email is required for sendRatingNotificationEmail');
      throw new Error('Email is required');
    }
    
    try {
      // Get tour details to include in the email
      const tourResponse = await this.getTour(tourId);
      if (!tourResponse || !tourResponse.data) {
        throw new Error('Tour not found');
      }
      
      const tour = tourResponse.data;
      
      // Extract tour name from the description
      let tourName = 'this tour';
      try {
        if (typeof tour.description === 'string') {
          const tourData = JSON.parse(tour.description);
          tourName = tourData.name || 'this tour';
        } else if (typeof tour.description === 'object') {
          tourName = tour.description.name || 'this tour';
        }
      } catch (e) {
        console.error('Error parsing tour name:', e);
      }
      
      // Create the rating URL
      const ratingUrl = `${window.location.origin}/tours/${tourId}/rate`;
      
      // Send email using Supabase Edge Functions
      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          to: email,
          subject: `Rate your experience on ${tourName}`,
          message: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Thank you for participating in ${tourName}!</h2>
              <p>Hello ${userName},</p>
              <p>We hope you enjoyed your tour experience. Your feedback is valuable to us and helps improve future tours.</p>
              <p>Please take a moment to rate your experience:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${ratingUrl}" style="background-color: #4F46E5; color: white; padding: 12px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">
                  Rate This Tour
                </a>
              </div>
              <p>You'll be able to rate the tour on three dimensions:</p>
              <ul>
                <li>Language Learning</li>
                <li>Informative Content</li>
                <li>Fun Factor</li>
              </ul>
              <p>You can also leave optional comments about your experience.</p>
              <p>Thank you for your participation!</p>
            </div>
          `,
          type: 'rating_notification'
        }
      });
      
      if (error) {
        console.error('Error sending rating notification email:', error);
        throw error;
      }
      
      // Save notification record
      await this.saveNotification(tourId, email);
      
      return { success: true };
    } catch (err) {
      console.error('Exception in sendRatingNotificationEmail:', err);
      throw err;
    }
  },
  
  // User methods
  async getUserCreatedTours(userId: string) {
    const { data, error } = await supabase
      .from('tours')
      .select('*')
      .eq('creator_id', userId);
      
    if (error) throw error;
    return { documents: data, data };
  }
};
