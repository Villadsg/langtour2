<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import { GeminiService } from '$lib/geminiService';
    import type { Tour } from '$lib/stores/tourStore';
    
    export let tour = {
        name: '',
        cityId: '',
        language: '',
        description: '',
        imageUrl: '',
        tourType: '',
        price: 0
    };
    
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
    
    // AI conversation state
    let currentQuestion = '';
    let userInput = '';
    let messages: { role: 'ai' | 'user', content: string, feedback?: string }[] = [];
    let isWaitingForResponse = false;
    let isFormComplete = false;
    let isSubmitting = false;
    
    // If tour data is provided with non-empty values, immediately show the form view
    $: isFormComplete = tour.name !== '' || tour.cityId !== '' || tour.language !== '' || tour.description !== '';
    let suggestions: Record<string, string> = {};
    let showingSuggestions = false;
    let missingFields: string[] = [];
    
    // Parse tour information from user input and get AI suggestions for missing fields
    const extractTourInfo = async (input: string): Promise<{ name: string, cityId: string, language: string, description: string, tourType: string, price: number }> => {
        const result = { name: '', cityId: '', language: '', description: input, tourType: '', price: 0 };
        
        // Only try to extract explicit tour names (in quotes or after "name:")
        // Don't use the first text in the description as the name
        const nameRegex = /["']([^"']+)["']|name[:\s]+([^,.\n]+)/i;
        const nameMatch = input.match(nameRegex);
        if (nameMatch) {
            result.name = (nameMatch[1] || nameMatch[2] || '').trim();
        }
        
        // Check for city names in the input
        for (const city of cities) {
            if (input.toLowerCase().includes(city.name.toLowerCase())) {
                result.cityId = city.id;
                break;
            }
        }
        
        // Check for languages in the input
        for (const lang of languages) {
            if (input.toLowerCase().includes(lang.toLowerCase())) {
                result.language = lang;
                break;
            }
        }
        
        // Check for tour type in the input
        if (input.toLowerCase().includes('guided tour by a person') || 
            input.toLowerCase().includes('in person') || 
            input.toLowerCase().includes('tour guide') || 
            input.toLowerCase().includes('guided by person')) {
            result.tourType = 'person';
            // Try to extract price information
            const priceRegex = /(€|EUR|euro|price)[:\s]*([0-9]+)/i;
            const priceMatch = input.match(priceRegex);
            if (priceMatch && priceMatch[2]) {
                result.price = parseInt(priceMatch[2], 10);
            } else {
                result.price = 24; // Default price if not specified
            }
        } else if (input.toLowerCase().includes('guided tour by the app') || 
                   input.toLowerCase().includes('app guided') || 
                   input.toLowerCase().includes('self guided') || 
                   input.toLowerCase().includes('digital guide')) {
            result.tourType = 'app';
            result.price = 0; // App-guided tours are free
        }
        
        // Get AI suggestions for any missing fields
        const missingFields = [];
        if (!result.name) missingFields.push('name');
        if (!result.cityId) missingFields.push('city');
        if (!result.language) missingFields.push('language');
        if (!result.tourType) missingFields.push('tourType');
        
        if (missingFields.length > 0) {
            for (const field of missingFields) {
                try {
                    if (field === 'name' && !result.name) {
                        const prompt = `Based on the following tour description, suggest a concise tour name. Description: "${input}". Respond with only the suggested name.`;
                        const suggestedName = await GeminiService.getResponse(prompt);
                        if (suggestedName && suggestedName.trim()) result.name = suggestedName.trim();
                    } else if (field === 'city' && !result.cityId) {
                        const prompt = `From the description "${input}", identify the primary city or location. Respond with only the city name.`;
                        const suggestedCityName = await GeminiService.getResponse(prompt);
                        if (suggestedCityName && suggestedCityName.trim()) {
                            const cityMatch = cities.find(c => 
                                c.name.toLowerCase().includes(suggestedCityName.trim().toLowerCase()) || 
                                suggestedCityName.trim().toLowerCase().includes(c.name.toLowerCase())
                            );
                            if (cityMatch) result.cityId = cityMatch.id;
                        }
                    } else if (field === 'language' && !result.language) {
                        const prompt = `From the description "${input}", identify the main language being taught or used. Respond with only the language name.`;
                        const suggestedLangName = await GeminiService.getResponse(prompt);
                        if (suggestedLangName && suggestedLangName.trim()) {
                            const langMatch = languages.find(l => 
                                l.toLowerCase().includes(suggestedLangName.trim().toLowerCase()) || 
                                suggestedLangName.trim().toLowerCase().includes(l.toLowerCase())
                            );
                            if (langMatch) result.language = langMatch;
                        }
                    } else if (field === 'tourType' && !result.tourType) {
                        const prompt = `Based on the description "${input}", is this a tour guided by a person or an app? Respond with only "person" or "app".`;
                        const suggestedTourType = await GeminiService.getResponse(prompt);
                        if (suggestedTourType && suggestedTourType.trim().toLowerCase() === 'person') {
                            result.tourType = 'person';
                        } else if (suggestedTourType && suggestedTourType.trim().toLowerCase() === 'app') {
                            result.tourType = 'app';
                        }
                    }
                } catch (error) {
                    console.error(`Error getting suggestion for ${field} from Gemini:`, error);
                }
            }
        }
        
        return result;
    };
    

    
    // Handle user input submission
    const handleSubmit = async () => {
        if (!userInput.trim()) return;
        
        const userMessage = userInput;
        userInput = '';
        isWaitingForResponse = true;
        
        // Add user message to the conversation
        messages = [...messages, { role: 'user', content: userMessage }];
        
        // Extract tour information from the user's input with AI assistance
        const tourInfo = await extractTourInfo(userMessage);
        
        // Update tour data with extracted and AI-suggested information
        tour.name = tourInfo.name || tour.name;
        tour.cityId = tourInfo.cityId || tour.cityId;
        tour.language = tourInfo.language || tour.language;
        tour.description = tourInfo.description;
        tour.tourType = tourInfo.tourType || tour.tourType;
        tour.price = tourInfo.price || tour.price;
        
        // Set price based on tour type
        if (tour.tourType === 'app') {
            tour.price = 0;
        } else if (tour.tourType === 'person' && tourInfo.price) {
            tour.price = tourInfo.price;
        } else if (tour.tourType === 'person' && !tour.price) {
            tour.price = 24; // Default price for person-guided tours
        }
        
        // Skip the detailed analysis feedback to keep the experience simple
        
        // Show review of all information
        const cityName = cities.find(c => c.id === tour.cityId)?.name || 'Not specified';
        const languageName = tour.language || 'Not specified';
        
        // Create a simple confirmation message without detailed feedback
        const reviewMessage = "I've filled in the form based on your description. Please review and make any changes before creating the tour.";
        
        setTimeout(() => {
            messages = [...messages, { role: 'ai', content: reviewMessage }];
            isFormComplete = true;
            isWaitingForResponse = false;
        }, 1000);
        
        isWaitingForResponse = false;
    };
    
    // Handle form submission
    const handleCreateTour = () => {
        isSubmitting = true;
        dispatch('submit', tour);
    };
    
    // Handle cancel
    const handleCancel = () => {
        dispatch('cancel');
    };
    
</script>

<div class="bg-white shadow-md rounded-lg p-6">

    {#if !isFormComplete}
        <!-- User input area -->
        <div class="mb-6">
            <form on:submit|preventDefault={handleSubmit} class="flex">
                <input
                    type="text"
                    bind:value={userInput}
                    placeholder="Type your response..."
                    class="flex-grow shadow appearance-none border rounded-l py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    disabled={isWaitingForResponse}
                />
                <button
                    type="submit"
                    class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-r focus:outline-none focus:shadow-outline"
                    disabled={isWaitingForResponse || !userInput.trim()}
                >
                    Send
                </button>
            </form>
        </div>
    {:else}
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
                <label for="tour-language" class="block text-gray-700 text-sm font-bold mb-2">Language</label>
                <select
                    id="tour-language"
                    bind:value={tour.language}
                    class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                >
                    {#each languages as language}
                        <option value={language}>{language}</option>
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
                {#if isFormComplete && !tour.tourType}
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
    {/if}
    
    <!-- Action buttons -->
    <div class="flex items-center justify-between">
        <button
            type="button"
            on:click={handleCreateTour}
            class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline flex items-center"
            disabled={isSubmitting || !isFormComplete || !tour.tourType}
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
