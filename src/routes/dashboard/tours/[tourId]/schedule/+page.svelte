<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { SupabaseService, currentUser } from '$lib/supabaseService';
  import NavBar from '$lib/components/NavBar.svelte';
  
  const tourId = window.location.pathname.split('/')[3] || '';
  
  let isLoading = true;
  let isSubmitting = false;
  let error = '';
  let success = '';
  let tour: any = null;
  let scheduledTours: any[] = [];
  
  // Form data
  let scheduledDate = '';
  let scheduledTime = '';
  let maxParticipants = 10;
  let meetingPoint = '';
  let additionalInfo = '';
  
  onMount(async () => {
    try {
      // Check if user is logged in
      const user = await SupabaseService.getAccount();
      
      if (!user) {
        // Redirect to login page if not logged in
        goto('/login');
        return;
      }
      
      // Fetch tour details
      const tourResponse = await SupabaseService.getTour(tourId);
      tour = tourResponse;
      
      // Fetch existing scheduled tours
      const scheduledToursResponse = await SupabaseService.getScheduledTours(tourId);
      scheduledTours = scheduledToursResponse.data || [];
      
      isLoading = false;
    } catch (err: any) {
      error = err.message || 'Failed to load tour data';
      isLoading = false;
    }
  });
  
  async function handleSubmit() {
    if (!scheduledDate || !scheduledTime || !meetingPoint) {
      error = 'Please fill in all required fields';
      return;
    }
    
    try {
      isSubmitting = true;
      error = '';
      success = '';
      
      // Combine date and time into a Date object
      const dateTime = new Date(`${scheduledDate}T${scheduledTime}`);
      
      // Schedule the tour
      await SupabaseService.scheduleTour(
        tourId,
        dateTime,
        maxParticipants,
        meetingPoint,
        additionalInfo
      );
      
      // Refresh the scheduled tours list
      const scheduledToursResponse = await SupabaseService.getScheduledTours(tourId);
      scheduledTours = scheduledToursResponse.data || [];
      
      // Reset form
      scheduledDate = '';
      scheduledTime = '';
      maxParticipants = 10;
      meetingPoint = '';
      additionalInfo = '';
      
      success = 'Tour scheduled successfully!';
    } catch (err: any) {
      error = err.message || 'Failed to schedule tour';
    } finally {
      isSubmitting = false;
    }
  }
  
  // Function to format date
  function formatDate(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
    <a href="/dashboard" class="text-blue-600 hover:underline inline-flex items-center">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clip-rule="evenodd" />
      </svg>
      Back to Dashboard
    </a>
  </div>
  
  {#if isLoading}
    <div class="flex justify-center items-center h-64">
      <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  {:else if tour}
    {@const tourData = getTourData(tour)}
    
    <h1 class="text-3xl font-bold mb-2">Schedule Tour: {tourData.name}</h1>
    
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
    
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-6">
      <div>
        <div class="bg-white rounded-lg shadow-md p-6">
          <h2 class="text-xl font-semibold mb-4">Schedule a New Tour Session</h2>
          
          <form on:submit|preventDefault={handleSubmit} class="space-y-4">
            <div>
              <label for="scheduledDate" class="block text-sm font-medium text-gray-700 mb-1">Date *</label>
              <input
                type="date"
                id="scheduledDate"
                bind:value={scheduledDate}
                class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            
            <div>
              <label for="scheduledTime" class="block text-sm font-medium text-gray-700 mb-1">Time *</label>
              <input
                type="time"
                id="scheduledTime"
                bind:value={scheduledTime}
                class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            
            <div>
              <label for="maxParticipants" class="block text-sm font-medium text-gray-700 mb-1">Maximum Participants *</label>
              <input
                type="number"
                id="maxParticipants"
                bind:value={maxParticipants}
                min="1"
                max="100"
                class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            
            <div>
              <label for="meetingPoint" class="block text-sm font-medium text-gray-700 mb-1">Meeting Point *</label>
              <input
                type="text"
                id="meetingPoint"
                bind:value={meetingPoint}
                placeholder="e.g., In front of City Hall"
                class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            
            <div>
              <label for="additionalInfo" class="block text-sm font-medium text-gray-700 mb-1">Additional Information</label>
              <textarea
                id="additionalInfo"
                bind:value={additionalInfo}
                rows="4"
                placeholder="Any additional details participants should know"
                class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              ></textarea>
            </div>
            
            <div class="pt-2">
              <button
                type="submit"
                class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Scheduling...' : 'Schedule Tour'}
              </button>
            </div>
          </form>
        </div>
      </div>
      
      <div>
        <div class="bg-white rounded-lg shadow-md p-6">
          <h2 class="text-xl font-semibold mb-4">Scheduled Sessions</h2>
          
          {#if scheduledTours.length === 0}
            <div class="bg-gray-100 p-4 rounded-lg text-center">
              <p class="text-gray-600">No scheduled sessions for this tour yet.</p>
            </div>
          {:else}
            <div class="space-y-4">
              {#each scheduledTours as schedule}
                <div class="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                  <div class="flex justify-between items-start">
                    <div>
                      <p class="font-medium">{formatDate(schedule.scheduledDate)}</p>
                      <p class="text-sm text-gray-600 mt-1">Meeting point: {schedule.meetingPoint}</p>
                      <p class="text-sm text-gray-600">Max participants: {schedule.maxParticipants}</p>
                      {#if schedule.additionalInfo}
                        <p class="text-sm text-gray-600 mt-2">{schedule.additionalInfo}</p>
                      {/if}
                    </div>
                    <div>
                      <a 
                        href={`/dashboard/schedules/${schedule.$id}/manage`}
                        class="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        Manage
                      </a>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    </div>
  {:else}
    <div class="bg-red-100 p-8 rounded-lg text-center">
      <p class="text-red-600">Tour not found. Please return to the dashboard.</p>
      <a href="/dashboard" class="inline-block mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
        Back to Dashboard
      </a>
    </div>
  {/if}
</div>
