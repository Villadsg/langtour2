<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import SimpleMapPicker from './SimpleMapPicker.svelte';
    import MultiStopMapPicker from './MultiStopMapPicker.svelte';
    import StopListEditor from './StopListEditor.svelte';
    import StopAssistant from './StopAssistant.svelte';
    import type { TourStop, TourStopLocation, TeachingMaterial } from '$lib/firebase/types';

    export let tour = {
        name: '',
        cityId: '',
        languageTaught: '',
        instructionLanguage: '',
        langDifficulty: '',
        description: '',
        imageUrl: '',
        tourType: 'person',
        price: 24,
        stops: [] as TourStop[]
    };

    const dispatch = createEventDispatcher();

    // Available languages
    const allLanguages = ['English', 'Spanish', 'German', 'French', 'Italian', 'Danish'];

    // Language difficulty levels
    const difficultyLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

    // Tour type options
    const tourTypes = [
        { value: 'person', label: 'Guided tour by a person' },
        { value: 'app', label: 'Guided tour by the app' }
    ];

    // Phase management
    type Phase = 'basic-info' | 'route-builder' | 'review';
    let currentPhase: Phase = 'basic-info';

    // Form state
    let isSubmitting = false;

    // Route builder state
    let mapPickerComponent: MultiStopMapPicker;

    // Stop assistant state
    let selectedStopForAssistant: TourStop | null = null;
    let showStopAssistant = false;

    // Validation
    $: isBasicInfoComplete = tour.name.trim() !== '' &&
        tour.languageTaught !== '' &&
        tour.instructionLanguage !== '' &&
        tour.langDifficulty !== '' &&
        tour.description.trim() !== '';

    $: stopsWithContent = tour.stops.filter(s =>
        s.teachingMaterial?.vocabulary && s.teachingMaterial.vocabulary.length > 0
    ).length;

    $: tourContext = {
        languageTaught: tour.languageTaught,
        instructionLanguage: tour.instructionLanguage,
        cefrLevel: tour.langDifficulty,
        tourName: tour.name,
        tourDescription: tour.description
    };

    // Handle stops change from map picker
    function handleStopsChange(event: CustomEvent<TourStop[]>) {
        tour.stops = event.detail;
    }

    // Handle stop reorder from list editor
    function handleStopReorder(event: CustomEvent<TourStop[]>) {
        tour.stops = event.detail.map((s, index) => ({ ...s, order: index }));
        mapPickerComponent?.reorderStops(tour.stops);
    }

    // Handle stop delete from list editor
    function handleStopDelete(event: CustomEvent<string>) {
        const stopId = event.detail;
        mapPickerComponent?.removeStop(stopId);
    }

    // Handle stop update from list editor
    function handleStopUpdate(event: CustomEvent<{ stopId: string; updates: Partial<TourStopLocation> }>) {
        const { stopId, updates } = event.detail;
        tour.stops = tour.stops.map(s =>
            s.id === stopId
                ? { ...s, location: { ...s.location, ...updates } }
                : s
        );
        mapPickerComponent?.updateStopLocation(stopId, updates);
    }

    // Open stop assistant for creating/editing content
    function openStopAssistant(stop: TourStop) {
        selectedStopForAssistant = stop;
        showStopAssistant = true;
    }

    // Handle view content / edit content request from list editor
    function handleViewContent(event: CustomEvent<string>) {
        const stopId = event.detail;
        const stop = tour.stops.find(s => s.id === stopId);
        if (stop) {
            openStopAssistant(stop);
        }
    }

    // Handle regenerate request (open assistant)
    function handleRegenerateStop(event: CustomEvent<string>) {
        const stopId = event.detail;
        const stop = tour.stops.find(s => s.id === stopId);
        if (stop) {
            openStopAssistant(stop);
        }
    }

    // Handle teaching material update from assistant
    function handleMaterialUpdate(event: CustomEvent<{ stopId: string; teachingMaterial: TeachingMaterial }>) {
        const { stopId, teachingMaterial } = event.detail;
        tour.stops = tour.stops.map(s =>
            s.id === stopId ? { ...s, teachingMaterial } : s
        );
        // Update the selected stop if it's still the same
        if (selectedStopForAssistant?.id === stopId) {
            selectedStopForAssistant = tour.stops.find(s => s.id === stopId) || null;
        }
    }

    // Close stop assistant
    function closeStopAssistant() {
        showStopAssistant = false;
        selectedStopForAssistant = null;
    }

    // Navigation
    function goToRouteBuilder() {
        if (!isBasicInfoComplete) {
            alert('Please fill in all required fields before continuing.');
            return;
        }
        currentPhase = 'route-builder';
    }

    function goToReview() {
        if (tour.stops.length === 0) {
            alert('Please add at least one stop to your tour.');
            return;
        }
        currentPhase = 'review';
    }

    // Handle form submission
    function handleCreateTour() {
        isSubmitting = true;
        dispatch('submit', tour);
    }

    // Handle cancellation
    function handleCancel() {
        dispatch('cancel');
    }
</script>

<div class="bg-white border border-slate-200 rounded-lg p-6">
    <!-- Phase indicator -->
    <div class="mb-6">
        <div class="flex items-center justify-between text-sm">
            <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-full flex items-center justify-center {currentPhase === 'basic-info' ? 'bg-green-500 text-white' : 'bg-green-100 text-green-700'}">
                    1
                </div>
                <span class="{currentPhase === 'basic-info' ? 'font-medium' : 'text-gray-500'}">Basic Info</span>
            </div>
            <div class="flex-1 h-px bg-gray-200 mx-2"></div>
            <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-full flex items-center justify-center {currentPhase === 'route-builder' ? 'bg-green-500 text-white' : isBasicInfoComplete ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-400'}">
                    2
                </div>
                <span class="{currentPhase === 'route-builder' ? 'font-medium' : isBasicInfoComplete ? 'text-gray-500' : 'text-gray-400'}">Route & Content</span>
            </div>
            <div class="flex-1 h-px bg-gray-200 mx-2"></div>
            <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-full flex items-center justify-center {currentPhase === 'review' ? 'bg-green-500 text-white' : tour.stops.length > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-400'}">
                    3
                </div>
                <span class="{currentPhase === 'review' ? 'font-medium' : 'text-gray-400'}">Review</span>
            </div>
        </div>
    </div>

    <!-- Phase 1: Basic Info -->
    {#if currentPhase === 'basic-info'}
        <div class="space-y-6">
            <div>
                <h3 class="text-lg font-medium mb-4">Tour Information</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="md:col-span-2">
                        <label for="tour-name" class="block text-gray-700 text-sm font-medium mb-1">
                            Tour Name <span class="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            id="tour-name"
                            bind:value={tour.name}
                            placeholder="e.g., Copenhagen Coffee Culture Tour"
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
                        />
                    </div>

                    <div>
                        <label for="language-taught" class="block text-gray-700 text-sm font-medium mb-1">
                            Language to Teach <span class="text-red-500">*</span>
                        </label>
                        <select
                            id="language-taught"
                            bind:value={tour.languageTaught}
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
                        >
                            <option value="">Select language...</option>
                            {#each allLanguages as lang}
                                <option value={lang}>{lang}</option>
                            {/each}
                        </select>
                    </div>

                    <div>
                        <label for="instruction-language" class="block text-gray-700 text-sm font-medium mb-1">
                            Instruction Language <span class="text-red-500">*</span>
                        </label>
                        <select
                            id="instruction-language"
                            bind:value={tour.instructionLanguage}
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
                        >
                            <option value="">Select language...</option>
                            {#each allLanguages as lang}
                                <option value={lang}>{lang}</option>
                            {/each}
                        </select>
                    </div>

                    <div>
                        <label for="difficulty" class="block text-gray-700 text-sm font-medium mb-1">
                            Difficulty Level <span class="text-red-500">*</span>
                        </label>
                        <select
                            id="difficulty"
                            bind:value={tour.langDifficulty}
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
                        >
                            <option value="">Select level...</option>
                            {#each difficultyLevels as level}
                                <option value={level}>{level} - {level === 'A1' ? 'Beginner' : level === 'A2' ? 'Elementary' : level === 'B1' ? 'Intermediate' : level === 'B2' ? 'Upper Intermediate' : level === 'C1' ? 'Advanced' : 'Proficient'}</option>
                            {/each}
                        </select>
                    </div>

                    <div>
                        <label for="tour-type" class="block text-gray-700 text-sm font-medium mb-1">
                            Tour Type
                        </label>
                        <select
                            id="tour-type"
                            bind:value={tour.tourType}
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
                        >
                            {#each tourTypes as type}
                                <option value={type.value}>{type.label}</option>
                            {/each}
                        </select>
                    </div>

                    <div class="md:col-span-2">
                        <label for="description" class="block text-gray-700 text-sm font-medium mb-1">
                            Description <span class="text-red-500">*</span>
                        </label>
                        <textarea
                            id="description"
                            bind:value={tour.description}
                            rows="3"
                            placeholder="Describe your tour - what makes it special, what will learners experience?"
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
                        ></textarea>
                    </div>

                    <div class="md:col-span-2">
                        <label for="image-url" class="block text-gray-700 text-sm font-medium mb-1">
                            Image URL (optional)
                        </label>
                        <input
                            id="image-url"
                            type="url"
                            bind:value={tour.imageUrl}
                            placeholder="https://example.com/image.jpg"
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
                        />
                    </div>
                </div>
            </div>

            <!-- Starting point map -->
            <div>
                <h3 class="text-lg font-medium mb-2">Starting Point</h3>
                <p class="text-sm text-gray-600 mb-4">Select where your tour begins.</p>
                <SimpleMapPicker bind:value={tour.cityId} />
            </div>

            <!-- Navigation -->
            <div class="flex justify-between pt-4">
                <button
                    type="button"
                    on:click={handleCancel}
                    class="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    on:click={goToRouteBuilder}
                    disabled={!isBasicInfoComplete}
                    class="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                    Continue to Route Builder
                </button>
            </div>
        </div>
    {/if}

    <!-- Phase 2: Route Builder & Content Creation -->
    {#if currentPhase === 'route-builder'}
        <div class="space-y-6">
            <div>
                <h3 class="text-lg font-medium mb-2">Build Your Tour Route</h3>
                <p class="text-sm text-gray-600 mb-4">
                    Add stops to your tour by clicking on the map or searching. For each stop, use the AI assistant to create vocabulary and dialogues.
                </p>

                <!-- Multi-stop map picker -->
                <MultiStopMapPicker
                    bind:this={mapPickerComponent}
                    bind:stops={tour.stops}
                    on:stopsChange={handleStopsChange}
                />
            </div>

            <!-- Stop list with AI assistant buttons -->
            <div>
                <h4 class="text-md font-medium mb-3 flex items-center justify-between">
                    <span>Tour Stops ({tour.stops.length})</span>
                    {#if tour.stops.length > 0}
                        <span class="text-sm font-normal text-gray-500">
                            {stopsWithContent} of {tour.stops.length} with content
                        </span>
                    {/if}
                </h4>

                {#if tour.stops.length === 0}
                    <div class="text-center py-8 text-gray-500 border border-dashed border-gray-300 rounded-lg">
                        <p>No stops added yet.</p>
                        <p class="text-sm mt-1">Click on the map or search to add stops to your tour.</p>
                    </div>
                {:else}
                    <div class="space-y-3">
                        {#each tour.stops.sort((a, b) => a.order - b.order) as stop, index (stop.id)}
                            <div class="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                                <div class="flex items-start gap-3">
                                    <!-- Stop number -->
                                    <div class="flex-shrink-0 w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
                                        {index + 1}
                                    </div>

                                    <!-- Stop details -->
                                    <div class="flex-grow min-w-0">
                                        <div class="flex items-start justify-between">
                                            <div class="flex-grow min-w-0 mr-3">
                                                <input
                                                    type="text"
                                                    value={stop.location.placeName || ''}
                                                    on:input={(e) => handleStopUpdate(new CustomEvent('update', { detail: { stopId: stop.id, updates: { placeName: e.currentTarget.value } } }))}
                                                    placeholder="Stop name"
                                                    class="w-full px-2 py-1 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-green-400"
                                                />
                                                <p class="text-xs text-gray-500 mt-1 truncate">{stop.location.address || 'No address'}</p>
                                            </div>

                                            <!-- Place type selector -->
                                            <select
                                                value={stop.location.placeType || ''}
                                                on:change={(e) => handleStopUpdate(new CustomEvent('update', { detail: { stopId: stop.id, updates: { placeType: e.currentTarget.value } } }))}
                                                class="text-xs px-2 py-1 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-green-400"
                                            >
                                                <option value="">Type...</option>
                                                <option value="cafe">Cafe</option>
                                                <option value="restaurant">Restaurant</option>
                                                <option value="museum">Museum</option>
                                                <option value="market">Market</option>
                                                <option value="landmark">Landmark</option>
                                                <option value="park">Park</option>
                                                <option value="shop">Shop</option>
                                                <option value="neighborhood">Neighborhood</option>
                                                <option value="station">Station</option>
                                                <option value="square">Square</option>
                                                <option value="other">Other</option>
                                            </select>
                                        </div>

                                        <!-- Content status and AI assistant button -->
                                        <div class="mt-3 flex items-center justify-between">
                                            <div class="flex items-center gap-2">
                                                {#if stop.teachingMaterial?.vocabulary && stop.teachingMaterial.vocabulary.length > 0}
                                                    <span class="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                                                        <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                                            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                                                        </svg>
                                                        {stop.teachingMaterial.vocabulary.length} vocab, {stop.teachingMaterial.dialogues?.length ?? 0} dialogues
                                                    </span>
                                                {:else}
                                                    <span class="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
                                                        No content yet
                                                    </span>
                                                {/if}
                                            </div>

                                            <button
                                                type="button"
                                                on:click={() => openStopAssistant(stop)}
                                                class="px-3 py-1.5 text-sm bg-green-100 text-green-700 border border-green-200 rounded hover:bg-green-200 transition-colors flex items-center gap-1"
                                            >
                                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                                                </svg>
                                                {stop.teachingMaterial?.vocabulary && stop.teachingMaterial.vocabulary.length > 0 ? 'Edit Content' : 'Create Content'}
                                            </button>
                                        </div>
                                    </div>

                                    <!-- Delete button -->
                                    <button
                                        type="button"
                                        on:click={() => handleStopDelete(new CustomEvent('delete', { detail: stop.id }))}
                                        class="flex-shrink-0 p-1 text-red-400 hover:text-red-600"
                                        title="Delete stop"
                                    >
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>

            <!-- Navigation -->
            <div class="flex justify-between pt-4">
                <button
                    type="button"
                    on:click={() => currentPhase = 'basic-info'}
                    class="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                    Back to Basic Info
                </button>
                <button
                    type="button"
                    on:click={goToReview}
                    disabled={tour.stops.length === 0}
                    class="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                    Continue to Review
                </button>
            </div>
        </div>
    {/if}

    <!-- Phase 3: Review & Submit -->
    {#if currentPhase === 'review'}
        <div class="space-y-6">
            <h3 class="text-lg font-medium">Review Your Tour</h3>

            <!-- Tour summary -->
            <div class="bg-gray-50 rounded-lg p-4">
                <div class="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <span class="text-gray-500">Name:</span>
                        <span class="ml-2 font-medium">{tour.name}</span>
                    </div>
                    <div>
                        <span class="text-gray-500">Type:</span>
                        <span class="ml-2">{tourTypes.find(t => t.value === tour.tourType)?.label}</span>
                    </div>
                    <div>
                        <span class="text-gray-500">Language:</span>
                        <span class="ml-2">{tour.languageTaught} (instructions in {tour.instructionLanguage})</span>
                    </div>
                    <div>
                        <span class="text-gray-500">Level:</span>
                        <span class="ml-2">{tour.langDifficulty}</span>
                    </div>
                    <div class="col-span-2">
                        <span class="text-gray-500">Description:</span>
                        <p class="mt-1 text-gray-700">{tour.description}</p>
                    </div>
                </div>
            </div>

            <!-- Stops summary -->
            <div>
                <h4 class="font-medium mb-3">Tour Stops ({tour.stops.length})</h4>
                <div class="space-y-2">
                    {#each tour.stops.sort((a, b) => a.order - b.order) as stop, index}
                        <div class="flex items-center gap-3 p-3 bg-gray-50 border border-slate-200 rounded-lg">
                            <div class="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                                {index + 1}
                            </div>
                            <div class="flex-1 min-w-0">
                                <p class="font-medium text-sm truncate">{stop.location.placeName || 'Stop ' + (index + 1)}</p>
                                <p class="text-xs text-gray-500">{stop.location.placeType || 'Location'}</p>
                            </div>
                            {#if stop.teachingMaterial?.vocabulary && stop.teachingMaterial.vocabulary.length > 0}
                                <span class="px-2 py-1 text-xs bg-green-100 text-green-700 rounded">
                                    {stop.teachingMaterial.vocabulary.length} vocab, {stop.teachingMaterial.dialogues?.length ?? 0} dialogues
                                </span>
                                <button
                                    type="button"
                                    on:click={() => openStopAssistant(stop)}
                                    class="text-xs text-green-600 hover:text-green-700 underline"
                                >
                                    Edit
                                </button>
                            {:else}
                                <span class="px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded">
                                    No content
                                </span>
                                <button
                                    type="button"
                                    on:click={() => openStopAssistant(stop)}
                                    class="text-xs text-green-600 hover:text-green-700 underline"
                                >
                                    Add
                                </button>
                            {/if}
                        </div>
                    {/each}
                </div>
            </div>

            <!-- Warning if missing content -->
            {#if stopsWithContent < tour.stops.length}
                <div class="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p class="text-sm text-yellow-800">
                        <strong>Note:</strong> {tour.stops.length - stopsWithContent} stop(s) don't have teaching content yet.
                        You can still create the tour and add content later.
                    </p>
                </div>
            {/if}

            <!-- Navigation and submit -->
            <div class="flex justify-between pt-4">
                <button
                    type="button"
                    on:click={() => currentPhase = 'route-builder'}
                    class="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                    Back to Route Builder
                </button>
                <div class="flex gap-3">
                    <button
                        type="button"
                        on:click={handleCancel}
                        class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        on:click={handleCreateTour}
                        disabled={isSubmitting}
                        class="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center"
                    >
                        {#if isSubmitting}
                            <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Creating...
                        {:else}
                            Create Tour
                        {/if}
                    </button>
                </div>
            </div>
        </div>
    {/if}
</div>

<!-- Stop Assistant Modal -->
{#if showStopAssistant && selectedStopForAssistant}
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div class="w-full max-w-4xl">
            <StopAssistant
                stop={selectedStopForAssistant}
                {tourContext}
                on:update={handleMaterialUpdate}
                on:close={closeStopAssistant}
            />
        </div>
    </div>
{/if}
