<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { TourStop, TourStopLocation } from '$lib/firebase/types';
    import MultiStopMapPicker from './MultiStopMapPicker.svelte';
    import StopLocationPicker from './StopLocationPicker.svelte';

    export let tour: {
        id: string;
        name: string;
        cityId: string;
        languageTaught: string;
        instructionLanguage: string;
        langDifficulty: string;
        description: string;
        imageUrl: string;
        tourType: string;
        price: number;
        stops: TourStop[];
    };

    const dispatch = createEventDispatcher();

    const languages = ['Danish', 'Spanish', 'English', 'French', 'German', 'Italian'];

    const cefrLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

    const tourTypes = [
        { value: 'person', label: 'Guided tour by a person' },
        { value: 'app', label: 'Guided tour by the app' }
    ];

    const placeTypes = ['cafe', 'restaurant', 'museum', 'market', 'landmark', 'park', 'shop', 'neighborhood', 'station', 'square', 'other'];

    // Local mutable copies
    let name = tour.name;
    let cityId = tour.cityId;
    let languageTaught = tour.languageTaught;
    let instructionLanguage = tour.instructionLanguage;
    let langDifficulty = tour.langDifficulty;
    let description = tour.description;
    let imageUrl = tour.imageUrl;
    let tourType = tour.tourType;
    let price = tour.price;
    let stops: TourStop[] = [...tour.stops];

    let isSubmitting = false;

    // Track which stop has its location picker open
    let adjustingStopId: string | null = null;

    let mapPicker: MultiStopMapPicker;

    function handleStopsChange(event: CustomEvent<TourStop[]>) {
        stops = event.detail;
    }

    function removeStop(stopId: string) {
        if (mapPicker) {
            mapPicker.removeStop(stopId);
        } else {
            stops = stops
                .filter(s => s.id !== stopId)
                .map((s, i) => ({ ...s, order: i }));
        }
        if (adjustingStopId === stopId) {
            adjustingStopId = null;
        }
    }

    function moveStop(stopId: string, direction: 'up' | 'down') {
        const sorted = [...stops].sort((a, b) => a.order - b.order);
        const idx = sorted.findIndex(s => s.id === stopId);
        if (idx < 0) return;
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= sorted.length) return;

        // Swap orders
        const tempOrder = sorted[idx].order;
        sorted[idx] = { ...sorted[idx], order: sorted[swapIdx].order };
        sorted[swapIdx] = { ...sorted[swapIdx], order: tempOrder };

        stops = sorted;
        if (mapPicker) {
            mapPicker.reorderStops(stops);
        }
    }

    function updateStopPlaceName(stopId: string, newName: string) {
        stops = stops.map(s =>
            s.id === stopId
                ? { ...s, location: { ...s.location, placeName: newName } }
                : s
        );
    }

    function updateStopPlaceType(stopId: string, newType: string) {
        stops = stops.map(s =>
            s.id === stopId
                ? { ...s, location: { ...s.location, placeType: newType } }
                : s
        );
    }

    function handleLocationAdjust(stopId: string, event: CustomEvent<TourStopLocation>) {
        const newLocation = event.detail;
        stops = stops.map(s =>
            s.id === stopId
                ? { ...s, location: { ...s.location, lat: newLocation.lat, lng: newLocation.lng, address: newLocation.address } }
                : s
        );
        if (mapPicker) {
            mapPicker.updateStopLocation(stopId, { lat: newLocation.lat, lng: newLocation.lng, address: newLocation.address });
        }
        adjustingStopId = null;
    }

    function handleSaveChanges() {
        isSubmitting = true;
        dispatch('submit', {
            name,
            cityId,
            languageTaught,
            instructionLanguage,
            langDifficulty,
            description,
            imageUrl,
            tourType,
            price,
            stops
        });
    }

    function handleCancel() {
        dispatch('cancel');
    }

    $: sortedStops = [...stops].sort((a, b) => a.order - b.order);
</script>

<div class="bg-white border border-slate-200 rounded-lg p-6">
    <!-- Tour Details -->
    <div class="mb-6 grid grid-cols-1 gap-4">
        <div>
            <label for="tour-name" class="block text-sm font-medium text-slate-700 mb-1">Trail Name</label>
            <input
                id="tour-name"
                type="text"
                bind:value={name}
                class="block w-full p-3 text-slate-700 border border-slate-200 bg-white focus:ring-2 focus:ring-green-400 rounded-lg"
            />
        </div>

        <div>
            <label for="tour-city" class="block text-sm font-medium text-slate-700 mb-1">City</label>
            <input
                id="tour-city"
                type="text"
                bind:value={cityId}
                placeholder="e.g., Copenhagen, Denmark"
                class="block w-full p-3 text-slate-700 border border-slate-200 bg-white focus:ring-2 focus:ring-green-400 rounded-lg"
            />
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
                <label for="tour-language-taught" class="block text-sm font-medium text-slate-700 mb-1">Language Taught</label>
                <select
                    id="tour-language-taught"
                    bind:value={languageTaught}
                    class="block w-full p-3 text-slate-700 border border-slate-200 bg-white focus:ring-2 focus:ring-green-400 rounded-lg"
                >
                    <option value="">Select language</option>
                    {#each languages as lang}
                        <option value={lang}>{lang}</option>
                    {/each}
                </select>
            </div>

            <div>
                <label for="tour-instruction-language" class="block text-sm font-medium text-slate-700 mb-1">Instruction Language</label>
                <select
                    id="tour-instruction-language"
                    bind:value={instructionLanguage}
                    class="block w-full p-3 text-slate-700 border border-slate-200 bg-white focus:ring-2 focus:ring-green-400 rounded-lg"
                >
                    <option value="">Select language</option>
                    {#each languages as lang}
                        <option value={lang}>{lang}</option>
                    {/each}
                </select>
            </div>

            <div>
                <label for="tour-lang-difficulty" class="block text-sm font-medium text-slate-700 mb-1">CEFR Level</label>
                <select
                    id="tour-lang-difficulty"
                    bind:value={langDifficulty}
                    class="block w-full p-3 text-slate-700 border border-slate-200 bg-white focus:ring-2 focus:ring-green-400 rounded-lg"
                >
                    <option value="">Select level</option>
                    {#each cefrLevels as level}
                        <option value={level}>{level}</option>
                    {/each}
                </select>
            </div>
        </div>

        <div>
            <label for="tour-description" class="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
                id="tour-description"
                bind:value={description}
                rows="4"
                class="block w-full p-3 text-slate-700 border border-slate-200 bg-white focus:ring-2 focus:ring-green-400 rounded-lg"
            ></textarea>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
                <label for="tour-type" class="block text-sm font-medium text-slate-700 mb-1">Trail Type <span class="text-red-500">*</span></label>
                <select
                    id="tour-type"
                    bind:value={tourType}
                    class="block w-full p-3 text-slate-700 border border-slate-200 bg-white focus:ring-2 focus:ring-green-400 rounded-lg"
                    required
                >
                    <option value="" disabled>Select a trail type</option>
                    {#each tourTypes as type}
                        <option value={type.value}>{type.label}</option>
                    {/each}
                </select>
                {#if !tourType}
                    <p class="text-red-500 text-xs mt-1">Please select a trail type</p>
                {/if}
            </div>

            {#if tourType === 'person'}
                <div>
                    <label for="tour-price" class="block text-sm font-medium text-slate-700 mb-1">Price per Person (EUR) <span class="text-red-500">*</span></label>
                    <input
                        id="tour-price"
                        type="number"
                        min="0"
                        step="1"
                        bind:value={price}
                        class="block w-full p-3 text-slate-700 border border-slate-200 bg-white focus:ring-2 focus:ring-green-400 rounded-lg"
                        required
                    />
                </div>
            {/if}
        </div>
    </div>

    <!-- Stops Section -->
    <div class="mb-6">
        <h2 class="text-lg font-semibold text-slate-800 mb-3">Tour Stops</h2>

        <MultiStopMapPicker
            bind:this={mapPicker}
            {stops}
            on:stopsChange={handleStopsChange}
        />

        <!-- Stops List -->
        <div class="mt-4 space-y-3">
            {#if sortedStops.length === 0}
                <div class="text-center py-8 border border-dashed border-slate-300 rounded-lg">
                    <p class="text-slate-500">No stops yet. Click the map or search above to add stops.</p>
                </div>
            {:else}
                {#each sortedStops as stop, index (stop.id)}
                    <div class="border border-slate-200 rounded-lg overflow-hidden">
                        <!-- Stop Header -->
                        <div class="p-3 bg-slate-50 flex items-start gap-3">
                            <span class="flex-shrink-0 w-7 h-7 rounded-full bg-green-500 text-white text-sm font-bold flex items-center justify-center">
                                {index + 1}
                            </span>
                            <div class="flex-1 min-w-0 space-y-2">
                                <div class="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={stop.location.placeName || ''}
                                        on:input={(e) => updateStopPlaceName(stop.id, e.currentTarget.value)}
                                        placeholder="Stop name"
                                        class="flex-1 px-2 py-1 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-green-400 bg-white"
                                    />
                                    <select
                                        value={stop.location.placeType || ''}
                                        on:change={(e) => updateStopPlaceType(stop.id, e.currentTarget.value)}
                                        class="px-2 py-1 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-green-400 bg-white"
                                    >
                                        <option value="">Type...</option>
                                        {#each placeTypes as type}
                                            <option value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
                                        {/each}
                                    </select>
                                </div>

                                {#if stop.location.address}
                                    <p class="text-xs text-slate-500 truncate">{stop.location.address}</p>
                                {/if}

                                <!-- Status badges -->
                                <div class="flex items-center gap-2 flex-wrap">
                                    {#if stop.location.lat && stop.location.lng}
                                        <span class="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">
                                            <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" /></svg>
                                            Located
                                        </span>
                                    {/if}
                                    {#if stop.teachingMaterial}
                                        <span class="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">
                                            <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" /></svg>
                                            Teaching material
                                        </span>
                                    {/if}
                                </div>
                            </div>

                            <!-- Actions -->
                            <div class="flex items-center gap-1 flex-shrink-0">
                                <button
                                    type="button"
                                    on:click={() => moveStop(stop.id, 'up')}
                                    class="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                    title="Move up"
                                    disabled={index === 0}
                                >
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7" />
                                    </svg>
                                </button>
                                <button
                                    type="button"
                                    on:click={() => moveStop(stop.id, 'down')}
                                    class="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                    title="Move down"
                                    disabled={index === sortedStops.length - 1}
                                >
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>
                                <button
                                    type="button"
                                    on:click={() => adjustingStopId = adjustingStopId === stop.id ? null : stop.id}
                                    class="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
                                    title="Adjust location"
                                >
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                                    </svg>
                                </button>
                                <button
                                    type="button"
                                    on:click={() => removeStop(stop.id)}
                                    class="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                                    title="Delete stop"
                                >
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <!-- Inline Location Picker -->
                        {#if adjustingStopId === stop.id}
                            <div class="border-t border-slate-200">
                                <StopLocationPicker
                                    location={stop.location}
                                    placeName={stop.location.placeName || ''}
                                    on:confirm={(e) => handleLocationAdjust(stop.id, e)}
                                />
                            </div>
                        {/if}
                    </div>
                {/each}
            {/if}
        </div>
    </div>

    <!-- Action Buttons -->
    <div class="flex items-center justify-between pt-4 border-t border-slate-200">
        <button
            type="button"
            on:click={handleSaveChanges}
            class="bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 px-5 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 flex items-center"
            disabled={isSubmitting}
        >
            {#if isSubmitting}
                <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
            {:else}
                Save Changes
            {/if}
        </button>
        <button
            type="button"
            on:click={handleCancel}
            class="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-medium py-2.5 px-5 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400"
            disabled={isSubmitting}
        >
            Cancel
        </button>
    </div>
</div>
