<script lang="ts">
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { AppwriteService, currentUser } from '$lib/appwriteService';
    import { citiesStore } from '$lib/stores/tourStore';
    import type { Models } from 'appwrite';
    
    let tour: Models.Document | null = null;
    let isLoading = true;
    let error = '';
    let userRating = 0;
    let notificationEmail = '';
    let notificationMessage = '';
    let isSubmittingRating = false;
    
    const tourId = window.location.pathname.split('/').pop() || '';
    
    onMount(async () => {
        try {
            const response = await AppwriteService.getTour(tourId);
            
            if (response) {
                tour = response;
                
                // Get user's rating if logged in
                if ($currentUser) {
                    userRating = AppwriteService.getUserRating(tour, $currentUser.$id);
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
            await AppwriteService.saveNotification(tour.$id, notificationEmail);
            notificationMessage = 'Thank you! We will notify you when this tour is scheduled.';
            notificationEmail = '';
        } catch (err: any) {
            notificationMessage = err.message || 'Failed to save notification. Please try again.';
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
            await AppwriteService.saveTourRating(tour.$id, $currentUser.$id, rating);
            userRating = rating;
            // Refresh tour data to update average rating
            const response = await AppwriteService.getTour(tour.$id);
            if (response) {
                tour = response;
            }
        } catch (err: any) {
            error = err.message || 'Failed to save rating. Please try again.';
        } finally {
            isSubmittingRating = false;
        }
    };
    
    // Helper function to extract tour data from description JSON
    function getTourData(tourDoc: Models.Document) {
        let tourData: Partial<any> = {};
        try {
            if (tourDoc.description && typeof tourDoc.description === 'string') {
                tourData = JSON.parse(tourDoc.description);
            }
        } catch (parseError) {
            console.error('Error parsing tour data:', parseError);
            tourData.description = tourDoc.description || '';
        }
        return {
            id: tourDoc.$id,
            name: tourData.name || '',
            cityId: tourData.cityId || '',
            language: tourData.language || '',
            description: tourData.description || '',
            imageUrl: tourDoc.imageUrl || ''
        };
    }
</script>

<div class="container mx-auto px-4 py-8">
    {#if isLoading}
        <div class="flex justify-center items-center h-64">
            <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
    {:else if error}
        <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert">
            <p>{error}</p>
        </div>
    {:else if tour}
        {@const tourData = getTourData(tour)}
        <div class="bg-white rounded-lg shadow-md p-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <img src={tourData.imageUrl} alt={tourData.name} class="w-full h-96 object-cover rounded-lg" />
                </div>
                <div>
                    <h1 class="text-3xl font-bold mb-2">{tourData.name}</h1>
                    
                    {#if citiesStore}
                        {#each $citiesStore as city}
                            {#if city.id === tourData.cityId}
                                <p class="text-gray-600 mb-4">{city.name}, {city.country}</p>
                            {/if}
                        {/each}
                    {/if}
                    
                    <p class="text-gray-600 mb-4">Language: {tourData.language}</p>
                    <div class="flex items-center mb-4">
                        <span class="text-gray-600 mr-2">Average Rating:</span>
                        <span class="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded">{AppwriteService.getAverageRating(tour).toFixed(1)}</span>
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
                    <p class="text-gray-700">{tourData.description}</p>
                    
                    <div class="mt-6">
                        <h3 class="text-lg font-semibold mb-2">Notify Me When Scheduled</h3>
                        <p class="text-gray-600 mb-3">Enter your email to be notified when this tour is scheduled:</p>
                        <div class="flex flex-col gap-3 max-w-md">
                            <input 
                                type="email" 
                                bind:value={notificationEmail}
                                placeholder="Enter your email" 
                                class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button 
                                on:click={handleNotifyMe}
                                class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded w-auto"
                            >
                                Notify Me
                            </button>
                        </div>
                        {#if notificationMessage}
                            <p class="mt-2 text-sm {notificationMessage.includes('Thank you') ? 'text-green-600' : 'text-red-600'}">{notificationMessage}</p>
                        {/if}
                    </div>
                </div>
            </div>
        </div>
    {/if}
</div>
