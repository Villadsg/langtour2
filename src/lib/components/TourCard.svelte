<script lang="ts">
    import { onMount } from 'svelte';
    import type { Tour } from '$lib/stores/tourStore';
    import { citiesStore } from '$lib/stores/tourStore';
    import { SupabaseService } from '$lib/supabaseService';

    let { tour } = $props<{ tour: Tour }>();
    
    // Get the city information for this tour
    const city = $citiesStore.find(c => c.id === tour.cityId);
    let averageRating = SupabaseService.getAverageRating(tour);
    
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
    
    // Store creator ID
    let creatorId = $state<string | null>(null);
    
    onMount(async () => {
        try {
            // Fetch multi-dimensional ratings if available
            if (tour.id) {
                const tourRatings = await SupabaseService.getAverageTourRatings(tour.id);
                if (tourRatings) {
                    ratings = tourRatings;
                }
                
                // Get creator ID
                creatorId = await SupabaseService.getTourCreatorId(tour.id);
                
                // Fetch creator ratings if creator ID is available
                if (creatorId) {
                    const creatorAvgRatings = await SupabaseService.getCreatorAverageRatings(creatorId);
                    if (creatorAvgRatings) {
                        creatorRatings = creatorAvgRatings;
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching ratings:', error);
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

<a href="/tours/{tour.id}" class="block rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-300 bg-white mb-4">
    <div class="p-5">
        <div class="flex flex-col md:flex-row md:justify-between md:space-x-4">
            <!-- Left side: Tour information -->
            <div class="flex-1">
                <h3 class="text-xl font-semibold">{tour.name}</h3>
                <div class="flex items-center mt-2">
                    <div class="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm mr-3">
                        {tour.language}
                    </div>
                    {#if city}
                        <span class="text-gray-600 text-sm">{city.name}, {city.country}</span>
                    {/if}
                </div>
                <div class="mt-4 flex items-center">
                    <div class="flex items-center">
                        <div class="flex items-center space-x-1 mr-2">
                            {#each Array(5) as _, i}
                                <svg class={`w-4 h-4 ${i < Math.round(ratings.overall) ? getRatingColor(ratings.overall) : 'text-gray-300'}`} aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 22 20">
                                    <path d="M20.924 7.625a1.523 1.523 0 0 0-1.238-1.044l-5.051-.734-2.259-4.577a1.534 1.534 0 0 0-2.752 0L7.365 5.847l-5.051.734A1.535 1.535 0 0 0 1.463 9.2l3.656 3.563-.863 5.031a1.532 1.532 0 0 0 2.226 1.616L11 17.033l4.518 2.375a1.534 1.534 0 0 0 2.226-1.617l-.863-5.03L20.537 9.2a1.523 1.523 0 0 0 .387-1.575Z"/>
                                </svg>
                            {/each}
                        </div>
                        <span class="bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-0.5 rounded">{ratings.overall.toFixed(1)}</span>
                        {#if ratings.count > 0}
                            <span class="text-xs text-gray-500 ml-1">({ratings.count})</span>
                        {/if}
                    </div>
                </div>
                <div class="mt-3">
                    <span class="text-blue-600 text-sm">View details →</span>
                </div>
            </div>
            
            <!-- Right side: Ratings -->
            <div class="mt-4 md:mt-0 border-t md:border-t-0 md:border-l pt-3 md:pt-0 md:pl-4 md:min-w-[180px]">
                <div class="text-xs font-medium text-gray-700 mb-2">Ratings</div>
                <!-- Language Learning Rating -->
                <div class="flex items-center mb-1.5">
                    <span class="text-xs font-medium text-gray-700 w-24">Language:</span>
                    <div class="flex items-center space-x-1">
                        {#each Array(5) as _, i}
                            <svg class={`w-3 h-3 ${i < Math.round(ratings.languageLearning) ? getRatingColor(ratings.languageLearning) : 'text-gray-300'}`} aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 22 20">
                                <path d="M20.924 7.625a1.523 1.523 0 0 0-1.238-1.044l-5.051-.734-2.259-4.577a1.534 1.534 0 0 0-2.752 0L7.365 5.847l-5.051.734A1.535 1.535 0 0 0 1.463 9.2l3.656 3.563-.863 5.031a1.532 1.532 0 0 0 2.226 1.616L11 17.033l4.518 2.375a1.534 1.534 0 0 0 2.226-1.617l-.863-5.03L20.537 9.2a1.523 1.523 0 0 0 .387-1.575Z"/>
                            </svg>
                        {/each}
                    </div>
                    <span class="text-xs text-gray-600 ml-2">{ratings.languageLearning.toFixed(1)}</span>
                </div>
                
                <!-- Informative Rating -->
                <div class="flex items-center mb-1.5">
                    <span class="text-xs font-medium text-gray-700 w-24">Informative:</span>
                    <div class="flex items-center space-x-1">
                        {#each Array(5) as _, i}
                            <svg class={`w-3 h-3 ${i < Math.round(ratings.informative) ? getRatingColor(ratings.informative) : 'text-gray-300'}`} aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 22 20">
                                <path d="M20.924 7.625a1.523 1.523 0 0 0-1.238-1.044l-5.051-.734-2.259-4.577a1.534 1.534 0 0 0-2.752 0L7.365 5.847l-5.051.734A1.535 1.535 0 0 0 1.463 9.2l3.656 3.563-.863 5.031a1.532 1.532 0 0 0 2.226 1.616L11 17.033l4.518 2.375a1.534 1.534 0 0 0 2.226-1.617l-.863-5.03L20.537 9.2a1.523 1.523 0 0 0 .387-1.575Z"/>
                            </svg>
                        {/each}
                    </div>
                    <span class="text-xs text-gray-600 ml-2">{ratings.informative.toFixed(1)}</span>
                </div>
                
                <!-- Fun Rating -->
                <div class="flex items-center mb-1.5">
                    <span class="text-xs font-medium text-gray-700 w-24">Fun:</span>
                    <div class="flex items-center space-x-1">
                        {#each Array(5) as _, i}
                            <svg class={`w-3 h-3 ${i < Math.round(ratings.fun) ? getRatingColor(ratings.fun) : 'text-gray-300'}`} aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 22 20">
                                <path d="M20.924 7.625a1.523 1.523 0 0 0-1.238-1.044l-5.051-.734-2.259-4.577a1.534 1.534 0 0 0-2.752 0L7.365 5.847l-5.051.734A1.535 1.535 0 0 0 1.463 9.2l3.656 3.563-.863 5.031a1.532 1.532 0 0 0 2.226 1.616L11 17.033l4.518 2.375a1.534 1.534 0 0 0 2.226-1.617l-.863-5.03L20.537 9.2a1.523 1.523 0 0 0 .387-1.575Z"/>
                            </svg>
                        {/each}
                    </div>
                    <span class="text-xs text-gray-600 ml-2">{ratings.fun.toFixed(1)}</span>
                </div>
                
                <!-- Creator Rating -->
                {#if creatorId && creatorRatings.count > 0}
                    <div class="flex items-center">
                        <span class="text-xs font-medium text-gray-700 w-24">Creator:</span>
                        <div class="flex items-center space-x-1">
                            {#each Array(5) as _, i}
                                <svg class={`w-3 h-3 ${i < Math.round(creatorRatings.overall) ? getRatingColor(creatorRatings.overall) : 'text-gray-300'}`} aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 22 20">
                                    <path d="M20.924 7.625a1.523 1.523 0 0 0-1.238-1.044l-5.051-.734-2.259-4.577a1.534 1.534 0 0 0-2.752 0L7.365 5.847l-5.051.734A1.535 1.535 0 0 0 1.463 9.2l3.656 3.563-.863 5.031a1.532 1.532 0 0 0 2.226 1.616L11 17.033l4.518 2.375a1.534 1.534 0 0 0 2.226-1.617l-.863-5.03L20.537 9.2a1.523 1.523 0 0 0 .387-1.575Z"/>
                                </svg>
                            {/each}
                        </div>
                        <div class="flex items-center">
                            <span class="text-xs text-gray-600 ml-2">{creatorRatings.overall.toFixed(1)}</span>
                            <span class="text-xs text-gray-500 ml-1">({creatorRatings.count})</span>
                            <span class="ml-1" title="Average across all tours by this creator">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </span>
                        </div>
                    </div>
                {/if}
            </div>
        </div>
    </div>
</a>
