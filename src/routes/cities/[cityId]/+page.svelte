<script lang="ts">
    import { page } from '$app/stores';
    import { citiesStore, getToursByCity } from '$lib/stores/tourStore';
    import TourCard from '$lib/components/TourCard.svelte';
    
    const cityId = $page.params.cityId;
    const city = $citiesStore.find(c => c.id === cityId);
    const tours = getToursByCity(cityId);
</script>

<div class="container mx-auto px-4 py-8">
    <div class="mb-8">
        <a href="/" class="text-blue-600 hover:underline inline-flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clip-rule="evenodd" />
            </svg>
            Back to Cities
        </a>
    </div>

    {#if city}
        <div class="mb-8">
            <div class="relative h-64 rounded-lg overflow-hidden mb-4">
                <img 
                    src={city.imageUrl || '/images/placeholder.svg'} 
                    alt="{city.name}" 
                    class="w-full h-full object-cover"
                />
                <div class="absolute inset-0 bg-black bg-opacity-40 flex items-end">
                    <div class="p-6 text-white">
                        <h1 class="text-3xl font-bold">{city.name}</h1>
                        <p class="text-xl">{city.country}</p>
                    </div>
                </div>
            </div>
        </div>

        <h2 class="text-2xl font-semibold mb-6">Language Tours in {city.name}</h2>
        
        {#if tours.length > 0}
            <div class="space-y-6">
                {#each tours as tour}
                    <TourCard {tour} />
                {/each}
            </div>
        {:else}
            <div class="bg-gray-100 p-8 rounded-lg text-center">
                <p class="text-gray-600">No tours available for {city.name} at the moment.</p>
            </div>
        {/if}
    {:else}
        <div class="bg-red-100 p-8 rounded-lg text-center">
            <p class="text-red-600">City not found. Please select a valid city from the homepage.</p>
        </div>
    {/if}
</div>
