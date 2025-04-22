<script lang="ts">
    import type { Tour } from '$lib/stores/tourStore';
    import { citiesStore } from '$lib/stores/tourStore';
    import { AppwriteService } from '$lib/appwriteService';

    let { tour } = $props<{ tour: Tour }>();
    
    // Get the city information for this tour
    const city = $citiesStore.find(c => c.id === tour.cityId);
    let averageRating = AppwriteService.getAverageRating(tour);
</script>

<a href="/tours/{tour.id}" class="block rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-300 bg-white mb-4">
    <div class="p-5">
        <h3 class="text-xl font-semibold">{tour.name}</h3>
        <div class="flex items-center mt-2">
            <div class="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm mr-3">
                {tour.language}
            </div>
            {#if city}
                <span class="text-gray-600 text-sm">{city.name}, {city.country}</span>
            {/if}
        </div>
        <div class="flex items-center mt-2.5 mb-5">
            <div class="flex items-center space-x-1">
                {#each Array(5) as _, i}
                    <svg class="w-4 h-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 22 20">
                        <path d="M20.924 7.625a1.523 1.523 0 0 0-1.238-1.044l-5.051-.734-2.259-4.577a1.534 1.534 0 0 0-2.752 0L7.365 5.847l-5.051.734A1.535 1.535 0 0 0 1.463 9.2l3.656 3.563-.863 5.031a1.532 1.532 0 0 0 2.226 1.616L11 17.033l4.518 2.375a1.534 1.534 0 0 0 2.226-1.617l-.863-5.03L20.537 9.2a1.523 1.523 0 0 0 .387-1.575Z"/>
                    </svg>
                {/each}
            </div>
            <span class="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded ms-3">{averageRating.toFixed(1)}</span>
        </div>
        <div class="mt-3 flex justify-between items-center">
            <span class="text-blue-600 text-sm">View details →</span>
        </div>
    </div>
</a>
