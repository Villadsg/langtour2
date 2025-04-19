<script lang="ts">
    import type { Tour } from '$lib/stores/tourStore';
    import { citiesStore } from '$lib/stores/tourStore';
    
    let { tour } = $props<{ tour: Tour }>();
    
    // Get the city information for this tour
    const city = $citiesStore.find(c => c.id === tour.cityId);
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
        <p class="mt-3 text-gray-700">{tour.description}</p>
    </div>
</a>
