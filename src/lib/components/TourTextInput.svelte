<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { extractTourData } from '$lib/nuExtractService';
  import { batchGeocode, type BatchGeocodeProgress } from '$lib/geocodingService';
  import { getMissingFields, canPublish, getFieldLabel } from '$lib/tourValidation';
  import MissingFieldsBanner from './MissingFieldsBanner.svelte';
  import StopLocationPicker from './StopLocationPicker.svelte';
  import type {
    ParsedTourData,
    ParsedStopData,
    MissingField,
    TourStop,
    TourStopLocation
  } from '$lib/firebase/types';

  const dispatch = createEventDispatcher();

  // Available languages
  const allLanguages = ['English', 'Spanish', 'German', 'French', 'Italian', 'Danish'];
  const difficultyLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const tourTypes = [
    { value: 'person', label: 'Guided tour by a person' },
    { value: 'app', label: 'Guided tour by the app' }
  ];
  const placeTypes = ['cafe', 'restaurant', 'museum', 'market', 'landmark', 'park', 'shop', 'neighborhood', 'station', 'square', 'other'];

  // Phase management
  type Phase = 'input' | 'review' | 'confirm';
  let currentPhase: Phase = 'input';

  // Phase 1: Text input state
  let rawText = '';
  let isParsing = false;
  let parseError = '';

  // Phase 2: Parsed data state
  let parsedData: ParsedTourData | null = null;
  let isGeocoding = false;
  let geocodeProgress: BatchGeocodeProgress | null = null;

  // Editable tour fields
  let tourName = '';
  let languageTaught = '';
  let instructionLanguage = '';
  let langDifficulty = '';
  let description = '';
  let tourType = 'person';
  let cityName = '';

  // Price per person
  let price: number | undefined = undefined;

  // Starting location (becomes first stop)
  let startingLocation = '';
  let hasStartingLocationStop = false;

  // Stop location picker state
  let editingStopIndex: number | null = null;

  // Submission state
  let isSubmitting = false;

  // Computed values
  $: missingFields = parsedData ? getMissingFields(parsedData) : [];
  $: canCreate = parsedData ? canPublish(parsedData) : false;
  $: stopNames = parsedData?.stops.map(s => s.placeName) || [];

  // Parse the pasted text
  async function handleParse() {
    if (!rawText.trim()) return;

    isParsing = true;
    parseError = '';

    try {
      const result = await extractTourData(rawText);
      parsedData = result;

      // Populate editable fields
      tourName = result.name || '';
      languageTaught = result.languageTaught || '';
      instructionLanguage = result.instructionLanguage || '';
      langDifficulty = result.langDifficulty || '';
      description = result.description || '';
      tourType = result.tourType || 'person';
      cityName = result.cityName || '';

      // Populate starting location and prepend as first stop
      if (result.startingLocation) {
        startingLocation = result.startingLocation;
        hasStartingLocationStop = true;
        parsedData = {
          ...parsedData!,
          stops: [
            {
              placeName: result.startingLocation,
              addressOrDescription: result.startingLocation,
              geocodeStatus: 'pending'
            },
            ...parsedData!.stops
          ]
        };
      }

      // Move to review phase
      currentPhase = 'review';

      // Start geocoding if we have stops and a city
      if (result.stops.length > 0) {
        await geocodeStops();
      }
    } catch (error) {
      console.error('Parse error:', error);
      parseError = 'Failed to parse tour description. Please check your input and try again.';
    } finally {
      isParsing = false;
    }
  }

  // Geocode all stops
  async function geocodeStops() {
    if (!parsedData || parsedData.stops.length === 0) return;

    isGeocoding = true;

    try {
      const geocodedStops = await batchGeocode(
        parsedData.stops,
        cityName,
        (progress) => {
          geocodeProgress = progress;
        }
      );

      parsedData = {
        ...parsedData,
        stops: geocodedStops
      };
    } catch (error) {
      console.error('Geocoding error:', error);
    } finally {
      isGeocoding = false;
      geocodeProgress = null;
    }
  }

  // Update parsed data when fields change
  function updateParsedData() {
    if (!parsedData) return;

    parsedData = {
      ...parsedData,
      name: tourName,
      languageTaught,
      instructionLanguage,
      langDifficulty,
      description,
      tourType,
      cityName
    };
  }

  // Handle starting location change - add/update first stop
  function handleStartingLocationChange() {
    if (!parsedData) return;

    let stops = [...parsedData.stops];

    // Remove previous starting location stop if present
    if (hasStartingLocationStop && stops.length > 0) {
      stops = stops.slice(1);
      hasStartingLocationStop = false;
    }

    // Add new starting location stop if value is non-empty
    if (startingLocation.trim()) {
      stops.unshift({
        placeName: startingLocation.trim(),
        addressOrDescription: startingLocation.trim(),
        geocodeStatus: 'pending'
      });
      hasStartingLocationStop = true;
    }

    parsedData = { ...parsedData, stops };

    // Trigger geocoding for the new stop
    if (startingLocation.trim() && cityName) {
      geocodeStops();
    }
  }

  // Handle field click from missing fields banner
  function handleFieldClick(event: CustomEvent<MissingField>) {
    const field = event.detail;

    if (field.section === 'stop' && field.stopIndex !== undefined) {
      if (field.field === 'location') {
        editingStopIndex = field.stopIndex;
      }
      // Scroll to stop
      const stopElement = document.getElementById(`stop-${field.stopIndex}`);
      stopElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      // Scroll to tour field
      const fieldElement = document.getElementById(`field-${field.field}`);
      fieldElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      fieldElement?.focus();
    }
  }

  // Handle stop location change
  function handleStopLocationChange(stopIndex: number, location: TourStopLocation) {
    if (!parsedData) return;

    const updatedStops = [...parsedData.stops];
    updatedStops[stopIndex] = {
      ...updatedStops[stopIndex],
      location,
      geocodeStatus: 'found'
    };

    parsedData = {
      ...parsedData,
      stops: updatedStops
    };
  }

  // Handle stop location confirm
  function handleStopLocationConfirm(stopIndex: number) {
    editingStopIndex = null;
  }

  // Update stop field
  function updateStopField(stopIndex: number, field: keyof ParsedStopData, value: any) {
    if (!parsedData) return;

    const updatedStops = [...parsedData.stops];
    updatedStops[stopIndex] = {
      ...updatedStops[stopIndex],
      [field]: value
    };

    parsedData = {
      ...parsedData,
      stops: updatedStops
    };
  }

  // Move a stop up or down
  function moveStop(stopIndex: number, direction: 'up' | 'down') {
    if (!parsedData) return;
    const swapIndex = direction === 'up' ? stopIndex - 1 : stopIndex + 1;
    if (swapIndex < 0 || swapIndex >= parsedData.stops.length) return;

    const newStops = [...parsedData.stops];
    [newStops[stopIndex], newStops[swapIndex]] = [newStops[swapIndex], newStops[stopIndex]];

    // Update starting location flag if first stop moved
    if (hasStartingLocationStop && (stopIndex === 0 || swapIndex === 0)) {
      hasStartingLocationStop = false;
      startingLocation = '';
    }

    parsedData = { ...parsedData, stops: newStops };
  }

  // Delete a stop
  function deleteStop(stopIndex: number) {
    if (!parsedData) return;

    // If deleting the starting location stop, clear the flag and field
    if (hasStartingLocationStop && stopIndex === 0) {
      hasStartingLocationStop = false;
      startingLocation = '';
    }

    parsedData = {
      ...parsedData,
      stops: parsedData.stops.filter((_, i) => i !== stopIndex)
    };

    if (editingStopIndex === stopIndex) {
      editingStopIndex = null;
    }
  }

  // Create a TourStop from ParsedStopData
  function createTourStop(stop: ParsedStopData, index: number): TourStop {
    return {
      id: `stop_${Date.now()}_${index}`,
      order: index,
      location: stop.location || {
        lat: 0,
        lng: 0,
        address: stop.addressOrDescription,
        placeName: stop.placeName,
        placeType: stop.placeType
      },
      teachingMaterial: stop.teachingMaterial
    };
  }

  // Navigate phases
  function goToConfirm() {
    currentPhase = 'confirm';
  }

  function goBackToReview() {
    currentPhase = 'review';
  }

  function goBackToInput() {
    currentPhase = 'input';
  }

  // Handle tour creation
  function handleCreate() {
    if (!parsedData || !canCreate) return;

    isSubmitting = true;

    // Convert ParsedTourData to Tour format
    const tour = {
      name: tourName,
      cityId: cityName, // We use cityName as cityId for now
      languageTaught,
      instructionLanguage,
      langDifficulty,
      description,
      tourType,
      price: price || 0,
      stops: parsedData.stops.map((stop, index) => createTourStop(stop, index))
    };

    dispatch('submit', tour);
  }

  // Handle cancel
  function handleCancel() {
    dispatch('cancel');
  }
</script>

<div class="bg-white border border-slate-200 rounded-lg p-6">
  <!-- Phase indicator -->
  <div class="mb-6">
    <div class="flex items-center justify-between text-sm">
      <div class="flex items-center gap-2">
        <div class="w-8 h-8 rounded-full flex items-center justify-center {currentPhase === 'input' ? 'bg-green-500 text-white' : 'bg-green-100 text-green-700'}">
          1
        </div>
        <span class="{currentPhase === 'input' ? 'font-medium' : 'text-gray-500'}">Paste Tour Plan</span>
      </div>
      <div class="flex-1 h-px bg-gray-200 mx-2"></div>
      <div class="flex items-center gap-2">
        <div class="w-8 h-8 rounded-full flex items-center justify-center {currentPhase === 'review' ? 'bg-green-500 text-white' : parsedData ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-400'}">
          2
        </div>
        <span class="{currentPhase === 'review' ? 'font-medium' : parsedData ? 'text-gray-500' : 'text-gray-400'}">Review & Fix</span>
      </div>
      <div class="flex-1 h-px bg-gray-200 mx-2"></div>
      <div class="flex items-center gap-2">
        <div class="w-8 h-8 rounded-full flex items-center justify-center {currentPhase === 'confirm' ? 'bg-green-500 text-white' : canCreate ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-400'}">
          3
        </div>
        <span class="{currentPhase === 'confirm' ? 'font-medium' : 'text-gray-400'}">Create</span>
      </div>
    </div>
  </div>

  <!-- Phase 1: Text Input -->
  {#if currentPhase === 'input'}
    <div class="space-y-6">
      <div>
        <div class="mb-2">
          <h3 class="text-lg font-medium">Paste Your Tour Plan</h3>
        </div>
        <p class="text-sm text-gray-600 mb-4">
          Paste your tour description below. Include the tour name, languages, difficulty level, city, description, and list of stops.
          The AI will extract and organize the information for you.
        </p>

        <textarea
          bind:value={rawText}
          rows="16"
          placeholder="Paste your tour plan here...

Example prompt your favorite LLM with this:

&quot;Create a tour description with [n] stops in Madrid which begins in [location]&quot;"
          class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 font-mono text-sm"
        ></textarea>

        {#if parseError}
          <div class="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {parseError}
          </div>
        {/if}
      </div>

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
          on:click={handleParse}
          disabled={!rawText.trim() || isParsing}
          class="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {#if isParsing}
            <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Parsing...
          {:else}
            Parse Tour
          {/if}
        </button>
      </div>
    </div>
  {/if}

  <!-- Phase 2: Review & Edit -->
  {#if currentPhase === 'review' && parsedData}
    <div class="space-y-6">
      <!-- Missing fields banner -->
      <MissingFieldsBanner
        {missingFields}
        {stopNames}
        on:fieldClick={handleFieldClick}
      />

      <!-- Geocoding progress -->
      {#if isGeocoding && geocodeProgress}
        <div class="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div class="flex items-center gap-3">
            <svg class="animate-spin h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <div class="flex-1">
              <p class="text-sm font-medium text-blue-800">
                Looking up locations... ({geocodeProgress.completed}/{geocodeProgress.total})
              </p>
              <p class="text-xs text-blue-600">{geocodeProgress.currentPlace}</p>
            </div>
          </div>
        </div>
      {/if}

      <!-- Tour Information -->
      <div>
        <h3 class="text-lg font-medium mb-4">Tour Information</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="md:col-span-2">
            <label for="field-name" class="block text-gray-700 text-sm font-medium mb-1">
              Tour Name <span class="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="field-name"
              bind:value={tourName}
              on:change={updateParsedData}
              placeholder="e.g., Copenhagen Coffee Culture Tour"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>

          <div>
            <label for="field-languageTaught" class="block text-gray-700 text-sm font-medium mb-1">
              Language to Teach <span class="text-red-500">*</span>
            </label>
            <select
              id="field-languageTaught"
              bind:value={languageTaught}
              on:change={updateParsedData}
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
            >
              <option value="">Select language...</option>
              {#each allLanguages as lang}
                <option value={lang}>{lang}</option>
              {/each}
            </select>
          </div>

          <div>
            <label for="field-instructionLanguage" class="block text-gray-700 text-sm font-medium mb-1">
              Instruction Language <span class="text-red-500">*</span>
            </label>
            <select
              id="field-instructionLanguage"
              bind:value={instructionLanguage}
              on:change={updateParsedData}
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
            >
              <option value="">Select language...</option>
              {#each allLanguages as lang}
                <option value={lang}>{lang}</option>
              {/each}
            </select>
          </div>

          <div>
            <label for="field-langDifficulty" class="block text-gray-700 text-sm font-medium mb-1">
              Difficulty Level
            </label>
            <select
              id="field-langDifficulty"
              bind:value={langDifficulty}
              on:change={updateParsedData}
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
            >
              <option value="">Select level...</option>
              {#each difficultyLevels as level}
                <option value={level}>{level} - {level === 'A1' ? 'Beginner' : level === 'A2' ? 'Elementary' : level === 'B1' ? 'Intermediate' : level === 'B2' ? 'Upper Intermediate' : level === 'C1' ? 'Advanced' : 'Proficient'}</option>
              {/each}
            </select>
          </div>

          <div>
            <label for="field-cityName" class="block text-gray-700 text-sm font-medium mb-1">
              City
            </label>
            <input
              type="text"
              id="field-cityName"
              bind:value={cityName}
              on:change={() => { updateParsedData(); if (parsedData && parsedData.stops.length > 0) geocodeStops(); }}
              placeholder="e.g., Copenhagen, Denmark"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>

          <div class="md:col-span-2">
            <label for="field-description" class="block text-gray-700 text-sm font-medium mb-1">
              Description <span class="text-red-500">*</span>
            </label>
            <textarea
              id="field-description"
              bind:value={description}
              on:change={updateParsedData}
              rows="3"
              placeholder="Describe your tour..."
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
            ></textarea>
          </div>

          <div>
            <label for="field-tourType" class="block text-gray-700 text-sm font-medium mb-1">
              Tour Type
            </label>
            <select
              id="field-tourType"
              bind:value={tourType}
              on:change={updateParsedData}
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
            >
              {#each tourTypes as type}
                <option value={type.value}>{type.label}</option>
              {/each}
            </select>
          </div>

          {#if tourType === 'person'}
            <div>
              <label for="field-price" class="block text-gray-700 text-sm font-medium mb-1">
                Price per Person (EUR) <span class="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="field-price"
                min="0"
                step="1"
                bind:value={price}
                placeholder="e.g., 25"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>
          {/if}
        </div>
      </div>

      <!-- Stops -->
      <div>
        <h3 class="text-lg font-medium mb-4">
          Tour Stops ({parsedData.stops.length})
        </h3>

        <div class="mb-4">
          <label for="field-startingLocation" class="block text-gray-700 text-sm font-medium mb-1">
            Starting Location
          </label>
          <div class="flex gap-2">
            <input
              type="text"
              id="field-startingLocation"
              bind:value={startingLocation}
              on:change={handleStartingLocationChange}
              placeholder="e.g., Plaza Mayor"
              class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>
          <p class="text-xs text-gray-500 mt-1">Added as the first tour stop</p>
        </div>

        {#if parsedData.stops.length === 0}
          <div class="text-center py-8 text-gray-500 border border-dashed border-gray-300 rounded-lg">
            <p>No stops were extracted from your text.</p>
            <p class="text-sm mt-1">Try including a numbered list of places in your tour description.</p>
          </div>
        {:else}
          <div class="space-y-4">
            {#each parsedData.stops as stop, index (index)}
              <div id="stop-{index}" class="border border-slate-200 rounded-lg overflow-hidden">
                <div class="p-4 bg-white">
                  <div class="flex items-start gap-3">
                    <!-- Stop number -->
                    <div class="flex-shrink-0 w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
                      {index + 1}
                    </div>

                    <!-- Stop details -->
                    <div class="flex-grow min-w-0 space-y-3">
                      <div class="flex items-start gap-3">
                        <div class="flex-grow">
                          <input
                            type="text"
                            value={stop.placeName}
                            on:input={(e) => updateStopField(index, 'placeName', e.currentTarget.value)}
                            placeholder="Stop name"
                            class="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
                          />
                        </div>
                        <select
                          value={stop.placeType || ''}
                          on:change={(e) => updateStopField(index, 'placeType', e.currentTarget.value)}
                          class="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
                        >
                          <option value="">Type...</option>
                          {#each placeTypes as type}
                            <option value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
                          {/each}
                        </select>
                      </div>

                      <input
                        type="text"
                        value={stop.addressOrDescription}
                        on:input={(e) => updateStopField(index, 'addressOrDescription', e.currentTarget.value)}
                        placeholder="Address or description"
                        class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
                      />

                      <!-- Location status -->
                      <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                          {#if stop.geocodeStatus === 'found'}
                            <span class="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                              <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                              </svg>
                              Location found
                            </span>
                          {:else if stop.geocodeStatus === 'ambiguous'}
                            <span class="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full">
                              <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              Multiple matches - confirm location
                            </span>
                          {:else if stop.geocodeStatus === 'not_found'}
                            <span class="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full">
                              <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              Location not found
                            </span>
                          {:else}
                            <span class="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
                              <svg class="w-3 h-3 mr-1 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                              </svg>
                              Looking up...
                            </span>
                          {/if}

                          <!-- Teaching content status -->
                          {#if stop.teachingMaterial?.vocabulary && stop.teachingMaterial.vocabulary.length > 0}
                            <span class="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                              {stop.teachingMaterial.vocabulary.length} vocab
                            </span>
                          {/if}
                        </div>

                        <div class="flex items-center gap-2">
                          <button
                            type="button"
                            on:click={() => moveStop(index, 'up')}
                            class="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Move up"
                            disabled={index === 0}
                          >
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            on:click={() => moveStop(index, 'down')}
                            class="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Move down"
                            disabled={index === parsedData.stops.length - 1}
                          >
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>

                          {#if stop.geocodeStatus === 'not_found' || stop.geocodeStatus === 'ambiguous'}
                            <button
                              type="button"
                              on:click={() => editingStopIndex = editingStopIndex === index ? null : index}
                              class="text-xs text-blue-600 hover:text-blue-700"
                            >
                              {editingStopIndex === index ? 'Hide map' : 'Fix location'}
                            </button>
                          {:else}
                            <button
                              type="button"
                              on:click={() => editingStopIndex = editingStopIndex === index ? null : index}
                              class="text-xs text-gray-500 hover:text-gray-700"
                            >
                              {editingStopIndex === index ? 'Hide map' : 'Adjust'}
                            </button>
                          {/if}

                          <button
                            type="button"
                            on:click={() => deleteStop(index)}
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
                  </div>
                </div>

                <!-- Location picker (expandable) -->
                {#if editingStopIndex === index}
                  <div class="border-t border-slate-200">
                    <StopLocationPicker
                      location={stop.location}
                      alternatives={stop.alternatives || []}
                      placeName={stop.placeName}
                      on:locationChange={(e) => handleStopLocationChange(index, e.detail)}
                      on:confirm={() => handleStopLocationConfirm(index)}
                    />
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Navigation -->
      <div class="flex justify-between pt-4">
        <button
          type="button"
          on:click={goBackToInput}
          class="px-4 py-2 text-gray-600 hover:text-gray-800"
        >
          Back to Edit Text
        </button>
        <button
          type="button"
          on:click={goToConfirm}
          disabled={!canCreate}
          class="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          Continue to Create
        </button>
      </div>
    </div>
  {/if}

  <!-- Phase 3: Confirmation -->
  {#if currentPhase === 'confirm' && parsedData}
    <div class="space-y-6">
      <h3 class="text-lg font-medium">Confirm Your Tour</h3>

      <!-- Tour summary -->
      <div class="bg-gray-50 rounded-lg p-4">
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span class="text-gray-500">Name:</span>
            <span class="ml-2 font-medium">{tourName}</span>
          </div>
          <div>
            <span class="text-gray-500">Type:</span>
            <span class="ml-2">{tourTypes.find(t => t.value === tourType)?.label}</span>
          </div>
          <div>
            <span class="text-gray-500">Language:</span>
            <span class="ml-2">{languageTaught} (instructions in {instructionLanguage})</span>
          </div>
          <div>
            <span class="text-gray-500">Level:</span>
            <span class="ml-2">{langDifficulty || 'Not specified'}</span>
          </div>
          <div>
            <span class="text-gray-500">City:</span>
            <span class="ml-2">{cityName || 'Not specified'}</span>
          </div>
          {#if tourType === 'person' && price}
            <div>
              <span class="text-gray-500">Price:</span>
              <span class="ml-2">{price} EUR per person</span>
            </div>
          {/if}
          <div class="col-span-2">
            <span class="text-gray-500">Description:</span>
            <p class="mt-1 text-gray-700">{description}</p>
          </div>
        </div>
      </div>

      <!-- Stops summary -->
      <div>
        <h4 class="font-medium mb-3">Tour Stops ({parsedData.stops.length})</h4>
        <div class="space-y-2">
          {#each parsedData.stops as stop, index}
            <div class="flex items-center gap-3 p-3 bg-gray-50 border border-slate-200 rounded-lg">
              <div class="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                {index + 1}
              </div>
              <div class="flex-1 min-w-0">
                <p class="font-medium text-sm truncate">{stop.placeName}</p>
                <p class="text-xs text-gray-500">{stop.placeType || 'Location'}</p>
              </div>
              {#if stop.teachingMaterial?.vocabulary && stop.teachingMaterial.vocabulary.length > 0}
                <span class="px-2 py-1 text-xs bg-green-100 text-green-700 rounded">
                  {stop.teachingMaterial.vocabulary.length} vocab, {stop.teachingMaterial.dialogues?.length ?? 0} dialogues
                </span>
              {:else}
                <span class="px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded">
                  No content
                </span>
              {/if}
            </div>
          {/each}
        </div>
      </div>

      <!-- Navigation and submit -->
      <div class="flex justify-between pt-4">
        <button
          type="button"
          on:click={goBackToReview}
          class="px-4 py-2 text-gray-600 hover:text-gray-800"
        >
          Back to Review
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
            on:click={handleCreate}
            disabled={isSubmitting || !canCreate}
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

