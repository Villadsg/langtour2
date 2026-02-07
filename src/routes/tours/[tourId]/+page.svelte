<script lang="ts">
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { ConvexService, currentUser } from '$lib/firebaseService';
    import { citiesStore } from '$lib/stores/tourStore';
    import FlyNotification from '$lib/components/FlyNotification.svelte';
    import { getTourData } from '$lib/tourValidation';
    import TourStopsMap from '$lib/components/TourStopsMap.svelte';
    import type { TourStop } from '$lib/firebase/types';

    // Extract stops from tour description (stored as JSON string)
    function getStops(tourDoc: any): TourStop[] {
        if (!tourDoc?.description) return [];
        try {
            let desc = tourDoc.description;
            if (typeof desc === 'string') {
                const trimmed = desc.trim();
                if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                    desc = JSON.parse(trimmed);
                } else {
                    return [];
                }
            }
            return Array.isArray(desc.stops) ? desc.stops : [];
        } catch {
            return [];
        }
    }

    let tour: any = null;
    let isLoading = true;
    let error = '';
    let userRating = 0;
    let notificationEmail = '';
    let notificationMessage = '';
    let isSubmittingRating = false;
    let showFlyNotification = false;
    let flyMessage = '';
    
    // Scheduled tours
    let scheduledTours: any[] = [];
    let isLoadingSchedules = true;
    let scheduleError = '';
    
    // Booking form
    let selectedScheduleId = '';
    let bookingName = '';
    let bookingEmail = '';
    let bookingParticipants = 1;
    let bookingNotes = '';
    let isSubmittingBooking = false;
    let bookingMessage = '';
    let bookingSuccess = false;
    
    import { page } from '$app/stores';
    
    const tourId = $page.params.tourId;
    
    onMount(async () => {
        try {
            const response = await ConvexService.getTour(tourId);
            
            if (response && response.data) {
                tour = response.data;
                
                // Get user's rating if logged in
                if ($currentUser && tour) {
                    try {
                        const ratings = await ConvexService.getTourRatings(tour.id || tour.$id);
                        // Make sure ratings.data exists and is an array before using find
                        if (ratings && ratings.data && Array.isArray(ratings.data)) {
                            const userRatingData = ratings.data.find((r: any) => r.user_id === $currentUser.id);
                            userRating = userRatingData ? userRatingData.language_learning_rating : 0;
                        }
                    } catch (ratingErr) {
                        console.error('Error fetching ratings:', ratingErr);
                        // Continue without ratings data
                    }
                }
                
                // Fetch scheduled tours for this tour
                await fetchScheduledTours(tour?.id || tour?.$id || '');
                
                // Pre-fill booking form if user is logged in
                if ($currentUser) {
                    bookingName = $currentUser.username || '';
                }
            } else {
                error = 'Tour not found';
            }
            isLoading = false;
        } catch (err: any) {
            error = err.message || 'Failed to load tour details';
            isLoading = false;
        }
    });
    
    // Fetch scheduled tours for a specific tour
    const fetchScheduledTours = async (tourId: string) => {
        isLoadingSchedules = true;
        scheduleError = '';
        
        try {
            const response = await ConvexService.getScheduledTours(tourId);
            
            if (response.error) {
                scheduleError = response.error?.message || 'Failed to load scheduled tours';
                scheduledTours = [];
            } else {
                scheduledTours = response.data || [];
                
                // Sort by date (most recent first)
                scheduledTours.sort((a, b) => {
                    return new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime();
                });
                
                // Filter out past schedules
                scheduledTours = scheduledTours.filter(schedule => {
                    return new Date(schedule.scheduled_date) > new Date();
                });
                
                // For each schedule, fetch the current participants count from bookings
                for (const schedule of scheduledTours) {
                    try {
                        const bookingsResponse = await ConvexService.getBookingsForSchedule(schedule.id);
                        
                        if (!bookingsResponse.error && bookingsResponse.data) {
                            // Calculate total participants from bookings
                            schedule.current_participants = bookingsResponse.data.reduce(
                                (sum, booking) => sum + (booking.participants || 0), 0
                            );
                        } else {
                            schedule.current_participants = 0;
                        }
                    } catch (err) {
                        console.error(`Error fetching bookings for schedule ${schedule.id}:`, err);
                        schedule.current_participants = 0;
                    }
                }
            }
        } catch (err: any) {
            console.error('Error fetching scheduled tours:', err);
            scheduleError = err.message || 'An unexpected error occurred';
            scheduledTours = [];
        } finally {
            isLoadingSchedules = false;
        }
    };
    
    // Format date for display
    const formatDate = (dateString: string) => {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch (error) {
            console.error('Error formatting date:', error);
            return 'Invalid date';
        }
    };
    
    // Handle booking submission
    const handleBooking = async () => {
        if (!selectedScheduleId) {
            bookingMessage = 'Please select a scheduled tour';
            bookingSuccess = false;
            return;
        }
        
        if (!bookingName || !bookingEmail) {
            bookingMessage = 'Please provide your name and email';
            bookingSuccess = false;
            return;
        }
        
        isSubmittingBooking = true;
        bookingMessage = '';
        bookingSuccess = false;
        
        try {
            const userId = $currentUser?.id || 'anonymous';
            const response = await ConvexService.bookTour(
                selectedScheduleId,
                userId,
                bookingName,
                bookingEmail,
                bookingParticipants,
                bookingNotes
            );
            
            if (response.error) {
                bookingMessage = response.error?.message || 'Failed to book tour';
                bookingSuccess = false;
            } else {
                bookingMessage = 'Tour booked successfully! You will receive a confirmation email shortly.';
                bookingSuccess = true;
                
                // Reset form
                selectedScheduleId = '';
                bookingParticipants = 1;
                bookingNotes = '';
                
                // Show fly notification and redirect after 5 seconds
                flyMessage = 'Tour booked successfully! You will receive a confirmation email shortly.';
                showFlyNotification = true;
            }
        } catch (err: any) {
            console.error('Error booking tour:', err);
            bookingMessage = err.message || 'An unexpected error occurred';
            bookingSuccess = false;
        } finally {
            isSubmittingBooking = false;
        }
    };
    
    const handleNotifyMe = async () => {
        if (!notificationEmail) {
            notificationMessage = 'Please enter your email address.';
            return;
        }
        
        if (!tour) {
            notificationMessage = 'Tour information not available.';
            return;
        }
        
        try {
            const tourId = tour.id || tour.$id;
            const response = await ConvexService.saveNotification(tourId, notificationEmail);
            
            if (response.error) {
                console.error('Error saving notification:', response.error);
                notificationMessage = response.error?.message || 'Failed to save notification. Please try again.';
            } else {
                notificationMessage = 'Thank you! We will notify you when this tour is scheduled.';
                notificationEmail = '';
                
                // Show fly notification and redirect after 5 seconds
                flyMessage = 'Thank you! We will notify you when this tour is scheduled.';
                showFlyNotification = true;
            }
        } catch (err: any) {
            console.error('Unexpected error in notification handling:', err);
            notificationMessage = 'An unexpected error occurred. Please try again.';
        }
    };
    
    const handleRatingChange = async (rating: number) => {
        if (!$currentUser) {
            goto('/login');
            return;
        }
        
        if (!tour) {
            error = 'Tour information not available.';
            return;
        }
        
        isSubmittingRating = true;
        try {
            const tourId = tour.id || tour.$id;
            await ConvexService.submitTourRatings(tourId, $currentUser.id, rating, rating, rating, '');
            userRating = rating;
            
            // Refresh tour data to update average rating
            const response = await ConvexService.getTour(tourId);
            if (response && response.data) {
                tour = response.data;
            }
        } catch (err: any) {
            console.error('Error submitting rating:', err);
            error = err.message || 'Failed to save rating. Please try again.';
        } finally {
            isSubmittingRating = false;
        }
    };
    
    // getTourData is now imported from $lib/tourValidation
</script>

<div class="container mx-auto px-4 py-8">
    {#if showFlyNotification}
        <FlyNotification 
            message={flyMessage} 
            type="success" 
            duration={5000} 
            onClose={() => {
                showFlyNotification = false;
                goto('/');
            }} 
        />
    {/if}
    {#if isLoading}
        <div class="flex justify-center items-center h-64">
            <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-400"></div>
        </div>
    {:else if error}
        <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert">
            <p>{error}</p>
        </div>
    {:else if tour}
        {@const tourData = getTourData(tour)}
        <div class="bg-white rounded-lg border border-slate-200 p-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    {#if tourData.imageUrl}
                        <img src={tourData.imageUrl} alt={tourData.name} class="w-full h-96 object-cover rounded-lg" />
                    {:else}
                        <div class="w-full h-96 bg-gradient-to-br from-green-50 to-slate-100 rounded-lg flex items-center justify-center">
                            <svg class="w-20 h-20 text-green-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                    {/if}
                </div>
                <div>
                    <div class="flex justify-between items-start mb-2">
                        <h1 class="text-3xl font-bold">{tourData.name}</h1>
                        <!-- Price tag -->
                        <span class="bg-green-100 text-green-800 text-lg font-medium px-3 py-1 rounded-full flex items-center">
                            <svg class="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                            {#if tourData.tourType === 'app'}
                                Free
                            {:else}
                                €{tourData.price || 0}/person
                            {/if}
                        </span>
                    </div>
                    
                    {#if citiesStore}
                        {#each $citiesStore as city}
                            {#if city.id === tourData.cityId}
                                <p class="text-slate-600 mb-4">{city.name}, {city.country}</p>
                            {/if}
                        {/each}
                    {/if}
                    
                    <p class="text-slate-600 mb-4">Language: {tourData.language}</p>
                    <div class="flex items-center mb-4">
                        <span class="text-slate-600 mr-2">Average Rating:</span>
                        <span class="bg-green-100 text-green-700 text-xs font-semibold px-2.5 py-0.5 rounded">{ConvexService.getAverageRating(tour).toFixed(1)}</span>
                    </div>
                    
                    {#if $currentUser}
                        <div class="mb-6">
                            <h3 class="text-lg font-semibold mb-2">Rate this tour:</h3>
                            <div class="flex items-center space-x-1">
                                {#each Array(5) as _, i}
                                    <button 
                                        on:click={() => handleRatingChange(i + 1)} 
                                        class={`w-6 h-6 ${i < userRating ? 'text-yellow-400' : 'text-gray-300'} ${isSubmittingRating ? 'opacity-50 cursor-not-allowed' : ''}`} 
                                        disabled={isSubmittingRating}
                                        aria-label={`Rate ${i + 1} star${i > 0 ? 's' : ''}`}
                                    >
                                        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 22 20">
                                            <path d="M20.924 7.625a1.523 1.523 0 0 0-1.238-1.044l-5.051-.734-2.259-4.577a1.534 1.534 0 0 0-2.752 0L7.365 5.847l-5.051.734A1.535 1.535 0 0 0 1.463 9.2l3.656 3.563-.863 5.031a1.532 1.532 0 0 0 2.226 1.616L11 17.033l4.518 2.375a1.534 1.534 0 0 0 2.226-1.617l-.863-5.03L20.537 9.2a1.523 1.523 0 0 0 .387-1.575Z"/>
                                        </svg>
                                    </button>
                                {/each}
                            </div>
                        </div>
                    {/if}
                    
                    <h3 class="text-lg font-semibold mb-2">Description</h3>
                    <p class="text-slate-700">{tourData.description}</p>

                    <!-- Tour Stops Map -->
                    {#if getStops(tour).length > 0}
                        {@const stops = getStops(tour)}
                        <div class="mt-6">
                            <h3 class="text-lg font-semibold mb-2">Tour Route ({stops.length} stop{stops.length !== 1 ? 's' : ''})</h3>
                            <TourStopsMap {stops} />
                        </div>
                    {/if}

                    <!-- Scheduled Tours Section -->
                    <div class="mt-6">
                        <h3 class="text-lg font-semibold mb-2">Upcoming Scheduled Tours</h3>
                        
                        {#if isLoadingSchedules}
                            <div class="flex justify-center items-center h-16">
                                <div class="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-green-400"></div>
                            </div>
                        {:else if scheduleError}
                            <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert">
                                <p>{scheduleError}</p>
                            </div>
                        {:else if scheduledTours.length === 0}
                            <p class="text-slate-600 mb-3">No upcoming scheduled tours available.</p>
                            
                            {@const tourData = getTourData(tour)}
                            {#if tourData.tourType === 'app'}
                                <div class="mt-4">
                                    <h4 class="text-md font-semibold mb-2">App-Guided Tour</h4>
                                    <p class="text-slate-600 mb-3">This tour is self-guided through our app. Start exploring at your convenience:</p>
                                    <div class="flex flex-col gap-3 max-w-md">
                                        <button 
                                            on:click={() => goto(`/tours/${tourId}/start`)}
                                            class="bg-orange-100 hover:bg-orange-200 text-orange-700 border border-orange-200 font-bold py-3 px-6 rounded w-auto flex items-center justify-center gap-2"
                                        >
                                            <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                                <path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            Open Langtour App
                                        </button>
                                    </div>
                                </div>
                            {:else}
                                <div class="mt-4">
                                    <h4 class="text-md font-semibold mb-2">Get Notified</h4>
                                    <p class="text-slate-600 mb-3">Enter your email to be notified when this tour is scheduled:</p>
                                    <div class="flex flex-col gap-3 max-w-md">
                                        <input 
                                            type="email" 
                                            bind:value={notificationEmail}
                                            placeholder="Enter your email" 
                                            class="w-full px-3 py-2 border border-slate-200 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                                        />
                                        <button 
                                            on:click={handleNotifyMe}
                                            class="bg-green-100 hover:bg-green-200 text-green-700 border border-green-200 font-bold py-2 px-4 rounded w-auto"
                                        >
                                            Notify Me
                                        </button>
                                    </div>
                                    {#if notificationMessage}
                                        <p class="mt-2 text-sm {notificationMessage.includes('Thank you') ? 'text-green-600' : 'text-red-600'}">{notificationMessage}</p>
                                    {/if}
                                </div>
                            {/if}
                        {:else}
                            <div class="space-y-4">
                                {#each scheduledTours as schedule}
                                    <div class="border border-slate-200 rounded-lg p-4 hover:bg-slate-50">
                                        <div class="flex flex-col md:flex-row justify-between">
                                            <div>
                                                <p class="font-semibold">{formatDate(schedule.scheduled_date)}</p>
                                                <p class="text-sm text-slate-600">Meeting Point: {schedule.meeting_point}</p>
                                                <p class="text-sm text-slate-600">{schedule.current_participants || 0}/{schedule.max_participants} participants</p>
                                                {#if schedule.additional_info}
                                                    <p class="text-sm text-slate-600 mt-1">Additional Info: {schedule.additional_info}</p>
                                                {/if}
                                            </div>
                                            <div class="mt-2 md:mt-0">
                                                <button 
                                                    class="bg-green-100 hover:bg-green-200 text-green-700 border border-green-200 text-sm font-bold py-1 px-3 rounded"
                                                    on:click={() => selectedScheduleId = schedule.id}
                                                >
                                                    Sign Up
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                {/each}
                                
                                <!-- Booking Form -->
                                {#if selectedScheduleId}
                                    <div class="mt-6 border border-green-200 rounded-lg p-4 bg-green-50">
                                        <h4 class="text-lg font-semibold mb-3">Book Your Spot</h4>
                                        
                                        <div class="space-y-3">
                                            <div>
                                                <label for="bookingName" class="block text-sm font-medium text-slate-700">Your Name</label>
                                                <input 
                                                    id="bookingName"
                                                    type="text" 
                                                    bind:value={bookingName}
                                                    placeholder="Enter your name" 
                                                    class="mt-1 w-full px-3 py-2 border border-slate-200 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                                                    disabled={!$currentUser && !!bookingName}
                                                />
                                            </div>
                                            
                                            <div>
                                                <label for="bookingEmail" class="block text-sm font-medium text-slate-700">Email</label>
                                                <input 
                                                    id="bookingEmail"
                                                    type="email" 
                                                    bind:value={bookingEmail}
                                                    placeholder="Enter your email" 
                                                    class="mt-1 w-full px-3 py-2 border border-slate-200 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                                                    disabled={!$currentUser && !!bookingEmail}
                                                />
                                            </div>
                                            
                                            <div>
                                                <label for="bookingParticipants" class="block text-sm font-medium text-slate-700">Number of Participants</label>
                                                <input 
                                                    id="bookingParticipants"
                                                    type="number" 
                                                    bind:value={bookingParticipants}
                                                    min="1" 
                                                    max="10" 
                                                    class="mt-1 w-full px-3 py-2 border border-slate-200 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                                                />
                                            </div>
                                            
                                            <div>
                                                <label for="bookingNotes" class="block text-sm font-medium text-slate-700">Notes (Optional)</label>
                                                <textarea 
                                                    id="bookingNotes"
                                                    bind:value={bookingNotes}
                                                    placeholder="Any special requests or questions?" 
                                                    rows="3"
                                                    class="mt-1 w-full px-3 py-2 border border-slate-200 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                                                ></textarea>
                                            </div>
                                            
                                            <div class="flex justify-between items-center pt-2">
                                                <button 
                                                    on:click={() => selectedScheduleId = ''}
                                                    class="text-slate-600 hover:text-gray-800"
                                                >
                                                    Cancel
                                                </button>
                                                
                                                <button 
                                                    on:click={handleBooking}
                                                    class="bg-green-100 hover:bg-green-200 text-green-700 border border-green-200 font-bold py-2 px-4 rounded"
                                                    disabled={isSubmittingBooking || !bookingName || !bookingEmail}
                                                >
                                                    {isSubmittingBooking ? 'Booking...' : 'Book Now'}
                                                </button>
                                            </div>
                                            
                                            {#if bookingMessage}
                                                <div class="mt-2 p-2 rounded {bookingSuccess ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
                                                    <p>{bookingMessage}</p>
                                                </div>
                                            {/if}
                                        </div>
                                    </div>
                                {/if}
                            </div>
                        {/if}
                    </div>
                </div>
            </div>
        </div>
    {/if}
</div>
