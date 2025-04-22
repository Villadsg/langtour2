<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { AppwriteService, currentUser, userCreatedTours } from '$lib/appwriteService';
  import NavBar from '$lib/components/NavBar.svelte';
  
  let isLoading = true;
  let error = '';
  let userBookings: any[] = [];
  let upcomingScheduledTours: any[] = [];
  let activeTab = 'bookings'; // bookings, createdTours
  
  onMount(async () => {
    try {
      // Check if user is logged in
      const user = await AppwriteService.getAccount();
      
      if (!user) {
        // Redirect to login page if not logged in
        goto('/login');
        return;
      }
      
      // Fetch user bookings
      const bookingsResponse = await AppwriteService.getUserBookings(user.$id);
      userBookings = bookingsResponse.documents;
      
      // Fetch upcoming scheduled tours
      const scheduledToursResponse = await AppwriteService.getUpcomingScheduledTours();
      upcomingScheduledTours = scheduledToursResponse.documents;
      
      isLoading = false;
    } catch (err: any) {
      error = err.message || 'Failed to load dashboard data';
      isLoading = false;
    }
  });
  
  // Function to format date
  function formatDate(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
</script>

<NavBar />

<div class="container mx-auto px-4 py-8">
  <h1 class="text-3xl font-bold mb-6">Your Dashboard</h1>
  
  {#if error}
    <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert">
      <p>{error}</p>
    </div>
  {/if}
  
  {#if isLoading}
    <div class="flex justify-center items-center h-64">
      <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  {:else}
    <div class="mb-6">
      <div class="border-b border-gray-200">
        <nav class="-mb-px flex space-x-8">
          <button 
            class={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'bookings' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            on:click={() => activeTab = 'bookings'}
          >
            Your Bookings
          </button>
          <button 
            class={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'createdTours' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            on:click={() => activeTab = 'createdTours'}
          >
            Your Created Tours
          </button>
        </nav>
      </div>
    </div>
    
    {#if activeTab === 'bookings'}
      <div>
        <h2 class="text-xl font-semibold mb-4">Your Tour Bookings</h2>
        
        {#if userBookings.length === 0}
          <div class="bg-gray-100 p-6 rounded-lg text-center">
            <p class="text-gray-600">You haven't booked any tours yet.</p>
            <a href="/" class="inline-block mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
              Browse Tours
            </a>
          </div>
        {:else}
          <div class="overflow-x-auto">
            <table class="min-w-full bg-white rounded-lg overflow-hidden shadow-md">
              <thead class="bg-gray-100 text-gray-700">
                <tr>
                  <th class="py-3 px-4 text-left">Tour</th>
                  <th class="py-3 px-4 text-left">Date</th>
                  <th class="py-3 px-4 text-left">Status</th>
                  <th class="py-3 px-4 text-left">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                {#each userBookings as booking}
                  <tr class="hover:bg-gray-50">
                    <td class="py-3 px-4">
                      <!-- We need to fetch the tour name based on the schedule -->
                      <span>Loading...</span>
                    </td>
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
                          class="text-red-600 hover:text-red-800 mr-2"
                          on:click={() => {/* Cancel booking logic */}}
                        >
                          Cancel
                        </button>
                      {/if}
                      {#if booking.status === 'attended'}
                        <a 
                          href={`/tours/${booking.tourId}/rate`} 
                          class="text-blue-600 hover:text-blue-800"
                        >
                          Rate Tour
                        </a>
                      {/if}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>
    {:else if activeTab === 'createdTours'}
      <div>
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-semibold">Your Created Tours</h2>
          <a href="/admin/create" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
            Create New Tour
          </a>
        </div>
        
        {#if $userCreatedTours.length === 0}
          <div class="bg-gray-100 p-6 rounded-lg text-center">
            <p class="text-gray-600">You haven't created any tours yet.</p>
          </div>
        {:else}
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {#each $userCreatedTours as tour}
              {@const tourData = JSON.parse(tour.description)}
              <div class="bg-white rounded-lg shadow-md overflow-hidden">
                {#if tour.imageUrl}
                  <img src={tour.imageUrl} alt={tourData.name} class="w-full h-48 object-cover" />
                {/if}
                <div class="p-4">
                  <h3 class="text-lg font-semibold mb-2">{tourData.name}</h3>
                  <p class="text-gray-600 mb-4 line-clamp-2">{tourData.description}</p>
                  <div class="flex justify-between">
                    <a href={`/admin/edit/${tour.$id}`} class="text-blue-600 hover:text-blue-800">
                      Edit Tour
                    </a>
                    <a href={`/dashboard/tours/${tour.$id}/schedule`} class="text-green-600 hover:text-green-800">
                      Schedule Tour
                    </a>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
        
        <div class="mt-8">
          <h3 class="text-lg font-semibold mb-4">Scheduled Tours</h3>
          
          {#if upcomingScheduledTours.length === 0}
            <div class="bg-gray-100 p-4 rounded-lg">
              <p class="text-gray-600">No upcoming scheduled tours.</p>
            </div>
          {:else}
            <div class="overflow-x-auto">
              <table class="min-w-full bg-white rounded-lg overflow-hidden shadow-md">
                <thead class="bg-gray-100 text-gray-700">
                  <tr>
                    <th class="py-3 px-4 text-left">Tour</th>
                    <th class="py-3 px-4 text-left">Date</th>
                    <th class="py-3 px-4 text-left">Participants</th>
                    <th class="py-3 px-4 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                  {#each upcomingScheduledTours as schedule}
                    <tr class="hover:bg-gray-50">
                      <td class="py-3 px-4">
                        <!-- We need to fetch the tour name based on the tourId -->
                        <span>Loading...</span>
                      </td>
                      <td class="py-3 px-4">{formatDate(schedule.scheduledDate)}</td>
                      <td class="py-3 px-4">0 / {schedule.maxParticipants}</td>
                      <td class="py-3 px-4">
                        <a 
                          href={`/dashboard/schedules/${schedule.$id}/manage`} 
                          class="text-blue-600 hover:text-blue-800 mr-2"
                        >
                          Manage
                        </a>
                        <button 
                          class="text-red-600 hover:text-red-800"
                          on:click={() => {/* Cancel schedule logic */}}
                        >
                          Cancel
                        </button>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  {/if}
</div>
