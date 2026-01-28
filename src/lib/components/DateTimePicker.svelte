<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let selectedDate = new Date();
  export let selectedTime = '';
  export let label = 'Select Date and Time';
  export let required = false;
  export let minDate = new Date();

  const dispatch = createEventDispatcher();
  
  // Convert date to string format for the input
  $: dateString = selectedDate ? formatDateForInput(selectedDate) : '';
  
  // Format date for display
  $: formattedDate = selectedDate ? formatDateForDisplay(selectedDate) : '';
  
  // Helper function to format date for input
  function formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  // Helper function to format date for display
  function formatDateForDisplay(date: Date): string {
    const options: Intl.DateTimeFormatOptions = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
    return date.toLocaleDateString(undefined, options);
  }

  // Handle date change
  function handleDateChange(e: Event): void {
    const target = e.target as HTMLInputElement;
    const newDate = new Date(target.value);
    if (!isNaN(newDate.getTime())) {
      selectedDate = newDate;
      dispatch('dateChange', { date: selectedDate });
    }
  }

  // Handle time change
  function handleTimeChange(e: Event): void {
    const target = e.target as HTMLInputElement;
    selectedTime = target.value;
    dispatch('timeChange', { time: selectedTime });
  }

  // Combine date and time for full datetime value
  $: combinedDateTime = selectedDate && selectedTime 
    ? new Date(`${formatDateForInput(selectedDate)}T${selectedTime}`)
    : null;

  // When either date or time changes, dispatch the combined datetime
  $: if (selectedDate && selectedTime) {
    dispatch('change', { datetime: combinedDateTime });
  }
  
  // Calculate tomorrow's date for min date if none provided
  $: minDateString = formatDateForInput(minDate);
</script>

<div class="space-y-4">
  <div>
    <label class="block text-sm font-medium text-slate-700 mb-2">{label} {required ? '*' : ''}</label>
    
    <div class="date-picker-container bg-white rounded-lg shadow-sm border border-gray-200 p-5 transition-all duration-200">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="date-field">
          <label for="date-input" class="flex items-center text-sm font-medium text-slate-700 mb-1">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Date {required ? '*' : ''}
          </label>
          <div class="relative">
            <input
              id="date-input"
              type="date"
              class="w-full px-3 py-2 border border-slate-200 rounded-md shadow-sm focus:outline-none focus:ring-green-400 focus:border-green-400 bg-white"
              value={dateString}
              min={minDateString}
              on:change={handleDateChange}
              {required}
            />
          </div>
        </div>
        
        <div class="time-field">
          <label for="time-input" class="flex items-center text-sm font-medium text-slate-700 mb-1">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Time {required ? '*' : ''}
          </label>
          <div class="relative">
            <input
              id="time-input"
              type="time"
              class="w-full px-3 py-2 border border-slate-200 rounded-md shadow-sm focus:outline-none focus:ring-green-400 focus:border-green-400 bg-white"
              bind:value={selectedTime}
              on:change={handleTimeChange}
              {required}
            />
          </div>
        </div>
      </div>
      
      {#if selectedDate && selectedTime}
        <div class="mt-4 p-3 bg-blue-50 rounded-md border border-blue-100 animate-fadeIn">
          <p class="text-sm text-blue-800 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <span class="font-medium">Selected:</span> {formattedDate} at {selectedTime}
          </p>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .date-picker-container {
    transition: all 0.2s ease-in-out;
  }
  
  .date-picker-container:hover {
    box-shadow: 0 4px 10px -1px rgba(0, 0, 0, 0.1), 0 2px 6px -1px rgba(0, 0, 0, 0.06);
    border-color: #93c5fd;
  }
  
  input[type="date"], input[type="time"] {
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
  }
  
  /* Improve the appearance of date and time inputs */
  input[type="date"]::-webkit-calendar-picker-indicator,
  input[type="time"]::-webkit-calendar-picker-indicator {
    background-color: transparent;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
  }
  
  input[type="date"]::-webkit-calendar-picker-indicator:hover,
  input[type="time"]::-webkit-calendar-picker-indicator:hover {
    background-color: rgba(59, 130, 246, 0.1);
  }
  
  .date-field, .time-field {
    transition: transform 0.2s ease;
  }
  
  .date-field:hover, .time-field:hover {
    transform: translateY(-2px);
  }
  
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(5px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  .animate-fadeIn {
    animation: fadeIn 0.3s ease-in-out;
  }
</style>
