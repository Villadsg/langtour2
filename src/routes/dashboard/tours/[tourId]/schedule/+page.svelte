<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { SupabaseService, currentUser } from '$lib/supabaseService';
  import { page } from '$app/stores';

  import DateTimePicker from '$lib/components/DateTimePicker.svelte';
  import BasicMapPicker from '$lib/components/BasicMapPicker.svelte';
  
  // Get tourId from the page params instead of window.location
  $: tourId = $page.params.tourId || '';
  
  let isLoading = true;
  let isSubmitting = false;
  let error = '';
  let success = '';
  let tour: any = null;
  let scheduledTours: any[] = [];
  
  // Form data
  let selectedDate = new Date();
  let scheduledDate = '';
  let selectedTime = '';
  let scheduledTime = '';
  
  // Update scheduledDate and scheduledTime when selectedDate or selectedTime changes
  $: if (selectedDate) {
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    scheduledDate = `${year}-${month}-${day}`;
  }
  
  $: scheduledTime = selectedTime;
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
    if (!selectedDate || !selectedTime || !meetingPoint) {
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
      selectedDate = new Date();
      selectedTime = '';
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
  
  // Function to get tour data from JSON in description
  function getTourData(tourDoc: any) {
    console.log('Tour document:', tourDoc);
    
    if (!tourDoc) return { name: '', description: '' };
    
    // Handle the nested data structure from Supabase
    if (tourDoc.data) {
      console.log('Tour data from nested structure:', tourDoc.data);
      
      // If data contains description as an object with name
      if (tourDoc.data.description && tourDoc.data.description.name) {
        console.log('Found name in data.description:', tourDoc.data.description.name);
        return tourDoc.data.description;
      }
      
      // If data has name directly
      if (tourDoc.data.name) {
        return {
          name: tourDoc.data.name,
          description: tourDoc.data.description || '',
          city: tourDoc.data.city || '',
          languages: tourDoc.data.languages || []
        };
      }
    }
    
    // Try to parse description if it exists
    try {
      // Check if description exists in the main object
      if (tourDoc.description) {
        console.log('Tour description from main object:', tourDoc.description);
        if (typeof tourDoc.description === 'string') {
          const parsedData = JSON.parse(tourDoc.description);
          console.log('Parsed tour data from main object:', parsedData);
          return parsedData;
        } else {
          // If it's already an object, return it directly
          return tourDoc.description;
        }
      }
      
      // Check if description exists in the nested data object
      if (tourDoc.data && tourDoc.data.description) {
        console.log('Tour description from nested data:', tourDoc.data.description);
        if (typeof tourDoc.data.description === 'string') {
          const parsedData = JSON.parse(tourDoc.data.description);
          console.log('Parsed tour data from nested data:', parsedData);
          return parsedData;
        } else {
          // If it's already an object, return it directly
          return tourDoc.data.description;
        }
      }
    } catch (error) {
      console.error('Error parsing tour data:', error);
    }
    
    // Fallback to title or empty string
    return { 
      name: (tourDoc.data && tourDoc.data.title) || tourDoc.title || 'Unnamed Tour', 
      description: '' 
    };
  }
</script>



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
    
    <h1 class="text-3xl font-bold mb-6">Schedule: {tourData.name}</h1>
    
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
            <DateTimePicker 
              bind:selectedDate
              bind:selectedTime
              label="When will this tour take place?"
              required={true}
              minDate={new Date()}
            />
            
            <div class="bg-white p-5 rounded-lg border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all duration-200">
              <h3 class="text-lg font-medium text-gray-800 mb-3 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Tour Capacity
              </h3>
              <div>
                <label for="maxParticipants" class="block text-sm font-medium text-gray-700 mb-1">Maximum Participants *</label>
                <div class="relative">
                  <input
                    type="number"
                    id="maxParticipants"
                    bind:value={maxParticipants}
                    min="1"
                    max="100"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                  <div class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-500">
                    <span class="text-sm">people</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="bg-white p-5 rounded-lg border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all duration-200">
              <h3 class="text-lg font-medium text-gray-800 mb-3 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Meeting Location
              </h3>
              <div>
                <label for="meetingPoint" class="block text-sm font-medium text-gray-700 mb-1">Meeting Point *</label>
                <!-- Google Maps integration for meeting point selection - using BasicMapPicker with hardcoded API key -->
                <BasicMapPicker 
                  bind:value={meetingPoint}
                  required={true}
                />
                <p class="mt-1 text-sm text-gray-500">Select a location on the map or search for an address</p>
              </div>
            </div>
            
            <div class="bg-white p-5 rounded-lg border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all duration-200">
              <h3 class="text-lg font-medium text-gray-800 mb-3 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Additional Details
              </h3>
              <div>
                <label for="additionalInfo" class="block text-sm font-medium text-gray-700 mb-1">Additional Information</label>
                <textarea
                  id="additionalInfo"
                  bind:value={additionalInfo}
                  rows="3"
                  placeholder="Any additional details participants should know (what to bring, accessibility information, etc.)"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                ></textarea>
              </div>
            </div>
            
            <div class="pt-2">
              <button
                type="submit"
                class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-all duration-200 flex items-center justify-center"
                disabled={isSubmitting}
              >
                {#if isSubmitting}
                  <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Scheduling...
                {:else}
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Schedule Tour
                {/if}
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
                      <p class="font-medium">{formatDate(schedule.scheduled_date)}</p>
                      <p class="text-sm text-gray-600 mt-1">Meeting points: {schedule.meeting_point}</p>
                      <p class="text-sm text-gray-600">Max participants: {schedule.max_participants}</p>
                      {#if schedule.additional_info}
                        <p class="text-sm text-gray-600 mt-2">{schedule.additional_info}</p>
                      {/if}
                    </div>
                    <div>
                      <a 
                        href={`/dashboard/schedules/${schedule.id}/manage`}
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
