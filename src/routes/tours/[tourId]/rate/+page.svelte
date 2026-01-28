<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { ConvexService, currentUser } from '$lib/firebaseService';
  import NavBar from '$lib/components/NavBar.svelte';
  
  const tourId = window.location.pathname.split('/')[2] || '';
  
  let isLoading = true;
  let isSubmitting = false;
  let error = '';
  let success = '';
  let tour: any = null;
  let canRate = false;
  let hasRated = false;
  let showCommentSection = false; // Comment section is closed by default
  
  // Rating form data
  let languageLearningRating = 0;
  let informativeRating = 0;
  let funRating = 0;
  let comment = '';
  
  onMount(async () => {
    try {
      // Check if user is logged in
      const user = await ConvexService.getAccount();
      
      if (!user) {
        // Redirect to login page if not logged in
        goto('/login');
        return;
      }
      
      // Fetch tour details
      const tourResponse = await ConvexService.getTour(tourId);
      tour = tourResponse;
      
      // Check if user has attended this tour
      canRate = await ConvexService.hasUserAttendedTour(user.id, tourId);
      
      // Check if user has already rated this tour
      hasRated = await ConvexService.hasUserRatedTour(user.id, tourId);
      
      if (!canRate) {
        error = 'You can only rate tours that you have attended.';
      } else if (hasRated) {
        success = 'You have already rated this tour. Thank you for your feedback!';
      }
      
      isLoading = false;
    } catch (err: any) {
      error = err.message || 'Failed to load tour data';
      isLoading = false;
    }
  });
  
  async function handleSubmit() {
    if (languageLearningRating === 0 || informativeRating === 0 || funRating === 0) {
      error = 'Please provide ratings for all categories';
      return;
    }
    
    try {
      isSubmitting = true;
      error = '';
      success = '';
      
      const user = $currentUser;
      if (!user) {
        error = 'You must be logged in to rate a tour';
        isSubmitting = false;
        return;
      }
      
      // Submit ratings
      await ConvexService.submitTourRatings(
        tourId,
        user.id,
        languageLearningRating,
        informativeRating,
        funRating,
        comment
      );
      
      hasRated = true;
      success = 'Thank you for rating this tour!';
    } catch (err: any) {
      error = err.message || 'Failed to submit ratings';
    } finally {
      isSubmitting = false;
    }
  }
  
  // Function to get tour data from JSON in description
  function getTourData(tourDoc: any) {
    if (!tourDoc) return { name: '', description: '' };
    
    try {
      if (tourDoc.description) {
        if (typeof tourDoc.description === 'string') {
          return JSON.parse(tourDoc.description);
        } else {
          // If it's already an object, return it directly
          return tourDoc.description;
        }
      }
    } catch (error) {
      console.error('Error parsing tour data:', error);
    }
    
    return { name: '', description: '' };
  }
</script>

<NavBar />

<div class="container mx-auto px-4 py-8">
  <div class="mb-8">
    <a href="/dashboard" class="text-green-600 hover:text-green-700 inline-flex items-center">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clip-rule="evenodd" />
      </svg>
      Back to Dashboard
    </a>
  </div>
  
  {#if error}
    <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert">
      <p>{error}</p>
    </div>
  {/if}
  
  {#if success}
    <div class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4" role="alert">
      <p>{success}</p>
    </div>
  {/if}
  
  {#if isLoading}
    <div class="flex justify-center items-center h-64">
      <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-400"></div>
    </div>
  {:else if tour}
    {@const tourData = getTourData(tour)}
    
    <div class="bg-white rounded-lg shadow-md p-6">
      <h1 class="text-2xl font-bold mb-4">Rate Tour: {tourData.name}</h1>
      
      {#if !canRate}
        <div class="bg-yellow-100 p-4 rounded-lg">
          <p class="text-yellow-800">You can only rate tours that you have attended.</p>
          <a href="/dashboard" class="inline-block mt-4 bg-green-100 hover:bg-green-200 text-green-700 border border-green-200 font-bold py-2 px-4 rounded">
            Back to Dashboard
          </a>
        </div>
      {:else if hasRated}
        <div class="bg-green-100 p-4 rounded-lg">
          <p class="text-green-800">You have already rated this tour. Thank you for your feedback!</p>
          <a href="/dashboard" class="inline-block mt-4 bg-green-100 hover:bg-green-200 text-green-700 border border-green-200 font-bold py-2 px-4 rounded">
            Back to Dashboard
          </a>
        </div>
      {:else}
        <form on:submit|preventDefault={handleSubmit} class="space-y-6">
          <div>
            <h2 class="text-lg font-semibold mb-3">How well did this tour help with language learning?</h2>
            <div class="flex items-center space-x-2">
              {#each Array(5) as _, i}
                <button 
                  type="button"
                  on:click={() => languageLearningRating = i + 1}
                  class={`w-10 h-10 rounded-full flex items-center justify-center ${languageLearningRating > i ? 'bg-green-200 text-green-700' : 'bg-slate-200 text-slate-600'}`}
                  aria-label={`Rate ${i + 1} star${i > 0 ? 's' : ''}`}
                >
                  {i + 1}
                </button>
              {/each}
              <span class="ml-2 text-gray-600">
                {#if languageLearningRating === 1}
                  Poor
                {:else if languageLearningRating === 2}
                  Fair
                {:else if languageLearningRating === 3}
                  Good
                {:else if languageLearningRating === 4}
                  Very Good
                {:else if languageLearningRating === 5}
                  Excellent
                {:else}
                  Select a rating
                {/if}
              </span>
            </div>
          </div>
          
          <div>
            <h2 class="text-lg font-semibold mb-3">How informative/interesting was the tour?</h2>
            <div class="flex items-center space-x-2">
              {#each Array(5) as _, i}
                <button 
                  type="button"
                  on:click={() => informativeRating = i + 1}
                  class={`w-10 h-10 rounded-full flex items-center justify-center ${informativeRating > i ? 'bg-green-200 text-green-700' : 'bg-slate-200 text-slate-600'}`}
                  aria-label={`Rate ${i + 1} star${i > 0 ? 's' : ''}`}
                >
                  {i + 1}
                </button>
              {/each}
              <span class="ml-2 text-gray-600">
                {#if informativeRating === 1}
                  Poor
                {:else if informativeRating === 2}
                  Fair
                {:else if informativeRating === 3}
                  Good
                {:else if informativeRating === 4}
                  Very Good
                {:else if informativeRating === 5}
                  Excellent
                {:else}
                  Select a rating
                {/if}
              </span>
            </div>
          </div>
          
          <div>
            <h2 class="text-lg font-semibold mb-3">How fun was the tour?</h2>
            <div class="flex items-center space-x-2">
              {#each Array(5) as _, i}
                <button 
                  type="button"
                  on:click={() => funRating = i + 1}
                  class={`w-10 h-10 rounded-full flex items-center justify-center ${funRating > i ? 'bg-green-200 text-green-700' : 'bg-slate-200 text-slate-600'}`}
                  aria-label={`Rate ${i + 1} star${i > 0 ? 's' : ''}`}
                >
                  {i + 1}
                </button>
              {/each}
              <span class="ml-2 text-gray-600">
                {#if funRating === 1}
                  Poor
                {:else if funRating === 2}
                  Fair
                {:else if funRating === 3}
                  Good
                {:else if funRating === 4}
                  Very Good
                {:else if funRating === 5}
                  Excellent
                {:else}
                  Select a rating
                {/if}
              </span>
            </div>
          </div>
          
          <div class="border rounded-md overflow-hidden">
            <button 
              type="button" 
              class="w-full flex justify-between items-center px-4 py-3 bg-gray-50 hover:bg-gray-100 focus:outline-none" 
              on:click={() => showCommentSection = !showCommentSection}
            >
              <span class="text-lg font-semibold">Additional Comments (Optional)</span>
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                class={`h-5 w-5 transition-transform duration-200 ${showCommentSection ? 'transform rotate-180' : ''}`} 
                viewBox="0 0 20 20" 
                fill="currentColor"
              >
                <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
              </svg>
            </button>
            
            {#if showCommentSection}
              <div class="p-4 border-t">
                <textarea
                  id="comment"
                  bind:value={comment}
                  rows="4"
                  placeholder="Share your experience with this tour..."
                  class="w-full px-3 py-2 border border-slate-200 rounded-md shadow-sm focus:outline-none focus:ring-green-400 focus:border-green-400"
                ></textarea>
              </div>
            {/if}
          </div>
          
          <div class="pt-2 flex justify-end">
            <button
              type="submit"
              class="bg-green-100 hover:bg-green-200 text-green-700 border border-green-200 font-medium py-2.5 px-6 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Ratings'}
            </button>
          </div>
        </form>
      {/if}
    </div>
  {:else}
    <div class="bg-red-100 p-8 rounded-lg text-center">
      <p class="text-red-600">Tour not found. Please return to the dashboard.</p>
      <a href="/dashboard" class="inline-block mt-4 bg-green-100 hover:bg-green-200 text-green-700 border border-green-200 font-bold py-2 px-4 rounded">
        Back to Dashboard
      </a>
    </div>
  {/if}
</div>
