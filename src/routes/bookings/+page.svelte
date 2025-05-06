<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { SupabaseService, currentUser } from '$lib/supabaseService';
  import NavBar from '$lib/components/NavBar.svelte';
  
  let isLoading = true;
  let error = '';
  let userBookings: any[] = [];
  
  onMount(async () => {
    try {
      // Check if user is logged in
      const user = await SupabaseService.getAccount();
      
      if (!user) {
        // Redirect to login page if not logged in
        goto('/login');
        return;
      }
      
      // Fetch user bookings
      const bookingsResponse = await SupabaseService.getUserBookings(user.id);
      userBookings = bookingsResponse.documents || bookingsResponse;
      
      isLoading = false;
    } catch (err: any) {
      error = err.message || 'Failed to load bookings data';
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
  
  // Function to handle booking cancellation
  async function handleCancelBooking(bookingId: string, tourName: string) {
    if (!confirm(`Are you sure you want to cancel your booking for ${tourName}?`)) {
      return; // User cancelled the operation
    }
    
    isCancelling = true;
    cancelError = '';
    successMessage = '';
    
    try {
      // Call the API to cancel the booking
      const result = await SupabaseService.cancelBooking(bookingId);
      
      if (result && result.error) {
        cancelError = `Failed to cancel booking: ${result.error?.message || 'Unknown error'}`;
        console.error('Error cancelling booking:', result.error);
      } else {
        successMessage = `Successfully cancelled your booking for ${tourName}`;
        
        // Update the booking status in the list
        userBookings = userBookings.map(booking => {
          if (booking.id === bookingId) {
            return { ...booking, status: 'cancelled' };
          }
          return booking;
        });
      }
    } catch (err: any) {
      cancelError = `An unexpected error occurred: ${err?.message || 'Unknown error'}`;
      console.error('Exception in handleCancelBooking:', err);
    } finally {
      isCancelling = false;
    }
  }
</script>

<NavBar />

<div class="container mx-auto px-4 py-8">
  <h1 class="text-3xl font-bold mb-6">Your Bookings</h1>
  
  {#if error}
    <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert">
      <p>{error}</p>
    </div>
  {/if}
  
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
  
  {#if isLoading}
    <div class="flex justify-center items-center h-64">
      <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  {:else}
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
                  {#if booking.schedules && booking.schedules.tours}
                    <a href="/tours/{booking.schedules.tours.id}" class="text-blue-600 hover:underline">
                      {booking.schedules.tours.description?.name || booking.schedules.tours.name || 'Unnamed Tour'}
                    </a>
                  {:else}
                    <span>Tour not found</span>
                  {/if}
                </td>
                <td class="py-3 px-4">{formatDate(booking.schedules?.scheduled_date)}</td>
                <td class="py-3 px-4">
                  <span class={`px-2 py-1 rounded-full text-xs font-medium
                    ${booking.status === 'confirmed' ? 'bg-green-100 text-green-800' : 
                      booking.status === 'cancelled' ? 'bg-red-100 text-red-800' : 
                      booking.status === 'attended' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                    {booking.status ? booking.status.charAt(0).toUpperCase() + booking.status.slice(1) : 'Pending'}
                  </span>
                </td>
                <td class="py-3 px-4">
                  {#if booking.status !== 'cancelled'}
                    <button 
                      class="text-red-600 hover:text-red-800 mr-2 {isCancelling ? 'opacity-50 cursor-not-allowed' : ''}"
                      on:click={() => handleCancelBooking(booking.id, booking.schedules?.tours?.description?.name || booking.schedules?.tours?.name || 'this tour')}
                      disabled={isCancelling}
                    >
                      {isCancelling ? 'Cancelling...' : booking.status === 'attended' ? 'Remove' : 'Cancel'}
                    </button>
                  {/if}
                  {#if booking.status === 'attended'}
                    <a 
                      href={`/tours/${booking.schedules?.tours?.id}/rate`} 
                      class="text-blue-600 hover:text-blue-800 ml-2"
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
  {/if}
</div>
