<script lang="ts">
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { ConvexService, currentUser } from '$lib/firebaseService';
    import { citiesStore } from '$lib/stores/tourStore';
    import FlyNotification from '$lib/components/FlyNotification.svelte';
    import { getTourData, getStops } from '$lib/tourValidation';
    import TourStopsMap from '$lib/components/TourStopsMap.svelte';
    import type { PublicProfile, AverageRatings } from '$lib/firebase/types';

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
    
    // Tour guide profile
    let creatorId: string | null = null;
    let guideProfile: PublicProfile | null = null;
    let guideRatings: AverageRatings | null = null;
    let guideTourCount = 0;

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

                // Fetch tour guide profile
                creatorId = await ConvexService.getTourCreatorId(tour?.id || tour?.$id || '');
                if (creatorId) {
                    const [profile, ratings, tours] = await Promise.all([
                        ConvexService.getPublicProfile(creatorId),
                        ConvexService.getCreatorAverageRatings(creatorId),
                        ConvexService.getCreatorTours(creatorId)
                    ]);
                    guideProfile = profile;
                    guideRatings = ratings;
                    guideTourCount = tours.length;
                }

                // Pre-fill booking form if user is logged in
                if ($currentUser) {
                    bookingName = $currentUser.username || '';
                }
            } else {
                error = 'Route not found';
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
            bookingMessage = 'Please select a scheduled route';
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
                bookingMessage = response.error?.message || 'Failed to book route';
                bookingSuccess = false;
            } else {
                bookingMessage = 'Route booked successfully! You will receive a confirmation email shortly.';
                bookingSuccess = true;
                
                // Reset form
                selectedScheduleId = '';
                bookingParticipants = 1;
                bookingNotes = '';
                
                // Show fly notification and redirect after 5 seconds
                flyMessage = 'Route booked successfully! You will receive a confirmation email shortly.';
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
            notificationMessage = 'Route information not available.';
            return;
        }
        
        try {
            const tourId = tour.id || tour.$id;
            const response = await ConvexService.saveNotification(tourId, notificationEmail);
            
            if (response.error) {
                console.error('Error saving notification:', response.error);
                notificationMessage = response.error?.message || 'Failed to save notification. Please try again.';
            } else {
                notificationMessage = 'Thank you! We will notify you when this route is scheduled.';
                notificationEmail = '';
                
                // Show fly notification and redirect after 5 seconds
                flyMessage = 'Thank you! We will notify you when this route is scheduled.';
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
            error = 'Route information not available.';
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
            <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-slate-300"></div>
        </div>
    {:else if error}
        <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert">
            <p>{error}</p>
        </div>
    {:else if tour}
        {@const tourData = getTourData(tour)}
        {@const stops = getStops(tour)}
        {@const prepStops = stops.filter(s => s.teachingMaterial && ((s.teachingMaterial.keywords && s.teachingMaterial.keywords.length > 0) || s.teachingMaterial.teacherPlan))}

        {#if prepStops.length === 0 && $currentUser && creatorId && $currentUser.id === creatorId}
            <div class="mb-6 bg-amber-50 border border-amber-300 rounded-lg p-5 flex flex-col sm:flex-row sm:items-center gap-4 shadow-sm">
                <div class="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center">
                    <svg class="w-5 h-5 text-amber-700" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                </div>
                <div class="flex-1 min-w-0">
                    <h3 class="text-base font-semibold text-amber-900">Your route has no preparation material yet</h3>
                    <p class="text-sm text-amber-800 mt-0.5">Generate key words and a private guide plan for each stop so students can study before the tour.</p>
                </div>
                <a href="/tours/{tourId}/generate-material"
                   class="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2.5 px-5 rounded-lg text-sm shadow-sm transition-colors shrink-0">
                    Create preparation material
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                </a>
            </div>
        {/if}

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:items-start">
        <!-- Left column: intro + map -->
        <div class="bg-white rounded-lg border border-slate-200 divide-y divide-slate-200">
            <div class="px-6 py-5">
                <div class="flex flex-col md:flex-row md:justify-between md:items-start gap-3 mb-3">
                    <div class="min-w-0">
                        <h1 class="text-2xl font-medium text-slate-700 leading-tight">{tourData.name}</h1>
                        {#if citiesStore}
                            {#each $citiesStore as city}
                                {#if city.id === tourData.cityId}
                                    <p class="text-sm text-slate-500 mt-0.5">{city.name}, {city.country}</p>
                                {/if}
                            {/each}
                        {/if}
                    </div>
                    <span class="bg-slate-100 text-slate-600 text-sm font-medium px-2.5 py-1 rounded-full flex items-center shrink-0 self-start">
                        {#if tourData.tourType === 'app'}Free{:else}€{tourData.price || 0}/person{/if}
                    </span>
                </div>

                <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mb-3">
                    <span><span class="text-slate-400">Learn</span> <span class="font-medium text-slate-700">{tourData.languageTaught || '—'}</span></span>
                    <span class="text-slate-300">·</span>
                    <span><span class="text-slate-400">In</span> <span class="font-medium text-slate-700">{tourData.instructionLanguage || 'English'}</span></span>
                    <span class="text-slate-300">·</span>
                    <span class="inline-flex items-center gap-1">
                        <svg class="w-3.5 h-3.5 text-yellow-400" fill="currentColor" viewBox="0 0 22 20"><path d="M20.924 7.625a1.523 1.523 0 0 0-1.238-1.044l-5.051-.734-2.259-4.577a1.534 1.534 0 0 0-2.752 0L7.365 5.847l-5.051.734A1.535 1.535 0 0 0 1.463 9.2l3.656 3.563-.863 5.031a1.532 1.532 0 0 0 2.226 1.616L11 17.033l4.518 2.375a1.534 1.534 0 0 0 2.226-1.617l-.863-5.03L20.537 9.2a1.523 1.523 0 0 0 .387-1.575Z"/></svg>
                        <span class="font-medium text-slate-700">{ConvexService.getAverageRating(tour).toFixed(1)}</span>
                    </span>
                    {#if stops.length > 0}
                        <span class="text-slate-300">·</span>
                        <span><span class="font-medium text-slate-700">{stops.length}</span> stop{stops.length !== 1 ? 's' : ''}</span>
                    {/if}
                </div>

                <p class="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{tourData.description}</p>

                {#if prepStops.length > 0}
                    <div class="mt-4 flex flex-wrap items-center gap-2">
                        <a
                            href="/tours/{tourId}/prepare"
                            class="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-medium py-1.5 px-3 rounded-md text-xs transition-colors"
                        >
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                            </svg>
                            Prepare · {prepStops.length} stop{prepStops.length !== 1 ? 's' : ''}
                        </a>

                        {#if $currentUser && creatorId && $currentUser.id === creatorId}
                            <a href="/tours/{tourId}/generate-material"
                               class="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-medium py-1.5 px-3 rounded-md text-xs transition-colors">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                                </svg>
                                Edit prep material
                            </a>
                        {/if}
                    </div>
                {/if}
            </div>

            {#if stops.length > 0}
                <div class="p-4">
                    <TourStopsMap {stops} />
                </div>
            {/if}
        </div>

        <!-- Right column: guide + schedules + rating -->
        <div class="bg-white rounded-lg border border-slate-200 divide-y divide-slate-200">
            {#if guideProfile}
                <div class="px-6 py-5">
                    <div class="flex items-center justify-between gap-3 mb-3">
                        <h3 class="text-sm font-semibold uppercase tracking-wide text-slate-500">Your Route Guide</h3>
                        {#if $currentUser}
                            <div class="flex items-center gap-2">
                                <span class="text-xs text-slate-500">Rate this route</span>
                                <div class="flex items-center">
                                    {#each Array(5) as _, i}
                                        <button
                                            on:click={() => handleRatingChange(i + 1)}
                                            class={`w-4 h-4 ${i < userRating ? 'text-yellow-400' : 'text-gray-300'} ${isSubmittingRating ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                    </div>
                    <div class="flex gap-3 items-start">
                        <div class="flex-shrink-0">
                            {#if guideProfile.avatarUrl}
                                <img src={guideProfile.avatarUrl} alt={guideProfile.username} class="w-12 h-12 rounded-full object-cover border border-slate-200" />
                            {:else}
                                <div class="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center">
                                    <svg class="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                                    </svg>
                                </div>
                            {/if}
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                <h4 class="text-sm font-medium text-slate-700">{guideProfile.username}</h4>
                                {#if guideRatings && guideRatings.count > 0}
                                    <span class="inline-flex items-center gap-1 text-xs text-slate-500">
                                        <svg class="w-3 h-3 text-yellow-400" fill="currentColor" viewBox="0 0 22 20"><path d="M20.924 7.625a1.523 1.523 0 0 0-1.238-1.044l-5.051-.734-2.259-4.577a1.534 1.534 0 0 0-2.752 0L7.365 5.847l-5.051.734A1.535 1.535 0 0 0 1.463 9.2l3.656 3.563-.863 5.031a1.532 1.532 0 0 0 2.226 1.616L11 17.033l4.518 2.375a1.534 1.534 0 0 0 2.226-1.617l-.863-5.03L20.537 9.2a1.523 1.523 0 0 0 .387-1.575Z"/></svg>
                                        {guideRatings.overall.toFixed(1)} <span class="text-slate-400">({guideRatings.count})</span>
                                    </span>
                                {/if}
                                {#if guideTourCount > 0}
                                    <span class="text-xs text-slate-500">· {guideTourCount} {guideTourCount === 1 ? 'route' : 'routes'}</span>
                                {/if}
                            </div>
                            {#if guideProfile.bio}
                                <p class="mt-1 text-sm text-slate-600">{guideProfile.bio}</p>
                            {/if}
                            {#if guideProfile.languagesSpoken && guideProfile.languagesSpoken.length > 0}
                                <div class="mt-2 flex flex-wrap gap-1">
                                    {#each guideProfile.languagesSpoken as lang}
                                        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-slate-50 text-slate-600 border border-slate-200">{lang}</span>
                                    {/each}
                                </div>
                            {/if}
                        </div>
                    </div>

                </div>
            {/if}

            <div class="px-6 py-5">
                <h3 class="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-3">Upcoming Scheduled Routes</h3>

                    {#if isLoadingSchedules}
                        <div class="flex justify-center items-center h-16">
                            <div class="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-slate-300"></div>
                        </div>
                    {:else if scheduleError}
                        <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert">
                            <p>{scheduleError}</p>
                        </div>
                    {:else if scheduledTours.length === 0}
                        <p class="text-slate-600 mb-3">No upcoming scheduled routes available.</p>

                        {#if tourData.tourType === 'app'}
                            <div class="mt-4">
                                <h4 class="text-md font-medium text-slate-700 mb-2">App-Guided Route</h4>
                                <p class="text-slate-600 mb-3">This route is self-guided through our app. Start exploring at your convenience:</p>
                                <div class="flex flex-col gap-3 max-w-md">
                                    <button
                                        on:click={() => goto(`/tours/${tourId}/start`)}
                                        class="bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 font-medium py-3 px-6 rounded w-auto flex items-center justify-center gap-2"
                                    >
                                        <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                            <path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        Open ClassRoute App
                                    </button>
                                </div>
                            </div>
                        {:else}
                            <div class="mt-4">
                                <h4 class="text-md font-medium text-slate-700 mb-2">Get Notified</h4>
                                <p class="text-slate-600 mb-3">Enter your email to be notified when this route is scheduled:</p>
                                <div class="flex flex-col gap-3 max-w-md">
                                    <input type="email" bind:value={notificationEmail} placeholder="Enter your email"
                                        class="w-full px-3 py-2 border border-slate-200 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
                                    <button on:click={handleNotifyMe}
                                        class="bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 font-medium py-2 px-4 rounded w-auto">
                                        Notify Me
                                    </button>
                                </div>
                                {#if notificationMessage}
                                    <p class="mt-2 text-sm {notificationMessage.includes('Thank you') ? 'text-slate-600' : 'text-red-600'}">{notificationMessage}</p>
                                {/if}
                            </div>
                        {/if}
                    {:else}
                        <div class="space-y-4">
                            {#each scheduledTours as schedule}
                                <div class="border border-slate-200 rounded-lg p-4 hover:bg-slate-50">
                                    <div class="flex flex-col md:flex-row justify-between">
                                        <div>
                                            <p class="font-medium text-slate-700">{formatDate(schedule.scheduled_date)}</p>
                                            <p class="text-sm text-slate-600">Meeting Point: {schedule.meeting_point}</p>
                                            <p class="text-sm text-slate-600">{schedule.current_participants || 0}/{schedule.max_participants} participants</p>
                                            {#if schedule.additional_info}
                                                <p class="text-sm text-slate-600 mt-1">Additional Info: {schedule.additional_info}</p>
                                            {/if}
                                        </div>
                                        <div class="mt-2 md:mt-0">
                                            <button
                                                class="bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 text-sm font-medium py-1 px-3 rounded"
                                                on:click={() => selectedScheduleId = schedule.id}>
                                                Sign Up
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            {/each}

                            {#if selectedScheduleId}
                                <div class="mt-6 border border-slate-200 rounded-lg p-4 bg-slate-50">
                                    <h4 class="text-lg font-medium text-slate-700 mb-3">Book Your Spot</h4>
                                    <div class="space-y-3">
                                        <div>
                                            <label for="bookingName" class="block text-sm font-normal text-slate-600">Your Name</label>
                                            <input id="bookingName" type="text" bind:value={bookingName} placeholder="Enter your name"
                                                class="mt-1 w-full px-3 py-2 border border-slate-200 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                                                disabled={!$currentUser && !!bookingName} />
                                        </div>
                                        <div>
                                            <label for="bookingEmail" class="block text-sm font-normal text-slate-600">Email</label>
                                            <input id="bookingEmail" type="email" bind:value={bookingEmail} placeholder="Enter your email"
                                                class="mt-1 w-full px-3 py-2 border border-slate-200 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                                                disabled={!$currentUser && !!bookingEmail} />
                                        </div>
                                        <div>
                                            <label for="bookingParticipants" class="block text-sm font-normal text-slate-600">Number of Participants</label>
                                            <input id="bookingParticipants" type="number" bind:value={bookingParticipants} min="1" max="10"
                                                class="mt-1 w-full px-3 py-2 border border-slate-200 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
                                        </div>
                                        <div>
                                            <label for="bookingNotes" class="block text-sm font-normal text-slate-600">Notes (Optional)</label>
                                            <textarea id="bookingNotes" bind:value={bookingNotes} placeholder="Any special requests or questions?" rows="3"
                                                class="mt-1 w-full px-3 py-2 border border-slate-200 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-300"></textarea>
                                        </div>
                                        <div class="flex justify-between items-center pt-2">
                                            <button on:click={() => selectedScheduleId = ''} class="text-slate-600 hover:text-gray-800">Cancel</button>
                                            <button on:click={handleBooking}
                                                class="bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 font-medium py-2 px-4 rounded"
                                                disabled={isSubmittingBooking || !bookingName || !bookingEmail}>
                                                {isSubmittingBooking ? 'Booking...' : 'Book Now'}
                                            </button>
                                        </div>
                                        {#if bookingMessage}
                                            <div class="mt-2 p-2 rounded {bookingSuccess ? 'bg-slate-100 text-slate-600' : 'bg-red-100 text-red-600'}">
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
    {/if}
</div>
