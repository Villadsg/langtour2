<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { ConvexService, currentUser } from '$lib/firebaseService';

  
  // Get the schedule ID from the URL and ensure it's valid
  let scheduleId = window.location.pathname.split('/')[3] || '';
  if (scheduleId === 'undefined' || !scheduleId) {
    console.error('Invalid schedule ID in URL path');
    scheduleId = '';  // Set to empty string to prevent further errors
  }
  
  let isLoading = true;
  let error = '';
  let success = '';
  let schedule: any = null;
  let tour: any = null;
  let bookings: any[] = [];
  
  onMount(async () => {
    try {
      // Check if user is logged in
      const user = await ConvexService.getAccount();
      
      if (!user) {
        // Redirect to login page if not logged in
        goto('/login');
        return;
      }
      
      // Fetch schedule details using our new function specifically for getting a schedule by ID
      const scheduleResponse = await ConvexService.getScheduleById(scheduleId);
      console.log('Schedule response:', scheduleResponse);
      
      if (!scheduleResponse || scheduleResponse.error) {
        console.error('Error fetching schedule:', scheduleResponse?.error);
        throw new Error('Schedule not found or error fetching schedule');
      }
      
      // Get the schedule data directly
      schedule = scheduleResponse.data;
      
      if (!schedule || !schedule.tour_id) {
        throw new Error('Invalid schedule data or missing tour ID');
      }
      
      // Fetch tour data
      const tourResponse = await ConvexService.getTour(schedule.tour_id);
      if (!tourResponse || tourResponse.error) {
        throw new Error('Tour not found or error fetching tour');
      }
      tour = tourResponse.data;
      
      // Fetch bookings for this schedule
      const bookingsResponse = await ConvexService.getBookingsForSchedule(scheduleId);
      bookings = bookingsResponse.data || [];
      
      isLoading = false;
    } catch (err: any) {
      error = err.message || 'Failed to load schedule data';
      isLoading = false;
    }
  });
  
  async function markAsAttended(bookingId: string, userName: string) {
    try {
      error = '';
      success = '';

      // Mark booking as attended using ConvexService
      await ConvexService.markAsAttended(bookingId);

      // Refresh bookings
      const bookingsResponse = await ConvexService.getBookingsForSchedule(scheduleId);
      bookings = bookingsResponse.data || [];

      // Display success message
      success = `${userName} has been marked as attended and can now rate this tour! An email notification has been sent with rating instructions.`;
    } catch (err: any) {
      error = err?.message || 'Failed to mark participant as attended';
      console.error('Error marking participant as attended:', err);
    }
  }
  
  // Function to format date
  function formatDate(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
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
</script>



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
  {:else if schedule && tour}
    {@const tourData = getTourData(tour)}
    
    <div class="bg-white rounded-lg border border-slate-200 p-6 mb-6">
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
          <p class="text-slate-700">{tourData.description}</p>
        </div>
      </div>
    </div>
    
    <div class="bg-white rounded-lg border border-slate-200 p-6">
      <h2 class="text-xl font-semibold mb-4">Participants ({bookings.length} / {schedule.maxParticipants})</h2>
      
      {#if bookings.length === 0}
        <div class="bg-slate-50 p-4 border border-slate-200 rounded-lg text-center">
          <p class="text-slate-600">No bookings for this tour yet.</p>
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="min-w-full bg-white rounded-lg overflow-hidden">
            <thead class="bg-gray-100 text-slate-700">
              <tr>
                <th class="py-3 px-4 text-left">Name</th>
                <th class="py-3 px-4 text-left">Email</th>
                <th class="py-3 px-4 text-left">Booked At</th>
                <th class="py-3 px-4 text-left">Status</th>
                <th class="py-3 px-4 text-left">Attendance</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200">
              {#each bookings as booking}
                <tr class="hover:bg-slate-50">
                  <td class="py-3 px-4">{booking.name}</td>
                  <td class="py-3 px-4">{booking.email}</td>
                  <td class="py-3 px-4">{formatDate(booking.created_at)}</td>
                  <td class="py-3 px-4">
                    <span class={`px-2 py-1 rounded-full text-xs font-medium
                      ${booking.status === 'confirmed' ? 'bg-green-100 text-green-800' : 
                        booking.status === 'cancelled' ? 'bg-red-100 text-red-800' : 
                        booking.status === 'attended' ? 'bg-slate-100 text-slate-700' : 'bg-slate-100 text-slate-700'}`}>
                      {booking.status ? booking.status.charAt(0).toUpperCase() + booking.status.slice(1) : 'Pending'}
                    </span>
                  </td>
                  <td class="py-3 px-4">
                    {#if booking.attended || booking.status === 'attended'}
                      <span class="text-green-600 text-xs font-medium">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 inline mr-1" viewBox="0 0 20 20" fill="currentColor">
                          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                        </svg>
                        Attended
                      </span>
                    {:else}
                      <button 
                        class="bg-green-100 hover:bg-green-200 text-green-700 border border-green-200 text-xs font-bold py-1 px-2 rounded"
                        on:click={() => markAsAttended(booking.id, booking.name)}
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
      <a href="/dashboard" class="inline-block mt-4 bg-green-100 hover:bg-green-200 text-green-700 border border-green-200 font-bold py-2 px-4 rounded">
        Back to Dashboard
      </a>
    </div>
  {/if}
</div>
