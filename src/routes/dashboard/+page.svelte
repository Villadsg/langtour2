<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { ConvexService, currentUser, userCreatedTours } from '$lib/firebaseService';
  import { getTourData } from '$lib/tourValidation';

  
  let isLoading = true;
  let error = '';
  let upcomingScheduledTours: any[] = [];
  
  // Track which tour ID is currently being deleted
  let deletingTourId: string | null = null;
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
  
  // Track which schedule ID is currently being cancelled
  let cancellingScheduleId: string | null = null;
  let cancelError = '';
  let successMessage = '';
  
  // Function to handle schedule cancellation
  // getTourData is now imported from $lib/tourValidation
  
  async function handleCancelSchedule(scheduleId: string, tourName: string) {
    if (!confirm(`Are you sure you want to cancel the scheduled trail: ${tourName || 'Unknown Trail'}?`)) {
      return; // User cancelled the operation
    }
    
    cancellingScheduleId = scheduleId;
    cancelError = '';
    successMessage = '';
    
    try {
      const result = await ConvexService.cancelSchedule(scheduleId);
      
      if (result.error) {
        cancelError = `Failed to cancel schedule: ${result.error?.message || 'Unknown error'}`;
        console.error('Error cancelling schedule:', result.error);
      } else {
        successMessage = `Successfully cancelled the scheduled trail: ${tourName || 'Unknown Trail'}`;
        
        // Remove the cancelled schedule from the list
        upcomingScheduledTours = upcomingScheduledTours.filter(s => s.id !== scheduleId);
      }
    } catch (err: any) {
      cancelError = `An unexpected error occurred: ${err?.message || 'Unknown error'}`;
      console.error('Exception in handleCancelSchedule:', err);
    } finally {
      cancellingScheduleId = null;
    }
  }
  
  // Function to handle tour deletion
  async function handleDeleteTour(tourId: string, tourName: string) {
    if (!confirm(`Are you sure you want to delete the trail "${tourName}"? This action cannot be undone.`)) {
      return; // User cancelled the operation
    }
    
    deletingTourId = tourId;
    deleteError = '';
    deleteSuccess = '';
    
    try {
      // Call the API to delete the tour
      await ConvexService.deleteTour(tourId);
      
      // Update the list of tours
      userCreatedTours.update(tours => tours.filter(tour => (tour.id || tour.$id) !== tourId));
      
      deleteSuccess = `Successfully deleted trail: ${tourName}`;
    } catch (err: any) {
      deleteError = `Failed to delete trail: ${err?.message || 'Unknown error'}`;
      console.error('Error deleting tour:', err);
    } finally {
      deletingTourId = null;
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
      <h2 class="text-2xl font-bold text-slate-800">Created Trails</h2>
      <div class="flex gap-3">
        <a href="/dashboard/create" class="bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 px-5 rounded-lg transition-colors">
          Create New Trail
        </a>
        <a href="/dashboard/create-with-ai" class="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2.5 px-5 rounded-lg transition-colors">
          Create with AI Chat
        </a>
      </div>
    </div>
    
    {#if deleteError}
      <div class="relative flex items-center justify-between bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4" role="alert">
        <p>{deleteError}</p>
        <button class="ml-4 text-red-400 hover:text-red-600" on:click={() => deleteError = ''}>
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
    {/if}

    {#if deleteSuccess}
      <div class="relative flex items-center justify-between bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4" role="alert">
        <p>{deleteSuccess}</p>
        <button class="ml-4 text-green-400 hover:text-green-600" on:click={() => deleteSuccess = ''}>
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
    {/if}
        
    {#if $userCreatedTours.length === 0}
      <div class="bg-slate-50 p-6 rounded-lg text-center border border-slate-200">
        <p class="text-slate-600">You haven't created any trails yet.</p>
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
                  Edit Trail
                </a>
                <a href={`/dashboard/tours/${tour.id || tour.$id}/schedule`} class="text-orange-500 hover:text-orange-600 font-medium transition-colors">
                  Schedule Trail
                </a>
                <button
                  class="text-red-500 hover:text-red-600 cursor-pointer font-medium transition-colors {deletingTourId === (tour.id || tour.$id) ? 'opacity-50 cursor-not-allowed' : ''}"
                  on:click={() => handleDeleteTour(tour.id || tour.$id, tourData.name)}
                  disabled={deletingTourId !== null}
                >
                  {deletingTourId === (tour.id || tour.$id) ? 'Deleting...' : 'Delete Trail'}
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
        <div class="relative flex items-center justify-between bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4" role="alert">
          <p>{cancelError}</p>
          <button class="ml-4 text-red-400 hover:text-red-600" on:click={() => cancelError = ''}>
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      {/if}

      {#if successMessage}
        <div class="relative flex items-center justify-between bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4" role="alert">
          <p>{successMessage}</p>
          <button class="ml-4 text-green-400 hover:text-green-600" on:click={() => successMessage = ''}>
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      {/if}
      
      {#if upcomingScheduledTours.length === 0}
        <div class="bg-slate-50 p-4 rounded-lg border border-slate-200">
          <p class="text-slate-600">No upcoming scheduled trails.</p>
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="min-w-full bg-white rounded-lg overflow-hidden border border-slate-200">
            <thead class="bg-slate-50 text-slate-700">
              <tr>
                <th class="py-3 px-4 text-left">Trail</th>
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
                      <span class="text-slate-400">Unknown Trail</span>
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
                      class="text-red-500 hover:text-red-600 font-medium transition-colors {cancellingScheduleId === schedule.id ? 'opacity-50 cursor-not-allowed' : ''}"
                      on:click={() => handleCancelSchedule(schedule.id, schedule.tours ? getTourData(schedule.tours).name : 'Unknown Tour')}
                      disabled={cancellingScheduleId !== null}
                    >
                      {cancellingScheduleId === schedule.id ? 'Cancelling...' : 'Cancel'}
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
