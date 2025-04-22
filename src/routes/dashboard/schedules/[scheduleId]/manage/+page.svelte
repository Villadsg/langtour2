<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { AppwriteService, currentUser } from '$lib/appwriteService';
  import NavBar from '$lib/components/NavBar.svelte';
  
  const scheduleId = window.location.pathname.split('/')[3] || '';
  
  let isLoading = true;
  let error = '';
  let success = '';
  let schedule: any = null;
  let tour: any = null;
  let bookings: any[] = [];
  
  onMount(async () => {
    try {
      // Check if user is logged in
      const user = await AppwriteService.getAccount();
      
      if (!user) {
        // Redirect to login page if not logged in
        goto('/login');
        return;
      }
      
      // Fetch schedule details
      const scheduleResponse = await AppwriteService.getDocument(
        AppwriteService.schedulesCollectionId,
        scheduleId
      );
      schedule = scheduleResponse;
      
      // Fetch tour details
      const tourResponse = await AppwriteService.getTour(schedule.tourId);
      tour = tourResponse;
      
      // Fetch bookings for this schedule
      const bookingsResponse = await AppwriteService.getBookingsForSchedule(scheduleId);
      bookings = bookingsResponse.documents;
      
      isLoading = false;
    } catch (err: any) {
      error = err.message || 'Failed to load schedule data';
      isLoading = false;
    }
  });
  
  async function markAsAttended(bookingId: string) {
    try {
      error = '';
      success = '';
      
      // Mark booking as attended
      await AppwriteService.markAsAttended(bookingId);
      
      // Refresh bookings
      const bookingsResponse = await AppwriteService.getBookingsForSchedule(scheduleId);
      bookings = bookingsResponse.documents;
      
      success = 'Participant marked as attended successfully!';
    } catch (err: any) {
      error = err.message || 'Failed to mark participant as attended';
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
      if (tourDoc.description && typeof tourDoc.description === 'string') {
        return JSON.parse(tourDoc.description);
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
      <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  {:else if schedule && tour}
    {@const tourData = getTourData(tour)}
    
    <div class="bg-white rounded-lg shadow-md p-6 mb-6">
      <h1 class="text-2xl font-bold mb-4">Manage Tour: {tourData.name}</h1>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h2 class="text-lg font-semibold mb-2">Schedule Details</h2>
          <p><span class="font-medium">Date:</span> {formatDate(schedule.scheduledDate)}</p>
          <p><span class="font-medium">Meeting Point:</span> {schedule.meetingPoint}</p>
          <p><span class="font-medium">Max Participants:</span> {schedule.maxParticipants}</p>
          {#if schedule.additionalInfo}
            <p class="mt-2"><span class="font-medium">Additional Info:</span> {schedule.additionalInfo}</p>
          {/if}
        </div>
        
        <div>
          <h2 class="text-lg font-semibold mb-2">Tour Details</h2>
          <p><span class="font-medium">Language:</span> {tourData.language}</p>
          <p class="mt-2"><span class="font-medium">Description:</span></p>
          <p class="text-gray-700">{tourData.description}</p>
        </div>
      </div>
    </div>
    
    <div class="bg-white rounded-lg shadow-md p-6">
      <h2 class="text-xl font-semibold mb-4">Participants ({bookings.length} / {schedule.maxParticipants})</h2>
      
      {#if bookings.length === 0}
        <div class="bg-gray-100 p-4 rounded-lg text-center">
          <p class="text-gray-600">No bookings for this tour yet.</p>
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="min-w-full bg-white rounded-lg overflow-hidden">
            <thead class="bg-gray-100 text-gray-700">
              <tr>
                <th class="py-3 px-4 text-left">Name</th>
                <th class="py-3 px-4 text-left">Email</th>
                <th class="py-3 px-4 text-left">Booked At</th>
                <th class="py-3 px-4 text-left">Status</th>
                <th class="py-3 px-4 text-left">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              {#each bookings as booking}
                <tr class="hover:bg-gray-50">
                  <td class="py-3 px-4">{booking.name}</td>
                  <td class="py-3 px-4">{booking.email}</td>
                  <td class="py-3 px-4">{formatDate(booking.bookedAt)}</td>
                  <td class="py-3 px-4">
                    <span class={`px-2 py-1 rounded-full text-xs font-medium
                      ${booking.status === 'confirmed' ? 'bg-green-100 text-green-800' : 
                        booking.status === 'cancelled' ? 'bg-red-100 text-red-800' : 
                        booking.status === 'attended' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                      {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                    </span>
                  </td>
                  <td class="py-3 px-4">
                    {#if booking.status === 'confirmed'}
                      <button 
                        class="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-1 px-2 rounded"
                        on:click={() => markAsAttended(booking.$id)}
                      >
                        Mark as Attended
                      </button>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  {:else}
    <div class="bg-red-100 p-8 rounded-lg text-center">
      <p class="text-red-600">Schedule not found. Please return to the dashboard.</p>
      <a href="/dashboard" class="inline-block mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
        Back to Dashboard
      </a>
    </div>
  {/if}
</div>
