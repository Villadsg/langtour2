<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import { GeminiService } from '$lib/geminiService';
    import SimpleMapPicker from './SimpleMapPicker.svelte';
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
    
    // Keep track of user responses for generating cohesive description later
    let userResponses: string[] = [];
    
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
    
    // Parse tour information from user input and get AI suggestions for missing fields
    const extractTourInfo = async (input: string): Promise<{ name: string, cityId: string, language: string, langDifficulty?: string, description: string, tourType: string, price: number }> => {
        const result = { name: '', cityId: '', language: '', langDifficulty: '', description: input, tourType: '', price: 0 };
        
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
        // Set location/city as already available since we have the map picker
        requiredInfo.location = true;
        
        // Use a greeting that acknowledges the map picker
        const greeting = `Hello! Please describe your language learning tour plan, target language, difficulty level (A1-C2), and other details. You can later decide when to schedule the tour`;
        messages = [{ role: 'ai', content: greeting }];
    };
    
    // Check if description contains required information
    const checkDescriptionCompleteness = (description: string): void => {
        // Check for language pair information
        requiredInfo.languagePair = requiredInfo.languagePair || 
            Boolean(tour.language) || 
            /learn\s+\w+|taught\s+in\s+\w+|speaking\s+\w+/i.test(description);
        
        // Check for vocabulary focus
        requiredInfo.vocabularyFocus = requiredInfo.vocabularyFocus || 
            /vocabulary|phrases|grammar|expressions|words|speaking|conversation/i.test(description);
        
        // Check for location information
        requiredInfo.location = requiredInfo.location || 
            /visit|location|spot|place|area|district|neighborhood|street|museum|park|cafe|restaurant/i.test(description);
        
        // Check for duration information
        requiredInfo.duration = requiredInfo.duration || 
            /duration|hours?|minutes?|days?|weeks?|time|length/i.test(description);
        
        // Check for difficulty level
        requiredInfo.difficultyLevel = requiredInfo.difficultyLevel || 
            Boolean(tour.langDifficulty) || 
            /\b(A1|A2|B1|B2|C1|C2)\b|beginner|elementary|intermediate|advanced|proficient/i.test(description);
        
        // Update all required info collected flag
        allRequiredInfoCollected = Object.values(requiredInfo).every(value => value === true);
    };
    
    // Helper function to get current tour info for Gemini
    const getCurrentTourInfo = () => {
        return {
            name: tour.name,
            cityId: tour.cityId ? cities.find(c => c.id === tour.cityId)?.name || tour.cityId : undefined,
            language: tour.language,
            langDifficulty: tour.langDifficulty,
            tourType: tour.tourType
        };
    };
    
    // Track conversation state
    let conversationState = 'initial'; // initial, collecting_info, reviewing
    let questionCount = 0;
    let allRequiredInfoCollected = false;
    
    // The required information for a complete tour description
    const requiredInfo = {
        vocabularyFocus: false,  // A specific vocabulary focus
        languagePair: false,    // Which language to learn and in which it is taught
        location: false,        // At least one specific spot to visit
        duration: false,        // Expected tour duration
        difficultyLevel: false  // Language difficulty level
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
        
        // Save user response for later cohesive description
        userResponses.push(userMessage);
        
        // First, correct spelling and grammar in the user's input
        const correctedText = await GeminiService.correctText(userMessage);
        
        if (conversationState === 'initial') {
            // First message - change state to collecting info
            conversationState = 'collecting_info';
            questionCount = 1;
            
            // Extract tour information from the corrected text with AI assistance
            const tourInfo = await extractTourInfo(correctedText);
            
            // Update tour data with extracted and AI-suggested information
            tour.name = tourInfo.name || tour.name;
            tour.cityId = tourInfo.cityId || tour.cityId;
            tour.language = tourInfo.language || tour.language;
            tour.description = correctedText; // Start with first response as description
            tour.tourType = tourInfo.tourType || tour.tourType;
            
            // Set price based on tour type
            if (tour.tourType === 'app') {
                tour.price = 0;
            } else if (tour.tourType === 'person' && tourInfo.price) {
                tour.price = tourInfo.price;
            } else if (tour.tourType === 'person' && !tour.price) {
                tour.price = 25; // Default price for person-guided tours
            }
            
            // Check for required information in the initial description
            checkDescriptionCompleteness(correctedText);
            
            // Since we have the map picker, we consider city information already accessible
            requiredInfo.location = true;
            
            // Use Gemini to generate a contextual follow-up question, but indicate we don't need city info
            const followUpQuestion = await GeminiService.generateFollowUpQuestion(
                correctedText,
                {...getCurrentTourInfo(), cityAvailable: true}
            );
            
            // Send the follow-up question
            setTimeout(() => {
                messages = [...messages, { role: 'ai', content: followUpQuestion }];
                isWaitingForResponse = false;
            }, 1000);
        }
        else if (conversationState === 'collecting_info') {
            // Add this response to our description
            tour.description += "\n\n" + correctedText;
            questionCount++;
            
            // Re-check completeness with the new information
            checkDescriptionCompleteness(tour.description);
            
            // Extract additional info that might be in the response
            const tourInfo = await extractTourInfo(correctedText);
            
            // Update any newly provided information
            if (tourInfo.name && !tour.name) tour.name = tourInfo.name;
            if (tourInfo.cityId && !tour.cityId) tour.cityId = tourInfo.cityId;
            if (tourInfo.language && !tour.language) tour.language = tourInfo.language;
            
            // Extract difficulty level if present
            if (!tour.langDifficulty) {
                const difficultyRegex = /\b(A1|A2|B1|B2|C1|C2)\b/i;
                const difficultyMatch = correctedText.match(difficultyRegex);
                if (difficultyMatch) {
                    tour.langDifficulty = difficultyMatch[0].toUpperCase();
                    requiredInfo.difficultyLevel = true;
                } else {
                    // Try to infer difficulty from level descriptions
                    const levelDescriptions = {
                        beginner: 'A1',
                        elementary: 'A2',
                        intermediate: 'B1',
                        'upper intermediate': 'B2',
                        advanced: 'C1',
                        proficient: 'C2',
                        fluent: 'C2'
                    };
                    
                    for (const [desc, level] of Object.entries(levelDescriptions)) {
                        if (correctedText.toLowerCase().includes(desc)) {
                            tour.langDifficulty = level;
                            requiredInfo.difficultyLevel = true;
                            break;
                        }
                    }
                }
            }
            
            // Determine next action based on information completeness
            if (allRequiredInfoCollected && questionCount >= 3) {
                // We have enough information and have asked enough questions
                // Generate a cohesive description from all collected information
                const cohesiveDescription = await GeminiService.createCohesiveDescription({
                    name: tour.name,
                    cityId: tour.cityId ? cities.find(c => c.id === tour.cityId)?.name || tour.cityId : undefined,
                    language: tour.language,
                    langDifficulty: tour.langDifficulty,
                    tourType: tour.tourType,
                    userResponses: userResponses
                });
                
                // Update the tour description with the cohesive version
                tour.description = cohesiveDescription;
                
                // Move to reviewing state
                conversationState = 'reviewing';
                isFormComplete = true;
                
                // Provide a summary of the tour
                const cityName = tour.cityId ? cities.find(c => c.id === tour.cityId)?.name || tour.cityId : 'Not specified';
                const summaryMessage = `Perfect! I've created a complete tour description based on our conversation.\n\n${tour.name ? `Name: ${tour.name}\n` : ''}City: ${cityName}\nLanguage: ${tour.language || 'Not specified'}\nDifficulty Level: ${tour.langDifficulty || 'Not specified'}\n\nYou can review and edit all the details below before creating the tour.`;
                
                setTimeout(() => {
                    messages = [...messages, { role: 'ai', content: summaryMessage }];
                    isWaitingForResponse = false;
                }, 1000);
            } 
            else if (questionCount >= 5) {
                // We've asked enough questions, move on even if not all info is collected
                // Generate a cohesive description from what we have
                const cohesiveDescription = await GeminiService.createCohesiveDescription({
                    name: tour.name,
                    cityId: tour.cityId ? cities.find(c => c.id === tour.cityId)?.name || tour.cityId : undefined,
                    language: tour.language,
                    langDifficulty: tour.langDifficulty,
                    tourType: tour.tourType,
                    userResponses: userResponses
                });
                
                // Update the tour description with the cohesive version
                tour.description = cohesiveDescription;
                
                // Move to reviewing state
                conversationState = 'reviewing';
                isFormComplete = true;
                
                // Identify what's still missing
                const missingItems = [];
                if (!tour.name) missingItems.push('name');
                if (!tour.cityId) missingItems.push('city');
                if (!tour.language) missingItems.push('language pair');
                if (!tour.langDifficulty) missingItems.push('difficulty level');
                if (!requiredInfo.vocabularyFocus) missingItems.push('vocabulary focus');
                if (!requiredInfo.location) missingItems.push('locations to visit');
                if (!requiredInfo.duration) missingItems.push('tour duration');
                
                const cityName = tour.cityId ? cities.find(c => c.id === tour.cityId)?.name || tour.cityId : 'Not specified';
                let summaryMessage = `Thanks for all the information! I've created a tour description based on our conversation.\n\n${tour.name ? `Name: ${tour.name}\n` : ''}City: ${cityName}\nLanguage: ${tour.language || 'Not specified'}\nDifficulty Level: ${tour.langDifficulty || 'Not specified'}`;
                
                if (missingItems.length > 0) {
                    summaryMessage += `\n\nYou can still add the following details in the form below: ${missingItems.join(', ')}.`;
                }
                
                setTimeout(() => {
                    messages = [...messages, { role: 'ai', content: summaryMessage }];
                    isWaitingForResponse = false;
                }, 1000);
            }
            else {
                // We need more information, generate another question
                const followUpQuestion = await GeminiService.generateFollowUpQuestion(
                    tour.description,
                    getCurrentTourInfo()
                );
                
                setTimeout(() => {
                    messages = [...messages, { role: 'ai', content: followUpQuestion }];
                    isWaitingForResponse = false;
                }, 1000);
            }
        }
        else if (conversationState === 'reviewing') {
            // User is providing additional feedback after the form is complete
            // Add to the description
            tour.description += "\n\n" + correctedText;
            
            // Regenerate the cohesive description with the new information
            userResponses.push(correctedText);
            const updatedDescription = await GeminiService.createCohesiveDescription({
                name: tour.name,
                cityId: tour.cityId ? cities.find(c => c.id === tour.cityId)?.name || tour.cityId : undefined,
                language: tour.language,
                langDifficulty: tour.langDifficulty,
                tourType: tour.tourType,
                userResponses: userResponses
            });
            
            // Update the tour description
            tour.description = updatedDescription;
            
            const responseMessage = `I've updated the tour description with your additional information. Feel free to make any edits in the form below before creating the tour.`;
            
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
    <!-- Map picker section -->
    <div class="mb-8">
        <h3 class="text-lg font-medium mb-2">Select Tour Starting Point</h3>
        <p class="text-sm text-gray-600 mb-4">Use the map to select the location for your tour.</p>
        <div class="max-w-full h-[300px]">
            <SimpleMapPicker bind:value={tour.cityId} required />
        </div>
    </div>

    <!-- AI conversation section -->
    <div class="mb-8">
        <h3 class="text-lg font-medium mb-2">Describe Your Tour</h3>
        <p class="text-sm text-gray-600 mb-4">Tell us about your language learning tour and we'll help you create it.</p>
        
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
                    placeholder="Type the tour description here..."
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
            
            <!-- City field removed as we're using the map coordinates directly -->
            
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
