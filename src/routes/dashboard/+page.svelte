<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { ConvexService, currentUser, userCreatedTours } from '$lib/firebaseService';

  
  let isLoading = true;
  let error = '';
  let upcomingScheduledTours: any[] = [];
  
  // State for tour deletion
  let isDeleting = false;
  let deleteError = '';
  let deleteSuccess = '';
  
  onMount(async () => {
    try {
      // Check if user is logged in
      const user = await ConvexService.getAccount();
      
      if (!user) {
        // Redirect to login page if not logged in
        goto('/login');
        return;
      }
      
      // Fetch upcoming scheduled tours
      const scheduledToursResponse = await ConvexService.getUpcomingScheduledTours();
      upcomingScheduledTours = scheduledToursResponse.documents || scheduledToursResponse;
      
      isLoading = false;
    } catch (err: any) {
      error = err.message || 'Failed to load dashboard data';
      isLoading = false;
    }
  });
  
  // Function to format date with error handling
  function formatDate(dateString: string | null) {
    if (!dateString) return 'No date';
    
    try {
      const date = new Date(dateString);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.error('Invalid date string:', dateString);
        return 'Invalid date';
      }
      
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Date error';
    }
  }
  
  // State for cancellation
  let isCancelling = false;
  let cancelError = '';
  let successMessage = '';
  
  // Function to handle schedule cancellation
  // Function to get tour data from JSON in description
  function getTourData(tourDoc: any) {
    if (!tourDoc) return { name: 'Tour not found', description: '' };
    
    // First check if the tour has a direct name property
    if (tourDoc.name) {
      return {
        name: tourDoc.name,
        description: tourDoc.description || '',
        language: tourDoc.language || '',
        cityId: tourDoc.cityId || ''
      };
    }
    
    try {
      if (tourDoc.description) {
        if (typeof tourDoc.description === 'string') {
          try {
            // Try to parse as JSON
            const parsedData = JSON.parse(tourDoc.description);
            return {
              name: parsedData.name || 'Unnamed Tour',
              description: parsedData.description || '',
              language: parsedData.language || '',
              cityId: parsedData.cityId || ''
            };
          } catch (parseError) {
            // If not valid JSON, use the description as is
            console.log('Description is not valid JSON, using as plain text');
            return {
              name: tourDoc.description.split('\n')[0] || 'Unnamed Tour',
              description: tourDoc.description
            };
          }
        } else if (typeof tourDoc.description === 'object') {
          // If it's already an object, return it with defaults
          return {
            name: tourDoc.description.name || 'Unnamed Tour',
            description: tourDoc.description.description || '',
            language: tourDoc.description.language || '',
            cityId: tourDoc.description.cityId || ''
          };
        }
      }
    } catch (error) {
      console.error('Error processing tour data:', error);
    }
    
    // Fallback with sensible defaults
    return { 
      name: 'Unnamed Tour', 
      description: 'No description available' 
    };
  }
  
  async function handleCancelSchedule(scheduleId: string, tourName: string) {
    if (!confirm(`Are you sure you want to cancel the scheduled tour: ${tourName || 'Unknown Tour'}?`)) {
      return; // User cancelled the operation
    }
    
    isCancelling = true;
    cancelError = '';
    successMessage = '';
    
    try {
      const result = await ConvexService.cancelSchedule(scheduleId);
      
      if (result.error) {
        cancelError = `Failed to cancel schedule: ${result.error?.message || 'Unknown error'}`;
        console.error('Error cancelling schedule:', result.error);
      } else {
        successMessage = `Successfully cancelled the scheduled tour: ${tourName || 'Unknown Tour'}`;
        
        // Remove the cancelled schedule from the list
        upcomingScheduledTours = upcomingScheduledTours.filter(s => s.id !== scheduleId);
      }
    } catch (err: any) {
      cancelError = `An unexpected error occurred: ${err?.message || 'Unknown error'}`;
      console.error('Exception in handleCancelSchedule:', err);
    } finally {
      isCancelling = false;
    }
  }
  
  // Function to handle tour deletion
  async function handleDeleteTour(tourId: string, tourName: string) {
    if (!confirm(`Are you sure you want to delete the tour "${tourName}"? This action cannot be undone.`)) {
      return; // User cancelled the operation
    }
    
    isDeleting = true;
    deleteError = '';
    deleteSuccess = '';
    
    try {
      // Call the API to delete the tour
      await ConvexService.deleteTour(tourId);
      
      // Update the list of tours
      userCreatedTours.update(tours => tours.filter(tour => (tour.id || tour.$id) !== tourId));
      
      deleteSuccess = `Successfully deleted tour: ${tourName}`;
    } catch (err: any) {
      deleteError = `Failed to delete tour: ${err?.message || 'Unknown error'}`;
      console.error('Error deleting tour:', err);
    } finally {
      isDeleting = false;
    }
  }
  

</script>



<div class="container mx-auto px-4 py-8">
  <h1 class="text-3xl font-bold text-slate-800 mb-6">Your Dashboard</h1>
  
  {#if error}
    <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert">
      <p>{error}</p>
    </div>
  {/if}
  
  {#if isLoading}
    <div class="flex justify-center items-center h-64">
      <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-400"></div>
    </div>
  {:else}
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-2xl font-bold text-slate-800">Created Tours</h2>
      <a href="/dashboard/create" class="bg-green-100 hover:bg-green-200 text-green-700 border border-green-200 font-medium py-2.5 px-5 rounded-lg transition-colors">
        Create New Tour
      </a>
    </div>
    
    {#if deleteError}
      <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert">
        <p>{deleteError}</p>
        <button class="absolute top-0 right-0 mt-2 mr-2" on:click={() => deleteError = ''}>
          <span class="text-red-500 hover:text-red-700">×</span>
        </button>
      </div>
    {/if}
    
    {#if deleteSuccess}
      <div class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4" role="alert">
        <p>{deleteSuccess}</p>
        <button class="absolute top-0 right-0 mt-2 mr-2" on:click={() => deleteSuccess = ''}>
          <span class="text-green-500 hover:text-green-700">×</span>
        </button>
      </div>
    {/if}
        
    {#if $userCreatedTours.length === 0}
      <div class="bg-slate-50 p-6 rounded-lg text-center border border-slate-200">
        <p class="text-slate-600">You haven't created any tours yet.</p>
      </div>
    {:else}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {#each $userCreatedTours as tour}
          {@const tourData = getTourData(tour)}
          <div class="bg-white rounded-lg border border-slate-200 overflow-hidden hover:shadow-sm transition-shadow">
            {#if tour.imageUrl}
              <img src={tour.imageUrl} alt={tourData.name} class="w-full h-48 object-cover" />
            {/if}
            <div class="p-4">
              <h3 class="text-lg font-semibold text-slate-800 mb-2">{tourData.name}</h3>
              <p class="text-slate-600 mb-4 line-clamp-2">{tourData.description}</p>
              <div class="flex space-x-4 justify-end mb-2">
                <a href={`/dashboard/edit/${tour.id || tour.$id}`} class="text-green-600 hover:text-green-700 font-medium transition-colors">
                  Edit Tour
                </a>
                <a href={`/dashboard/tours/${tour.id || tour.$id}/schedule`} class="text-orange-500 hover:text-orange-600 font-medium transition-colors">
                  Schedule Tour
                </a>
                <button
                  class="text-red-500 hover:text-red-600 cursor-pointer font-medium transition-colors {isDeleting ? 'opacity-50 cursor-not-allowed' : ''}"
                  on:click={() => handleDeleteTour(tour.id || tour.$id, tourData.name)}
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Delete Tour'}
                </button>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
        
    <div class="mt-8">
      <h3 class="text-lg font-semibold text-slate-800 mb-4">All created schedules</h3>
      
      {#if cancelError}
        <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert">
          <p>{cancelError}</p>
          <button class="absolute top-0 right-0 mt-2 mr-2" on:click={() => cancelError = ''}>
            <span class="text-red-500 hover:text-red-700">×</span>
          </button>
        </div>
      {/if}
      
      {#if successMessage}
        <div class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4" role="alert">
          <p>{successMessage}</p>
          <button class="absolute top-0 right-0 mt-2 mr-2" on:click={() => successMessage = ''}>
            <span class="text-green-500 hover:text-green-700">×</span>
          </button>
        </div>
      {/if}
      
      {#if upcomingScheduledTours.length === 0}
        <div class="bg-slate-50 p-4 rounded-lg border border-slate-200">
          <p class="text-slate-600">No upcoming scheduled tours.</p>
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="min-w-full bg-white rounded-lg overflow-hidden border border-slate-200">
            <thead class="bg-slate-50 text-slate-700">
              <tr>
                <th class="py-3 px-4 text-left">Tour</th>
                <th class="py-3 px-4 text-left">Date</th>
                <th class="py-3 px-4 text-left">Participants</th>
                <th class="py-3 px-4 text-left">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200">
              {#each upcomingScheduledTours as schedule}
                <tr class="hover:bg-slate-50">
                  <td class="py-3 px-4">
                    {#if schedule.tours}
                      {@const tourData = getTourData(schedule.tours)}
                      <span class="text-slate-700">{tourData.name}</span>
                    {:else}
                      <span class="text-slate-400">Unknown Tour</span>
                    {/if}
                  </td>
                  <td class="py-3 px-4">{formatDate(schedule.scheduled_date)}</td>
                  <td class="py-3 px-4">0 / {schedule.max_participants}</td>
                  <td class="py-3 px-4">
                    <a
                      href={`/dashboard/schedules/${schedule.id}/manage`}
                      class="text-green-600 hover:text-green-700 font-medium transition-colors mr-3"
                    >
                      Manage
                    </a>
                    <button
                      class="text-red-500 hover:text-red-600 font-medium transition-colors {isCancelling ? 'opacity-50 cursor-not-allowed' : ''}"
                      on:click={() => handleCancelSchedule(schedule.id, schedule.tours ? getTourData(schedule.tours).name : 'Unknown Tour')}
                      disabled={isCancelling}
                    >
                      {isCancelling ? 'Cancelling...' : 'Cancel'}
                    </button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  {/if}
</div>
