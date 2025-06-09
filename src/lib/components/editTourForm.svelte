<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    
    import type { Tour } from '$lib/stores/tourStore';
    
    export let tour: Tour & { languageTaught?: string; instructionLanguage?: string; language?: string } = {
        id: '', // Added to satisfy Tour type
        name: '',
        cityId: '',
        language: '', // Will be parsed into taught/instruction
        languageTaught: '',
        instructionLanguage: '',
        description: '',
        imageUrl: '',
        tourType: '',
        price: 0,
        langDifficulty: '' // Added to match Tour type fully
    };

    // Ensure 'languages' array is available for dropdowns (can be renamed to allLanguages if preferred)
    // const allLanguages = ['Danish', 'Spanish', 'English', 'French', 'German', 'Italian'];
    
    const dispatch = createEventDispatcher();
    
    // City options (same as in TourForm)
    const cities = [
        { id: 'copenhagen', name: 'Copenhagen', country: 'Denmark' },
        { id: 'madrid', name: 'Madrid', country: 'Spain' }
    ];
    
    // Language options (same as in TourForm)
    const languages = ['Danish', 'Spanish', 'English', 'French', 'German', 'Italian'];
    
    // Tour type options with display labels and values
    const tourTypes = [
        { value: 'person', label: 'Guided tour by a person' },
        { value: 'app', label: 'Guided tour by the app' }
    ];
    
    let isSubmitting = false;

    onMount(() => {
        if (tour.language && typeof tour.language === 'string') {
            const parts = tour.language.split(',').map(part => part.trim());
            if (parts.length === 2) {
                tour.languageTaught = parts[0];
                tour.instructionLanguage = parts[1];
            } else {
                // If parsing fails or it's not a pair, try to set languageTaught if tour.language is a single language
                // This handles older data or cases where only one language might have been stored
                if (!languages.includes(tour.language)) {
                     // If tour.language is not a recognized single language, clear them
                    tour.languageTaught = '';
                    tour.instructionLanguage = '';
                } else {
                    tour.languageTaught = tour.language; // Fallback: assume it's the taught language
                    tour.instructionLanguage = ''; // No instruction language specified
                }
            }
        } else {
             // If tour.language is not a string or undefined, ensure defaults
            tour.languageTaught = tour.languageTaught || '';
            tour.instructionLanguage = tour.instructionLanguage || '';
        }
    });

    // Handle form submission
    const handleSaveChanges = () => {
        isSubmitting = true;
        // Combine taught and instruction languages back into the 'language' field for submission
        // if the backend expects it that way. Otherwise, dispatch them separately.
        const tourToSubmit = {
            ...tour,
            language: `${tour.languageTaught || ''}, ${tour.instructionLanguage || ''}`.replace(/^, |, $/g, '') // Clean up if one is empty
        };
        dispatch('submit', tourToSubmit);
    };
    
    // Handle cancel
    const handleCancel = () => {
        dispatch('cancel');
    };
    
</script>

<div class="bg-white shadow-md rounded-lg p-6">


        <!-- Form review and edit area -->
        <div class="mb-6 grid grid-cols-1 gap-4">
            <div>
                <label for="tour-name" class="block text-gray-700 text-sm font-bold mb-2">Tour Name</label>
                <input
                    id="tour-name"
                    type="text"
                    bind:value={tour.name}
                    class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                />
            </div>
            
            <div>
                <label for="tour-city" class="block text-gray-700 text-sm font-bold mb-2">City</label>
                <select
                    id="tour-city"
                    bind:value={tour.cityId}
                    class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                >
                    {#each cities as city}
                        <option value={city.id}>{city.name}, {city.country}</option>
                    {/each}
                </select>
            </div>
            
            <div>
                <label for="tour-language-taught" class="block text-gray-700 text-sm font-bold mb-2">Language Taught</label>
                <select
                    id="tour-language-taught"
                    bind:value={tour.languageTaught}
                    class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                >
                    <option value="">Select language taught</option>
                    {#each languages as lang}
                        <option value={lang}>{lang}</option>
                    {/each}
                </select>
            </div>
            
            <div>
                <label for="tour-instruction-language" class="block text-gray-700 text-sm font-bold mb-2">Instruction Language</label>
                <select
                    id="tour-instruction-language"
                    bind:value={tour.instructionLanguage}
                    class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                >
                    <option value="">Select instruction language</option>
                    {#each languages as lang}
                        <option value={lang}>{lang}</option>
                    {/each}
                </select>
            </div>
            
            <div>
                <label for="tour-description" class="block text-gray-700 text-sm font-bold mb-2">Description</label>
                <textarea
                    id="tour-description"
                    bind:value={tour.description}
                    class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline h-32"
                ></textarea>
            </div>
            
            <div>
                <label for="tour-type" class="block text-gray-700 text-sm font-bold mb-2">Tour Type <span class="text-red-500">*</span></label>
                <select
                    id="tour-type"
                    bind:value={tour.tourType}
                    class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    required
                >
                    <option value="" disabled>Select a tour type</option>
                    {#each tourTypes as type}
                        <option value={type.value}>{type.label}</option>
                    {/each}
                </select>
                {#if !tour.tourType}
                    <p class="text-red-500 text-xs mt-1">Please select a tour type</p>
                {/if}
            </div>
            
            <!-- Price field - only shown for person-guided tours -->
            {#if tour.tourType === 'person'}
                <div>
                    <label for="tour-price" class="block text-gray-700 text-sm font-bold mb-2">Price per Person (€) <span class="text-red-500">*</span></label>
                    <input
                        id="tour-price"
                        type="number"
                        min="0"
                        step="1"
                        bind:value={tour.price}
                        class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                        required
                    />
                </div>
            {/if}
        </div>
    
    <!-- Action buttons -->
    <div class="flex items-center justify-between">
        <button
            type="button"
            on:click={handleSaveChanges}
            class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline flex items-center"
            disabled={isSubmitting}
        >
            {#if isSubmitting}
                <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Creating...
            {:else}
                Save Changes
            {/if}
        </button>
        <button
            type="button"
            on:click={handleCancel}
            class="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            disabled={isSubmitting}
        >
            Cancel
        </button>
    </div>
</div>
