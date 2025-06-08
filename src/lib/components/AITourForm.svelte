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
        tourType: ''
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
    
    // Language difficulty levels
    const difficultyLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    
    // Tour type options with display labels and values
    const tourTypes = [
        { value: 'person', label: 'Guided tour by a person' },
        { value: 'app', label: 'Guided tour by the app' }
    ];
    
    // AI conversation state
    let userInput = '';
    let messages: { role: 'ai' | 'user', content: string }[] = [];
    let isWaitingForResponse = false;
    let isFormComplete = false;
    let isSubmitting = false;
    
    // Track what we've collected
    let collectedName = false;
    let collectedLanguagePair = false; // Added for language pair
    let collectedDifficulty = false;
    let collectedDescription = false;
    
    // Start the conversation
    onMount(() => {
        messages = [
            { role: 'ai', content: "What's the name of your tour?" }
        ];
    });
    
    // Extract tour name from user input
    const extractTourName = async (input: string): Promise<string | null> => {
        try {
            // Use GeminiService to extract the actual tour name
            const prompt = `Extract ONLY the actual tour name from this text: "${input}"
            
            If the name is in quotes, extract just the text within the quotes.
            If the user says something like "the name is X" or "call it X", extract just X.
            Return ONLY the extracted name, nothing else.`;
            
            const extractedName = await GeminiService.getResponse(prompt);
            const lowerExtractedName = extractedName.toLowerCase();
            // Check for common failure patterns or excessive length
            if (lowerExtractedName.includes("cannot extract") || 
                lowerExtractedName.includes("not a tour name") || 
                lowerExtractedName.includes("unable to determine") || 
                extractedName.length > 75) { // Heuristic for overly long/descriptive responses not being a name
                return null; // Indicate failure to extract a valid name
            }
            return extractedName.trim();
        } catch (error) {
            console.error('Error extracting tour name:', error);
            // Fallback to simple extraction if API call fails, or return null to re-prompt
            const quotedText = input.match(/["']([^"']+)["']/);
            if (quotedText && quotedText[1]) {
                const name = quotedText[1].trim();
                if (name.length < 75) return name; // Basic validation for fallback
            }
            return null; // Indicate failure if fallback also doesn't yield a good name
        }
    };
    
    // Extract difficulty level from user input
    const extractDifficulty = (input: string): string => {
        const upperInput = input.toUpperCase();
        for (const level of difficultyLevels) {
            if (upperInput.includes(level)) {
                return level;
            }
        }
        return '';
    };

    // Extract language pair from user input using Gemini
    const extractLanguagePair = async (input: string): Promise<string | null> => {
        try {
            const prompt = `From the following text, identify the language to be learned and the language of instruction. Format the response as "LanguageLearned, LanguageOfInstruction". For example, if the text is "I want to teach people German, and I'll speak English", respond with "German, English". If you cannot clearly determine both, respond with "unknown". Text: "${input}"`;
            const extractedPair = await GeminiService.getResponse(prompt);
            
            if (extractedPair.toLowerCase().includes('unknown')) {
                return null;
            }

            // Normalize Gemini's response for matching (e.g., trim, capitalize parts)
            const parts = extractedPair.split(',').map(p => p.trim());
            if (parts.length === 2) {
                const normalizedPair = parts.map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(', ');
                // Check if this normalized pair exists in our predefined list
                const foundPair = languagePairs.find(lp => lp.toLowerCase() === normalizedPair.toLowerCase());
                if (foundPair) return foundPair;

                // Fallback: Check if Gemini's direct output (trimmed) is in the list
                const directMatch = languagePairs.find(lp => lp.toLowerCase() === extractedPair.trim().toLowerCase());
                if (directMatch) return directMatch;
            }
            return null; // No match found or format incorrect
        } catch (error) {
            console.error('Error extracting language pair:', error);
            return null;
        }
    };

    // Check if description mentions a specific place using GeminiService
    const checkDescriptionForPlace = async (description: string): Promise<boolean> => {
        try {
            const prompt = `Does the following tour description mention at least one place, landmark, or address? Answer with only 'yes' or 'no'. Description: "${description}"`;
            const response = await GeminiService.getResponse(prompt);
            return response.trim().toLowerCase() === 'yes';
        } catch (error) {
            console.error('Error checking description for place:', error);
            // In case of API error, allow user to proceed but log the error.
            messages = [...messages, { role: 'ai', content: "I had a little trouble verifying the place in the description, but let's proceed. You can refine it in the form below." }];
            return true; // Or false to be stricter
        }
    };
    
    // Handle user input submission
    const handleSubmit = async () => {
        if (!userInput.trim() || isWaitingForResponse) return;
        
        const userMessage = userInput;
        userInput = '';
        
        messages = [...messages, { role: 'user', content: userMessage }];
        isWaitingForResponse = true;
        
        try {
            if (!collectedName) {
                const name = await extractTourName(userMessage);
                if (name && name.trim() !== '') { // Check if name is not null and not empty
                    tour.name = name;
                    collectedName = true;
                    messages = [...messages, { role: 'ai', content: "Great! Which language will be learned, and which language will be used for instruction? For example, 'Learn German, instruction in English'." }];
                } else {
                    tour.name = ''; // Clear any previous potentially bad name
                    messages = [...messages, { role: 'ai', content: "That doesn't seem like a valid tour name. Could you please provide a clear name for your tour?" }];
                }
            } else if (!collectedLanguagePair) {
                const extractedPair = await extractLanguagePair(userMessage);
                if (extractedPair) {
                    tour.language = extractedPair;
                    collectedLanguagePair = true;
                    messages = [...messages, { role: 'ai', content: "Understood. Now, what language difficulty level? (A1, A2, B1, B2, C1, or C2)" }];
                } else {
                    tour.language = ''; // Clear any previous attempt
                    messages = [...messages, { role: 'ai', content: "I couldn't quite determine the language pair from that. Could you please state it as 'Learn X, taught in Y', or choose from the options later?" }];
                }
            } else if (!collectedDifficulty) {
                const difficulty = extractDifficulty(userMessage);
                if (difficulty) {
                    tour.langDifficulty = difficulty;
                    collectedDifficulty = true;
                    messages = [...messages, { role: 'ai', content: "Great! Now please provide a brief description of where the tour will go to" }];
                } else {
                    messages = [...messages, { role: 'ai', content: "Please choose a difficulty level: A1, A2, B1, B2, C1, or C2" }];
                }
            } else if (!collectedDescription) {
                const descriptionInput = userMessage.trim();
                if (descriptionInput) {
                    const hasSpecificPlace = await checkDescriptionForPlace(descriptionInput);
                    if (hasSpecificPlace) {
                        tour.description = descriptionInput;
                        collectedDescription = true;
                        isFormComplete = true;
                        messages = [...messages, { role: 'ai', content: "Excellent! Here's a summary. Please review and fill out any remaining details below to complete your tour." }];
                    } else {
                        messages = [...messages, { role: 'ai', content: "Your description is helpful, but could you please mention at least one specific place, landmark, or address that will be part of the tour? This helps potential participants understand the tour better." }];
                    }
                } else {
                    messages = [...messages, { role: 'ai', content: "Please provide a brief description of your tour." }];
                }
            }
        } catch (error) {
            console.error('Error processing input:', error);
            messages = [...messages, { role: 'ai', content: "Sorry, I had trouble understanding. Could you try again?" }];
        } finally {
            isWaitingForResponse = false;
        }
    };
    
    // Handle form submission
    const handleCreateTour = () => {
        isSubmitting = true;
        dispatch('submit', tour);
    };
    
    // Handle cancellation
    const handleCancel = () => {
        dispatch('cancel');
    };
    
    // Handle Enter key press
    const handleKeyPress = (event: KeyboardEvent) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleSubmit();
        }
    };
</script>

<div class="bg-white shadow-md rounded-lg p-6">
    <!-- Map picker section -->
    <div class="mb-8">
        <h3 class="text-lg font-medium mb-2">Select Tour Starting Point</h3>
        <p class="text-sm text-gray-600 mb-4">Use the map to select the location for your tour.</p>
        <SimpleMapPicker bind:value={tour.cityId} />
    </div>
    
    <!-- AI Conversation Area -->
    <div class="mb-6">
        <h3 class="text-lg font-medium mb-2">Tour Setup Assistant</h3>
        <div class="bg-gray-50 rounded-lg p-4 overflow-y-auto mb-4">
            {#each messages as message}
                <div class="mb-3 {message.role === 'user' ? 'text-right' : 'text-left'}">
                    <span class="inline-block px-4 py-2 rounded-lg {message.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'}">
                        {message.content}
                    </span>
                </div>
            {/each}
            {#if isWaitingForResponse}
                <div class="text-left mb-3">
                    <span class="inline-block px-4 py-2 rounded-lg bg-gray-200 text-gray-800">
                        <span class="inline-block animate-pulse">Thinking...</span>
                    </span>
                </div>
            {/if}
        </div>
        
        {#if !isFormComplete}
            <div class="flex gap-2">
                <input
                    type="text"
                    bind:value={userInput}
                    on:keypress={handleKeyPress}
                    placeholder="Type your answer..."
                    class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isWaitingForResponse}
                />
                <button
                    type="button"
                    on:click={handleSubmit}
                    disabled={!userInput.trim() || isWaitingForResponse}
                    class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                    Send
                </button>
            </div>
        {/if}
    </div>
    
    {#if isFormComplete}
        <!-- Form review and edit area - only visible when all components collected -->
        <div class="mb-6 grid grid-cols-1 gap-4">
            <div>
                <label for="tour-name" class="block text-gray-700 text-sm font-bold mb-2">Tour Name</label>
                <input type="text" id="tour-name" bind:value={tour.name} class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline">
            </div>
            <div>
                <label for="tour-language-pair" class="block text-gray-700 text-sm font-bold mb-2">Language Pair (Learned, Taught In)</label>
                <select id="tour-language-pair" bind:value={tour.language} class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" required>
                    <option value="">Select language pair</option>
                    {#each languagePairs as lp}
                        <option value={lp}>{lp}</option>
                    {/each}
                </select>
            </div>
            
            <div>
                <label for="lang-difficulty" class="block text-gray-700 text-sm font-bold mb-2">Language Difficulty</label>
                <select
                    id="lang-difficulty"
                    bind:value={tour.langDifficulty}
                    class="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    required
                >
                    {#each difficultyLevels as level}
                        <option value={level}>{level}</option>
                    {/each}
                </select>
            </div>
            
            <div>
                <label for="tour-type" class="block text-gray-700 text-sm font-bold mb-2">Tour Type</label>
                <select
                    id="tour-type"
                    bind:value={tour.tourType}
                    class="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    required
                >
                    <option value="">Select tour type</option>
                    {#each tourTypes as type}
                        <option value={type.value}>{type.label}</option>
                    {/each}
                </select>
            </div>
            

            
            <div>
                <label for="description" class="block text-gray-700 text-sm font-bold mb-2">Description</label>
                <textarea
                    id="description"
                    bind:value={tour.description}
                    rows="4"
                    class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    placeholder="Describe your tour..."
                    required
                ></textarea>
            </div>
            
            <div>
                <label for="image-url" class="block text-gray-700 text-sm font-bold mb-2">Image URL (optional)</label>
                <input
                    id="image-url"
                    type="url"
                    bind:value={tour.imageUrl}
                    class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    placeholder="https://example.com/image.jpg"
                />
            </div>
        </div>
    {/if}
    
    <!-- Action buttons -->
    <div class="flex items-center justify-between">
        <button
            type="button"
            on:click={handleCreateTour}
            class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline flex items-center"
            disabled={!isFormComplete || isSubmitting}
        >
            {#if isSubmitting}
                <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
        >
            Cancel
        </button>
    </div>
</div>
