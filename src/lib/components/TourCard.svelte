<script lang="ts">
    import { onMount } from 'svelte';
    import type { Tour } from '$lib/stores/tourStore';
    import { citiesStore } from '$lib/stores/tourStore';
    import { ConvexService } from '$lib/firebaseService';

    let { tour } = $props<{ tour: Tour }>();

    // Derive effective tourType without mutating the prop
    let effectiveTourType = $derived.by(() => {
        if (tour.description) {
            try {
                const descObj = typeof tour.description === 'string'
                    ? JSON.parse(tour.description)
                    : tour.description;
                return descObj.tourType || 'person';
            } catch {
                return 'person';
            }
        }
        return 'person';
    });

    // Get the city information for this tour
    let city = $derived($citiesStore.find(c => c.id === tour.cityId));
    let averageRating = $derived(ConvexService.getAverageRating(tour));
    
    // Initialize ratings
    let ratings = $state({
        languageLearning: 0,
        informative: 0,
        fun: 0,
        overall: 0,
        count: 0
    });
    
    // Initialize creator ratings
    let creatorRatings = $state({
        languageLearning: 0,
        informative: 0,
        fun: 0,
        overall: 0,
        count: 0
    });
    
    // Store creator ID and username
    let creatorId = $state<string | null>(null);
    let creatorUsername = $state<string | null>(null);
    
    // Store next scheduled tour
    let nextSchedule = $state<any | null>(null);
    
    // Format date to day of week
    function formatDateToDayOfWeek(dateString: string): string {
        const date = new Date(dateString);
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        // Check if it's today or tomorrow
        if (date.toDateString() === today.toDateString()) {
            return 'today';
        } else if (date.toDateString() === tomorrow.toDateString()) {
            return 'tomorrow';
        }
        
        // Otherwise return the day of the week
        return date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    }
    
    onMount(async () => {
        try {
            // Fetch multi-dimensional ratings if available
            if (tour.id) {
                const tourRatings = await ConvexService.getAverageTourRatings(tour.id);
                if (tourRatings) {
                    ratings = tourRatings;
                }
                
                // Get creator ID
                creatorId = await ConvexService.getTourCreatorId(tour.id);
                
                // Fetch creator ratings and username if creator ID is available
                if (creatorId) {
                    const creatorAvgRatings = await ConvexService.getCreatorAverageRatings(creatorId);
                    if (creatorAvgRatings) {
                        creatorRatings = creatorAvgRatings;
                    }
                    
                    // Get creator username
                    creatorUsername = await ConvexService.getUsernameById(creatorId);
                }
                
                // Get next scheduled tour
                const { data } = await ConvexService.getNextScheduledTour(tour.id);
                if (data) {
                    nextSchedule = data;
                }
            }
        } catch (error) {
            console.error('Error fetching tour data:', error);
        }
    });
    
    // Helper function to get star color based on rating
    function getRatingColor(rating: number): string {
        if (rating >= 4.5) return 'text-yellow-400';
        if (rating >= 3.5) return 'text-yellow-300';
        if (rating >= 2.5) return 'text-yellow-200';
        if (rating >= 1.5) return 'text-gray-400';
        return 'text-gray-300';
    }
</script>

<a href="/tours/{tour.id}" class="block border border-slate-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300 bg-white mb-6 w-full">
    {#if tour.imageUrl}
        <img src={tour.imageUrl} alt={tour.name} class="w-full h-40 object-cover" />
    {:else}
        <div class="w-full h-40 bg-gradient-to-br from-green-50 to-slate-100 flex items-center justify-center">
            <svg class="w-12 h-12 text-green-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        </div>
    {/if}
    <div class="p-6">
        <div class="flex flex-col md:flex-row md:justify-between md:space-x-6">
            <!-- Left side: Tour information -->
            <div class="flex-1">
                <div class="flex flex-wrap items-center gap-3 mb-2">
                    <h3 class="text-xl font-medium text-slate-800">{tour.name}</h3>
                    
                </div>
                <div class="flex flex-wrap items-center gap-3 mb-2">
                    <div class="inline-block px-2.5 py-1 bg-green-50 text-green-700 text-sm mr-3 border border-green-200 rounded-md">
                        {tour.languageTaught || 'Not specified'}
                    </div>



                    <!-- Tour Type Marker (moved next to heading) -->
                    {#if effectiveTourType === 'person'}
                    <span class="inline-flex items-center px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium border border-slate-200">
                        <svg class="h-4 w-4 mr-1 text-slate-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                        </svg>
                        Tour Guide
                    </span>
                {:else if effectiveTourType === 'app'}
                    <span class="inline-flex items-center px-3 py-1 rounded-full bg-orange-50 text-orange-700 text-xs font-medium border border-orange-200">
                        <svg class="h-4 w-4 mr-1 text-orange-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <rect x="7" y="2" width="10" height="20" rx="2" />
                            <circle cx="12" cy="18" r="1" />
                        </svg>
                        App-guide
                    </span>
                {:else}
                    <span class="inline-flex items-center px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium border border-slate-200">
                        <svg class="h-4 w-4 mr-1 text-slate-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                        </svg>
                        Tour Guide
                    </span>
                {/if}

                 
    
            </div>

                <div class="flex items-center mt-3 gap-3 mb-2">
                    
                    {#if city}
                        <span class="text-slate-600 text-sm">{city.name}, {city.country}</span>
                    {/if}

                   
                </div>
        
                <!-- Price tag - updated logic -->
                <div class="mt-4 flex items-center justify-between">
                    <span class="bg-green-100 text-green-800 text-sm font-medium px-2.5 py-0.5 rounded-full flex items-center">
                        {#if effectiveTourType === 'app'}
                            Free
                        {:else if nextSchedule && nextSchedule.price !== null && nextSchedule.price !== undefined}
                            €{nextSchedule.price.toFixed(2)}/person
                        {:else}
                            Price available when scheduled
                        {/if}
                    </span>
                </div>
                  
                

                 <!-- Next scheduled tour badge -->
                 {#if nextSchedule}
                 <div class="mt-4 inline-flex items-center px-3 py-1.5 bg-orange-50 text-orange-700 text-sm font-medium rounded-lg border border-orange-200">

                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1.5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 002 2v12a2 2 0 002 2z" />
                     </svg>
                     <span class="font-medium">Next Time: {formatDateToDayOfWeek(nextSchedule.scheduled_date)}</span>
                    </div>
             {/if}

               
            </div>
            
            <!-- Right side: Rating & creator -->
            <div class="mt-4 md:mt-0 border-t md:border-t-0 md:border-l border-slate-200 pt-4 md:pt-0 md:pl-6 flex flex-col items-start md:items-center justify-center gap-3">
                <!-- Overall rating -->
                <div class="flex items-center gap-2">
                    <div class="flex items-center space-x-0.5">
                        {#each Array(5) as _, i}
                            <svg class={`w-4 h-4 ${i < Math.round(ratings.overall || ((ratings.languageLearning + ratings.informative + ratings.fun) / 3)) ? getRatingColor(ratings.overall || ((ratings.languageLearning + ratings.informative + ratings.fun) / 3)) : 'text-slate-200'}`} aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 22 20">
                                <path d="M20.924 7.625a1.523 1.523 0 0 0-1.238-1.044l-5.051-.734-2.259-4.577a1.534 1.534 0 0 0-2.752 0L7.365 5.847l-5.051.734A1.535 1.535 0 0 0 1.463 9.2l3.656 3.563-.863 5.031a1.532 1.532 0 0 0 2.226 1.616L11 17.033l4.518 2.375a1.534 1.534 0 0 0 2.226-1.617l-.863-5.03L20.537 9.2a1.523 1.523 0 0 0 .387-1.575Z"/>
                            </svg>
                        {/each}
                    </div>
                    <span class="text-sm font-medium text-slate-700">
                        {(ratings.overall || ((ratings.languageLearning + ratings.informative + ratings.fun) / 3)).toFixed(1)}
                    </span>
                    {#if ratings.count > 0}
                        <span class="text-xs text-slate-400">({ratings.count})</span>
                    {/if}
                </div>

                <!-- Creator info -->
                {#if creatorUsername}
                    <div class="flex items-center gap-1.5 text-sm text-slate-500">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                        </svg>
                        <span>{creatorUsername}</span>
                    </div>
                {/if}
            </div>
        </div>
    </div>
</a>
