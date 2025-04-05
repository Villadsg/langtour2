<script lang="ts">
    import { page } from '$app/stores';
    import { citiesStore, getTourById } from '$lib/stores/tourStore';
    import NotificationForm from '$lib/components/NotificationForm.svelte';
    
    const tourId = $page.params.tourId;
    const tour = getTourById(tourId);
    const city = tour ? $citiesStore.find(c => c.id === tour.cityId) : null;
</script>

<div class="container mx-auto px-4 py-8">
    <div class="mb-8">
        {#if city}
            <a href="/cities/{city.id}" class="text-blue-600 hover:underline inline-flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clip-rule="evenodd" />
                </svg>
                Back to {city.name} Tours
            </a>
        {:else}
            <a href="/" class="text-blue-600 hover:underline inline-flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clip-rule="evenodd" />
                </svg>
                Back to Cities
            </a>
        {/if}
    </div>

    {#if tour && city}
        <div class="bg-white rounded-lg shadow-md overflow-hidden mb-8">
            <div class="p-6">
                <div class="flex items-center mb-4">
                    <div class="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm mr-3">
                        {tour.language}
                    </div>
                    <div class="text-gray-600">{city.name}, {city.country}</div>
                </div>
                
                <h1 class="text-3xl font-bold mb-4">{tour.name}</h1>
                <p class="text-gray-700 text-lg leading-relaxed mb-6">{tour.description}</p>
                
                <div class="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                    <p class="text-yellow-800">
                        <span class="font-semibold">Note:</span> This tour is not currently scheduled. Sign up below to be notified when it becomes available.
                    </p>
                </div>
            </div>
        </div>

        <NotificationForm tourId={tourId} />
    {:else}
        <div class="bg-red-100 p-8 rounded-lg text-center">
            <p class="text-red-600">Tour not found. Please select a valid tour from the city page.</p>
        </div>
    {/if}
</div>
