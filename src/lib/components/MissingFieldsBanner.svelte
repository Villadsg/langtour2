<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { MissingField } from '$lib/firebase/types';
  import { getFieldLabel, groupMissingFields } from '$lib/tourValidation';

  export let missingFields: MissingField[] = [];
  export let stopNames: string[] = [];

  const dispatch = createEventDispatcher();

  $: grouped = groupMissingFields(missingFields);
  $: requiredFields = missingFields.filter(f => f.required);
  $: optionalFields = missingFields.filter(f => !f.required);

  function handleFieldClick(field: MissingField) {
    dispatch('fieldClick', field);
  }

  function getStopName(index: number): string {
    return stopNames[index] || `Stop ${index + 1}`;
  }
</script>

{#if missingFields.length > 0}
  <div class="space-y-3">
    <!-- Required fields banner -->
    {#if requiredFields.length > 0}
      <div class="bg-red-50 border border-red-200 rounded-lg p-4">
        <div class="flex items-start gap-3">
          <svg class="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div class="flex-1">
            <p class="text-sm font-medium text-red-800">
              {requiredFields.length} required field{requiredFields.length !== 1 ? 's' : ''} missing
            </p>
            <div class="mt-2 flex flex-wrap gap-2">
              {#each grouped.tour.filter(f => f.required) as field}
                <button
                  type="button"
                  on:click={() => handleFieldClick(field)}
                  class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                >
                  {getFieldLabel(field.field)}
                </button>
              {/each}

              {#each [...grouped.stops.entries()] as [stopIndex, stopFields]}
                {#each stopFields.filter(f => f.required) as field}
                  <button
                    type="button"
                    on:click={() => handleFieldClick(field)}
                    class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                  >
                    {getStopName(stopIndex)}: {getFieldLabel(field.field)}
                  </button>
                {/each}
              {/each}
            </div>
          </div>
        </div>
      </div>
    {/if}

    <!-- Optional fields banner -->
    {#if optionalFields.length > 0}
      <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div class="flex items-start gap-3">
          <svg class="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div class="flex-1">
            <p class="text-sm font-medium text-yellow-800">
              {optionalFields.length} optional field{optionalFields.length !== 1 ? 's' : ''} could be added
            </p>
            <div class="mt-2 flex flex-wrap gap-2">
              {#each grouped.tour.filter(f => !f.required) as field}
                <button
                  type="button"
                  on:click={() => handleFieldClick(field)}
                  class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 hover:bg-yellow-200 transition-colors"
                >
                  {getFieldLabel(field.field)}
                </button>
              {/each}

              {#each [...grouped.stops.entries()] as [stopIndex, stopFields]}
                {#each stopFields.filter(f => !f.required) as field}
                  <button
                    type="button"
                    on:click={() => handleFieldClick(field)}
                    class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 hover:bg-yellow-200 transition-colors"
                  >
                    {getStopName(stopIndex)}: {field.field === 'location' ? 'Confirm Location' : getFieldLabel(field.field)}
                  </button>
                {/each}
              {/each}
            </div>
          </div>
        </div>
      </div>
    {/if}
  </div>
{:else}
  <div class="bg-green-50 border border-green-200 rounded-lg p-4">
    <div class="flex items-center gap-3">
      <svg class="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p class="text-sm font-medium text-green-800">
        All fields are complete. Ready to create trail!
      </p>
    </div>
  </div>
{/if}
