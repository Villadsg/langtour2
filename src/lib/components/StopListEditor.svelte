<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { TourStop } from '$lib/firebase/types';

  export let stops: TourStop[] = [];

  const dispatch = createEventDispatcher();

  // Place type options
  const placeTypes = [
    { value: '', label: 'Select type...' },
    { value: 'cafe', label: 'Cafe' },
    { value: 'restaurant', label: 'Restaurant' },
    { value: 'museum', label: 'Museum' },
    { value: 'market', label: 'Market' },
    { value: 'landmark', label: 'Landmark' },
    { value: 'park', label: 'Park' },
    { value: 'shop', label: 'Shop' },
    { value: 'neighborhood', label: 'Neighborhood' },
    { value: 'station', label: 'Station' },
    { value: 'square', label: 'Square' },
    { value: 'other', label: 'Other' }
  ];

  // Get sorted stops by order
  $: sortedStops = [...stops].sort((a, b) => a.order - b.order);

  // Move stop up in order
  function moveUp(index: number) {
    if (index <= 0) return;

    const newStops = [...sortedStops];
    // Swap orders
    const temp = newStops[index - 1].order;
    newStops[index - 1] = { ...newStops[index - 1], order: newStops[index].order };
    newStops[index] = { ...newStops[index], order: temp };

    dispatch('reorder', newStops);
  }

  // Move stop down in order
  function moveDown(index: number) {
    if (index >= sortedStops.length - 1) return;

    const newStops = [...sortedStops];
    // Swap orders
    const temp = newStops[index + 1].order;
    newStops[index + 1] = { ...newStops[index + 1], order: newStops[index].order };
    newStops[index] = { ...newStops[index], order: temp };

    dispatch('reorder', newStops);
  }

  // Delete stop
  function deleteStop(stopId: string) {
    dispatch('delete', stopId);
  }

  // Update stop's place name
  function updatePlaceName(stopId: string, placeName: string) {
    dispatch('update', { stopId, updates: { placeName } });
  }

  // Update stop's place type
  function updatePlaceType(stopId: string, placeType: string) {
    dispatch('update', { stopId, updates: { placeType } });
  }

  // Check if stop has generated content
  function hasGeneratedContent(stop: TourStop): boolean {
    return !!stop.teachingMaterial && (
      stop.teachingMaterial.vocabulary.length > 0 ||
      stop.teachingMaterial.dialogues.length > 0
    );
  }

  // Regenerate content for a stop
  function regenerateContent(stopId: string) {
    dispatch('regenerate', stopId);
  }

  // View/edit content for a stop
  function viewContent(stopId: string) {
    dispatch('viewContent', stopId);
  }
</script>

<div class="stop-list-editor">
  {#if sortedStops.length === 0}
    <div class="text-center py-8 text-gray-500 border border-dashed border-gray-300 rounded-lg">
      <p>No stops added yet.</p>
      <p class="text-sm mt-1">Click on the map or search to add stops to your tour.</p>
    </div>
  {:else}
    <div class="space-y-3">
      {#each sortedStops as stop, index (stop.id)}
        <div class="stop-item bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
          <div class="flex items-start gap-3">
            <!-- Stop number -->
            <div class="flex-shrink-0 w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
              {index + 1}
            </div>

            <!-- Stop details -->
            <div class="flex-grow min-w-0">
              <!-- Place name input -->
              <div class="mb-2">
                <input
                  type="text"
                  value={stop.location.placeName || ''}
                  on:input={(e) => updatePlaceName(stop.id, e.currentTarget.value)}
                  placeholder="Stop name"
                  class="w-full px-3 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
                />
              </div>

              <!-- Address (read-only) -->
              <div class="text-xs text-gray-500 mb-2 truncate" title={stop.location.address}>
                {stop.location.address || 'No address'}
              </div>

              <!-- Place type and status row -->
              <div class="flex items-center gap-2 flex-wrap">
                <select
                  value={stop.location.placeType || ''}
                  on:change={(e) => updatePlaceType(stop.id, e.currentTarget.value)}
                  class="text-xs px-2 py-1 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-green-400"
                >
                  {#each placeTypes as type}
                    <option value={type.value}>{type.label}</option>
                  {/each}
                </select>

                <!-- Generation status -->
                {#if hasGeneratedContent(stop)}
                  <span class="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                    <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                    </svg>
                    Content ready
                  </span>
                  <button
                    type="button"
                    on:click={() => viewContent(stop.id)}
                    class="text-xs text-green-600 hover:text-green-700 underline"
                  >
                    View
                  </button>
                {:else}
                  <span class="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
                    No content
                  </span>
                {/if}
              </div>
            </div>

            <!-- Action buttons -->
            <div class="flex-shrink-0 flex flex-col gap-1">
              <button
                type="button"
                on:click={() => moveUp(index)}
                disabled={index === 0}
                class="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                title="Move up"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                </svg>
              </button>
              <button
                type="button"
                on:click={() => moveDown(index)}
                disabled={index === sortedStops.length - 1}
                class="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                title="Move down"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <button
                type="button"
                on:click={() => deleteStop(stop.id)}
                class="p-1 text-red-400 hover:text-red-600"
                title="Delete stop"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
