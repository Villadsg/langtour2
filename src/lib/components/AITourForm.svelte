<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import { GeminiService } from '$lib/geminiService';
    import type { Tour } from '$lib/stores/tourStore';
    
    export let tour = {
        name: '',
        cityId: '',
        language: '',
        langDifficulty: '',
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
    
    // Language pair options (language to learn, prerequisite language)
    const languagePairs = [
        'Danish, English',
        'Spanish, English',
        'English, Spanish',
        'French, English',
        'Italian, English',
        'German, English',
        'Spanish, French',
        'French, Spanish',
        'Danish, Spanish',
        'Spanish, Danish'
    ];
    
    // Individual languages for extraction from text
    const languages = ['Danish', 'Spanish', 'English', 'French', 'German', 'Italian'];
    
    // Language difficulty levels
    const difficultyLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    
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
    
    // Only show form when all required components have been collected
    $: isFormComplete = false; // This will now be controlled exclusively by the conversation flow
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
        let primaryLanguage = '';
        let secondaryLanguage = '';
        
        // First try to find the language to learn
        for (const lang of languages) {
            const learnRegex = new RegExp(`learn\\s+${lang}|${lang}\\s+learn|studying\\s+${lang}|${lang}\\s+course`, 'i');
            if (learnRegex.test(input) || input.toLowerCase().includes(`learn ${lang.toLowerCase()}`)) {
                primaryLanguage = lang;
                break;
            }
        }
        
        // If no primary language found, try to find any language mentioned
        if (!primaryLanguage) {
            for (const lang of languages) {
                if (input.toLowerCase().includes(lang.toLowerCase())) {
                    primaryLanguage = lang;
                    break;
                }
            }
        }
        
        // Try to find prerequisite language
        const prerequisiteRegex = /prerequisite|fluent in|knowledge of|speaking|fluency/i;
        if (prerequisiteRegex.test(input)) {
            for (const lang of languages) {
                if (primaryLanguage !== lang && input.toLowerCase().includes(lang.toLowerCase())) {
                    secondaryLanguage = lang;
                    break;
                }
            }
        }
        
        // If we found both languages, create a pair
        if (primaryLanguage && secondaryLanguage) {
            result.language = `${primaryLanguage}, ${secondaryLanguage}`;
        } else if (primaryLanguage) {
            // If only primary language found, default to English as prerequisite if it's not the primary
            result.language = primaryLanguage !== 'English' ? `${primaryLanguage}, English` : 'English, Spanish';
        }
        
        // Check for difficulty level
        const difficultyRegex = /\b(A1|A2|B1|B2|C1|C2)\b/i;
        const difficultyMatch = input.match(difficultyRegex);
        if (difficultyMatch) {
            result.langDifficulty = difficultyMatch[0].toUpperCase();
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
                result.price = 25; // Default price if not specified
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
            const suggestions = await GeminiService.generateSuggestions(input, missingFields);
            
            // Apply suggestions
            if (suggestions.name && !result.name) {
                result.name = suggestions.name;
            }
            
            if (suggestions.city && !result.cityId) {
                // Find the city ID from the name
                const cityMatch = cities.find(c => 
                    c.name.toLowerCase().includes(suggestions.city.toLowerCase()) || 
                    suggestions.city.toLowerCase().includes(c.name.toLowerCase())
                );
                if (cityMatch) {
                    result.cityId = cityMatch.id;
                }
            }
            
            if (suggestions.language && !result.language) {
                // Find the exact language from our list
                const langMatch = languages.find(l => 
                    l.toLowerCase().includes(suggestions.language.toLowerCase()) || 
                    suggestions.language.toLowerCase().includes(l.toLowerCase())
                );
                if (langMatch) {
                    // Default to English as prerequisite if it's not the primary
                    result.language = langMatch !== 'English' ? `${langMatch}, English` : 'English, Spanish';
                }
            }
        }
        
        return result;
    };
    
    // Start the conversation with the AI
    const startConversation = async () => {
        // Use a simpler greeting as requested
        const greeting = `Hello! Please describe your language learning tour plan, language difficulty and more.`;
        messages = [{ role: 'ai', content: greeting }];
    };
    
    // Track conversation state
    let conversationState = 'initial'; // initial, analyzing, asking_for_components, reviewing
    let missingComponents: string[] = [];
    let currentMissingComponent: string | null = null;
    let tourDescriptionUpdated = false;
    
    // Define the essential components that need to be checked
    const essentialComponents = [
        'language_element', // A specific language learning element or vocabulary focus
        'language_city_prerequisites', // Which language to learn, in which city, and prerequisites
        'locations', // At least two specific spots to visit
        'duration', // Expected tour duration
        'difficulty_level' // Language difficulty level (A1, A2, B1, B2, C1, C2)
    ];
    
    // Helper function to get a friendly prompt for each missing component
    const getComponentPrompt = (component: string): string => {
        switch(component) {
            case 'language_element':
                return 'What specific language learning element or vocabulary focus will this tour have?';
            case 'language_city_prerequisites':
                return 'Which language will be learned, in which city, and is there any prerequisite language knowledge needed?';
            case 'locations':
                return 'What are at least two specific spots that will be visited during this tour?';
            case 'duration':
                return 'What is the expected duration of this tour?';
            case 'difficulty_level':
                return 'Which language difficulty level is practiced? (A1, A2, B1, B2, C1, C2)';
            default:
                return 'Could you provide more details about your tour?';
        }
    };
    
    // Helper function to get descriptions for language levels
    const getLevelDescription = (level: string): string => {
        switch(level) {
            case 'A1':
                return 'Beginner (basic phrases and expressions)';
            case 'A2':
                return 'Elementary (familiar, everyday expressions)';
            case 'B1':
                return 'Intermediate (main points on familiar matters)';
            case 'B2':
                return 'Upper Intermediate (complex text, technical discussion)';
            case 'C1':
                return 'Advanced (complex, implicit meaning)';
            case 'C2':
                return 'Proficient (near-native fluency)';
            default:
                return '';
        }
    };
    
    // Handle user input submission
    const handleSubmit = async () => {
        if (!userInput.trim()) return;
        
        const userMessage = userInput;
        userInput = '';
        isWaitingForResponse = true;
        
        // Add user message to the conversation
        messages = [...messages, { role: 'user', content: userMessage }];
        
        // First, correct spelling and grammar in the user's input
        const correctedText = await GeminiService.correctText(userMessage);
        
        if (conversationState === 'initial') {
            // First message - we need to extract initial tour info and analyze for missing components
            conversationState = 'analyzing';
            
            // Extract tour information from the corrected text with AI assistance
            const tourInfo = await extractTourInfo(correctedText);
            
            // Update tour data with extracted and AI-suggested information
            tour.name = tourInfo.name || tour.name;
            tour.cityId = tourInfo.cityId || tour.cityId;
            tour.language = tourInfo.language || tour.language;
            tour.description = tourInfo.description;
            tour.tourType = tourInfo.tourType || tour.tourType;
            
            // Set price based on tour type
            if (tour.tourType === 'app') {
                tour.price = 0;
            } else if (tour.tourType === 'person' && tourInfo.price) {
                tour.price = tourInfo.price;
            } else if (tour.tourType === 'person' && !tour.price) {
                tour.price = 25; // Default price for person-guided tours
            }
            
            // Analyze the description to identify missing components
            const analysis = await GeminiService.analyzeTourDescription(tour.description);
            
            // Check for missing components based on the essential components list
            missingComponents = [];
            
            // Extract missing components from analysis response
            if (analysis.response && analysis.response.includes('MISSING COMPONENTS')) {
                const missingComponentsMatch = analysis.response.match(/MISSING COMPONENTS:\s*(.+?)(?=(\n|Feedback:))/s);
                if (missingComponentsMatch && missingComponentsMatch[1]) {
                    const missingText = missingComponentsMatch[1].toLowerCase();
                    
                    // Map the analysis text to our component identifiers
                    if (missingText.includes('language learning element') || missingText.includes('vocabulary')) {
                        missingComponents.push('language_element');
                    }
                    if (missingText.includes('language to learn') || missingText.includes('city') || missingText.includes('prerequisite')) {
                        missingComponents.push('language_city_prerequisites');
                    }
                    if (missingText.includes('spots') || missingText.includes('locations')) {
                        missingComponents.push('locations');
                    }
                    if (missingText.includes('duration')) {
                        missingComponents.push('duration');
                    }
                    if (missingText.includes('difficulty level') || missingText.includes('a1') || missingText.includes('a2') || 
                        missingText.includes('b1') || missingText.includes('b2') || missingText.includes('c1') || missingText.includes('c2')) {
                        missingComponents.push('difficulty_level');
                    }
                }
            }
            
            // If we have a difficulty level in the text but it's not set in the tour object, extract it
            if (!tour.langDifficulty) {
                const difficultyRegex = /\b(A1|A2|B1|B2|C1|C2)\b/i;
                const difficultyMatch = tour.description.match(difficultyRegex);
                if (difficultyMatch) {
                    tour.langDifficulty = difficultyMatch[0].toUpperCase();
                    // Remove difficulty level from missing components if it's now set
                    missingComponents = missingComponents.filter(comp => comp !== 'difficulty_level');
                }
            }
            
            if (missingComponents.length > 0) {
                // Move to asking for missing components one by one
                conversationState = 'asking_for_components';
                currentMissingComponent = missingComponents[0];
                
                // Ask for the first missing component with a specific prompt
                const requestComponentMessage = `Thanks for the information! Let's add a few more details to make your tour complete.\n\n${getComponentPrompt(currentMissingComponent)}`;
                
                setTimeout(() => {
                    messages = [...messages, { role: 'ai', content: requestComponentMessage }];
                    isWaitingForResponse = false;
                }, 1000);
                return;
            } else {
                // If no missing components, move to reviewing
                conversationState = 'reviewing';
                isFormComplete = true;
                
                // Provide a summary of the tour
                const summaryMessage = `Great! I've gathered all the information for your tour:\n\n${tour.name ? `Name: ${tour.name}\n` : ''}${tour.cityId ? `City: ${cities.find(c => c.id === tour.cityId)?.name || tour.cityId}\n` : ''}${tour.language ? `Language: ${tour.language}\n` : ''}\nYour description looks good! You can review and edit the details below before creating the tour.`;
                
                setTimeout(() => {
                    messages = [...messages, { role: 'ai', content: summaryMessage }];
                    isWaitingForResponse = false;
                }, 1000);
            }
        }
        else if (conversationState === 'asking_for_components') {
            // User is providing information about a missing component
            // Update the description with this new information
            tour.description += `\n\n${currentMissingComponent}: ${correctedText}`;
            tourDescriptionUpdated = true;
            
            // Remove the current component from the missing list
            missingComponents = missingComponents.filter(c => c !== currentMissingComponent);
            
            if (missingComponents.length > 0) {
                // Move to the next missing component
                currentMissingComponent = missingComponents[0];
                
                // Ask for the next missing component with a specific prompt
                const requestNextComponentMessage = `Thank you! ${missingComponents.length > 1 ? 'We still need a few more details' : 'Just one more detail needed'}.\n\n${getComponentPrompt(currentMissingComponent)}`;
                
                setTimeout(() => {
                    messages = [...messages, { role: 'ai', content: requestNextComponentMessage }];
                    isWaitingForResponse = false;
                }, 1000);
            } else {
                // All components have been provided
                conversationState = 'reviewing';
                isFormComplete = true;
                
                // Provide a summary of the tour with all the collected information
                const summaryMessage = `Excellent! I have all the information needed for your tour:\n\n${tour.name ? `Name: ${tour.name}\n` : ''}${tour.cityId ? `City: ${cities.find(c => c.id === tour.cityId)?.name || tour.cityId}\n` : ''}${tour.language ? `Language: ${tour.language}\n` : ''}\nYour description is complete with all the necessary elements. You can review and edit the details below before creating the tour.`;
                
                setTimeout(() => {
                    messages = [...messages, { role: 'ai', content: summaryMessage }];
                    isWaitingForResponse = false;
                }, 1000);
            }
        }
        else if (conversationState === 'reviewing') {
            // User is providing additional feedback or questions after the form is complete
            const responseMessage = `I've noted your additional feedback. You can edit any of the tour details below before creating the tour.`;
            
            setTimeout(() => {
                messages = [...messages, { role: 'ai', content: responseMessage }];
                isWaitingForResponse = false;
            }, 1000);
        }
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
    
    // Start the conversation when the component mounts
    onMount(() => {
        startConversation();
    });
</script>

<div class="bg-white shadow-md rounded-lg p-6">
    <!-- AI conversation area -->
    <div class="mb-6 max-h-96 overflow-y-auto p-4 bg-gray-50 rounded-lg">
        {#each messages as message}
            <div class="mb-4 {message.role === 'ai' ? 'text-left' : 'text-right'}">
                <div class="inline-block max-w-3/4 p-3 rounded-lg {message.role === 'ai' ? 'bg-blue-100 text-blue-800' : 'bg-gray-200 text-gray-800'}">
                    {#if message.role === 'ai' && message.feedback}
                        <div class="mb-2">
                            {#if message.feedback === 'excellent'}
                                <span class="text-green-600 font-bold">✓ Excellent!</span>
                            {:else if message.feedback === 'good'}
                                <span class="text-yellow-600 font-bold">⚠ Good</span>
                            {:else if message.feedback === 'needs_improvement'}
                                <span class="text-red-600 font-bold">✗ Needs Improvement</span>
                            {/if}
                        </div>
                    {/if}
                    <div class="whitespace-pre-line">{message.content}</div>
                </div>
            </div>
        {/each}
        
        {#if isWaitingForResponse}
            <div class="flex justify-start mb-4">
                <div class="bg-blue-100 text-blue-800 p-3 rounded-lg">
                    <div class="flex items-center">
                        <div class="w-2 h-2 bg-blue-600 rounded-full mr-1 animate-bounce"></div>
                        <div class="w-2 h-2 bg-blue-600 rounded-full mr-1 animate-bounce" style="animation-delay: 0.2s"></div>
                        <div class="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style="animation-delay: 0.4s"></div>
                    </div>
                </div>
            </div>
        {/if}
    </div>
    
    <!-- User input area - always visible -->
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
    
    {#if isFormComplete}
        <!-- Form review and edit area - only visible when all components collected -->
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
                <label for="tour-language" class="block text-gray-700 text-sm font-bold mb-2">Language Pair (Learn, Prerequisite)</label>
                <select
                    id="tour-language"
                    bind:value={tour.language}
                    class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                >
                    <option value="" disabled>Select language pair</option>
                    {#each languagePairs as langPair}
                        <option value={langPair}>{langPair.split(',')[0]} (learn) with {langPair.split(',')[1].trim()} (prerequisite)</option>
                    {/each}
                </select>
            </div>
            
            <div>
                <label for="tour-difficulty" class="block text-gray-700 text-sm font-bold mb-2">Language Difficulty Level</label>
                <select
                    id="tour-difficulty"
                    bind:value={tour.langDifficulty}
                    class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                >
                    <option value="" disabled>Select difficulty level</option>
                    {#each difficultyLevels as level}
                        <option value={level}>{level} - {getLevelDescription(level)}</option>
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
                Create Tour
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
