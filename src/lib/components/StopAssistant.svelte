<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { GeminiService } from '$lib/geminiService';
    import type { TourStop, TeachingMaterial, VocabularyItem, Dialogue } from '$lib/firebase/types';

    export let stop: TourStop;
    export let tourContext: {
        languageTaught: string;
        instructionLanguage: string;
        cefrLevel: string;
        tourName?: string;
        tourDescription?: string;
    };

    const dispatch = createEventDispatcher();

    // Conversation state
    let userInput = '';
    let messages: { role: 'ai' | 'user', content: string }[] = [];
    let isWaitingForResponse = false;

    // Content being built
    let vocabulary: VocabularyItem[] = stop.teachingMaterial?.vocabulary || [];
    let dialogues: Dialogue[] = stop.teachingMaterial?.dialogues || [];

    // Editing state
    let editingVocabIndex: number | null = null;
    let editingDialogueIndex: number | null = null;

    // Initialize conversation
    $: if (messages.length === 0) {
        const placeName = stop.location.placeName || 'this stop';
        const placeType = stop.location.placeType || 'location';
        messages = [{
            role: 'ai',
            content: `Let's create teaching material for "${placeName}" (${placeType}). I'll help you build vocabulary and dialogues for ${tourContext.languageTaught} learners at ${tourContext.cefrLevel} level.\n\nYou can:\n- Ask me to suggest vocabulary related to this place\n- Ask for specific words or phrases\n- Request dialogues for common scenarios\n- Say "generate suggestions" for automatic content\n\nWhat would you like to start with?`
        }];
    }

    // Handle user message
    async function handleSubmit() {
        if (!userInput.trim() || isWaitingForResponse) return;

        const userMessage = userInput.trim();
        userInput = '';
        messages = [...messages, { role: 'user', content: userMessage }];
        isWaitingForResponse = true;

        try {
            const response = await processUserRequest(userMessage);
            messages = [...messages, { role: 'ai', content: response }];
        } catch (error) {
            console.error('Error processing request:', error);
            messages = [...messages, { role: 'ai', content: "Sorry, I had trouble processing that. Could you try again?" }];
        } finally {
            isWaitingForResponse = false;
        }
    }

    // Process user request with AI
    async function processUserRequest(input: string): Promise<string> {
        const lowerInput = input.toLowerCase();
        const placeName = stop.location.placeName || 'this location';
        const placeType = stop.location.placeType || 'location';

        // Check for auto-generate request
        if (lowerInput.includes('generate') || lowerInput.includes('suggest') || lowerInput.includes('auto')) {
            return await generateSuggestions();
        }

        // Check for vocabulary request
        if (lowerInput.includes('vocab') || lowerInput.includes('word') || lowerInput.includes('phrase')) {
            return await generateVocabularyFromRequest(input);
        }

        // Check for dialogue request
        if (lowerInput.includes('dialog') || lowerInput.includes('conversation') || lowerInput.includes('scenario')) {
            return await generateDialogueFromRequest(input);
        }

        // General request - let AI interpret
        const prompt = `You are helping create language learning material for a tour stop.

CONTEXT:
- Stop: ${placeName} (${placeType})
- Address: ${stop.location.address || 'Unknown'}
- Language to teach: ${tourContext.languageTaught}
- Instructions in: ${tourContext.instructionLanguage}
- CEFR Level: ${tourContext.cefrLevel}
- Tour: ${tourContext.tourName || 'Language tour'}

USER REQUEST: "${input}"

Based on the user's request, help them create appropriate teaching material. You can:
1. Suggest vocabulary items (word, translation, example sentence)
2. Suggest dialogue scenarios
3. Answer questions about what content might work well for this stop
4. Provide teaching tips

Be helpful, specific, and keep your response concise. If you suggest vocabulary or dialogues, format them clearly.`;

        const response = await GeminiService.getResponse(prompt);
        return response;
    }

    // Generate automatic suggestions
    async function generateSuggestions(): Promise<string> {
        const placeName = stop.location.placeName || 'this location';
        const placeType = stop.location.placeType || 'location';

        try {
            const material = await GeminiService.generateStopContent(stop, tourContext);

            if (material.vocabulary.length > 0) {
                vocabulary = [...vocabulary, ...material.vocabulary];
            }
            if (material.dialogues.length > 0) {
                dialogues = [...dialogues, ...material.dialogues];
            }

            updateTeachingMaterial();

            return `I've generated content for "${placeName}":\n\n` +
                `- ${material.vocabulary.length} vocabulary items added\n` +
                `- ${material.dialogues.length} dialogues added\n\n` +
                `You can see them in the panels on the right. Feel free to ask me to add more specific vocabulary or dialogues, or edit what's there!`;
        } catch (error) {
            console.error('Error generating suggestions:', error);
            return "I had trouble generating content automatically. Could you tell me what specific vocabulary or dialogues you'd like?";
        }
    }

    // Generate vocabulary from user request
    async function generateVocabularyFromRequest(request: string): Promise<string> {
        const placeName = stop.location.placeName || 'this location';
        const placeType = stop.location.placeType || 'location';

        const prompt = `Generate vocabulary items for a language learning tour stop.

CONTEXT:
- Stop: ${placeName} (${placeType})
- Language to teach: ${tourContext.languageTaught}
- Instructions in: ${tourContext.instructionLanguage}
- CEFR Level: ${tourContext.cefrLevel}

USER REQUEST: "${request}"

Generate 3-6 vocabulary items based on the user's request. Return ONLY valid JSON in this format:
{
  "vocabulary": [
    {
      "word": "word in ${tourContext.languageTaught}",
      "translation": "translation in ${tourContext.instructionLanguage}",
      "pronunciation": "phonetic (optional)",
      "context": "Example sentence using the word"
    }
  ],
  "message": "A brief friendly message about the vocabulary you generated"
}`;

        try {
            const response = await GeminiService.getStructuredResponse(prompt, 1500);
            let jsonStr = response.trim();
            if (jsonStr.startsWith('```')) {
                jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
            }

            const parsed = JSON.parse(jsonStr);

            if (parsed.vocabulary && parsed.vocabulary.length > 0) {
                vocabulary = [...vocabulary, ...parsed.vocabulary];
                updateTeachingMaterial();
                return `${parsed.message || 'Added vocabulary!'}\n\nI've added ${parsed.vocabulary.length} new words. You can see them in the vocabulary panel.`;
            }

            return "I couldn't generate vocabulary for that request. Could you be more specific?";
        } catch (error) {
            console.error('Error generating vocabulary:', error);
            return "I had trouble generating that vocabulary. Could you try rephrasing your request?";
        }
    }

    // Generate dialogue from user request
    async function generateDialogueFromRequest(request: string): Promise<string> {
        const placeName = stop.location.placeName || 'this location';
        const placeType = stop.location.placeType || 'location';

        const prompt = `Generate a dialogue for a language learning tour stop.

CONTEXT:
- Stop: ${placeName} (${placeType})
- Language to teach: ${tourContext.languageTaught}
- Instructions in: ${tourContext.instructionLanguage}
- CEFR Level: ${tourContext.cefrLevel}

USER REQUEST: "${request}"

Generate 1 dialogue (4-8 lines) based on the user's request. Return ONLY valid JSON in this format:
{
  "dialogue": {
    "title": "Dialogue title in ${tourContext.instructionLanguage}",
    "participants": ["Person A", "Person B"],
    "lines": [
      {
        "speaker": "Person A",
        "text": "Line in ${tourContext.languageTaught}",
        "translation": "Translation in ${tourContext.instructionLanguage}"
      }
    ]
  },
  "message": "A brief friendly message about the dialogue"
}`;

        try {
            const response = await GeminiService.getStructuredResponse(prompt, 2000);
            let jsonStr = response.trim();
            if (jsonStr.startsWith('```')) {
                jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
            }

            const parsed = JSON.parse(jsonStr);

            if (parsed.dialogue) {
                dialogues = [...dialogues, parsed.dialogue];
                updateTeachingMaterial();
                return `${parsed.message || 'Added dialogue!'}\n\nI've added a new dialogue: "${parsed.dialogue.title}". You can see it in the dialogues panel.`;
            }

            return "I couldn't generate a dialogue for that request. Could you be more specific?";
        } catch (error) {
            console.error('Error generating dialogue:', error);
            return "I had trouble generating that dialogue. Could you try rephrasing your request?";
        }
    }

    // Update the teaching material in the stop
    function updateTeachingMaterial() {
        const material: TeachingMaterial = {
            vocabulary,
            dialogues,
            generatedAt: Date.now(),
            languageTaught: tourContext.languageTaught,
            instructionLanguage: tourContext.instructionLanguage,
            cefrLevel: tourContext.cefrLevel
        };
        dispatch('update', { stopId: stop.id, teachingMaterial: material });
    }

    // Delete vocabulary item
    function deleteVocab(index: number) {
        vocabulary = vocabulary.filter((_, i) => i !== index);
        updateTeachingMaterial();
    }

    // Delete dialogue
    function deleteDialogue(index: number) {
        dialogues = dialogues.filter((_, i) => i !== index);
        updateTeachingMaterial();
    }

    // Handle Enter key
    function handleKeyPress(event: KeyboardEvent) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleSubmit();
        }
    }

    // Close the assistant
    function handleClose() {
        dispatch('close');
    }

    // Save and close
    function handleSave() {
        updateTeachingMaterial();
        dispatch('close');
    }
</script>

<div class="stop-assistant bg-white border border-slate-200 rounded-lg shadow-lg max-h-[85vh] flex flex-col">
    <!-- Header -->
    <div class="flex items-center justify-between p-4 border-b border-slate-200 flex-shrink-0">
        <div>
            <h3 class="text-lg font-semibold text-gray-900">
                {stop.location.placeName || 'Stop'} - Content Assistant
            </h3>
            <p class="text-sm text-gray-500">
                {tourContext.languageTaught} ({tourContext.cefrLevel}) - {stop.location.placeType || 'Location'}
            </p>
        </div>
        <button
            type="button"
            on:click={handleClose}
            class="p-1.5 text-gray-400 hover:text-gray-600"
        >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
        </button>
    </div>

    <!-- Main content area -->
    <div class="flex-1 overflow-hidden flex">
        <!-- Left: Chat -->
        <div class="w-1/2 flex flex-col border-r border-slate-200">
            <!-- Messages -->
            <div class="flex-1 overflow-y-auto p-4 space-y-3">
                {#each messages as message}
                    <div class="flex {message.role === 'user' ? 'justify-end' : 'justify-start'}">
                        <div class="max-w-[85%] px-3 py-2 rounded-lg text-sm whitespace-pre-wrap {message.role === 'user' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
                            {message.content}
                        </div>
                    </div>
                {/each}
                {#if isWaitingForResponse}
                    <div class="flex justify-start">
                        <div class="px-3 py-2 rounded-lg bg-gray-100 text-gray-800 text-sm">
                            <span class="animate-pulse">Thinking...</span>
                        </div>
                    </div>
                {/if}
            </div>

            <!-- Input -->
            <div class="p-3 border-t border-slate-200 flex-shrink-0">
                <div class="flex gap-2">
                    <input
                        type="text"
                        bind:value={userInput}
                        on:keypress={handleKeyPress}
                        placeholder="Ask for vocabulary, dialogues, or say 'generate suggestions'..."
                        class="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
                        disabled={isWaitingForResponse}
                    />
                    <button
                        type="button"
                        on:click={handleSubmit}
                        disabled={!userInput.trim() || isWaitingForResponse}
                        class="px-4 py-2 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    >
                        Send
                    </button>
                </div>
            </div>
        </div>

        <!-- Right: Content panels -->
        <div class="w-1/2 flex flex-col overflow-hidden">
            <!-- Vocabulary panel -->
            <div class="flex-1 overflow-y-auto p-4 border-b border-slate-200">
                <h4 class="font-medium text-gray-800 mb-3 flex items-center justify-between">
                    <span>Vocabulary ({vocabulary.length})</span>
                </h4>
                {#if vocabulary.length === 0}
                    <p class="text-sm text-gray-500 italic">No vocabulary yet. Ask me to suggest some!</p>
                {:else}
                    <div class="space-y-2">
                        {#each vocabulary as item, index}
                            <div class="bg-gray-50 rounded p-2 text-sm group relative">
                                <div class="flex items-start justify-between">
                                    <div>
                                        <span class="font-medium text-green-700">{item.word}</span>
                                        {#if item.pronunciation}
                                            <span class="text-gray-400 text-xs ml-1">[{item.pronunciation}]</span>
                                        {/if}
                                        <span class="text-gray-500 mx-1">-</span>
                                        <span class="text-gray-700">{item.translation}</span>
                                    </div>
                                    <button
                                        type="button"
                                        on:click={() => deleteVocab(index)}
                                        class="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-600 transition-opacity"
                                        title="Delete"
                                    >
                                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                                {#if item.context}
                                    <p class="text-xs text-gray-500 mt-1 italic">"{item.context}"</p>
                                {/if}
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>

            <!-- Dialogues panel -->
            <div class="flex-1 overflow-y-auto p-4">
                <h4 class="font-medium text-gray-800 mb-3">
                    Dialogues ({dialogues.length})
                </h4>
                {#if dialogues.length === 0}
                    <p class="text-sm text-gray-500 italic">No dialogues yet. Ask me to create one!</p>
                {:else}
                    <div class="space-y-3">
                        {#each dialogues as dialogue, dIndex}
                            <div class="bg-gray-50 rounded p-3 text-sm group relative">
                                <div class="flex items-start justify-between mb-2">
                                    <h5 class="font-medium text-gray-800">{dialogue.title}</h5>
                                    <button
                                        type="button"
                                        on:click={() => deleteDialogue(dIndex)}
                                        class="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-600 transition-opacity"
                                        title="Delete"
                                    >
                                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                                <div class="space-y-1">
                                    {#each dialogue.lines as line}
                                        <div class="pl-2 border-l-2 {line.speaker === dialogue.participants[0] ? 'border-blue-400' : 'border-green-400'}">
                                            <p class="text-xs text-gray-500">{line.speaker}</p>
                                            <p class="text-gray-800">{line.text}</p>
                                            <p class="text-xs text-gray-500 italic">{line.translation}</p>
                                        </div>
                                    {/each}
                                </div>
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>
        </div>
    </div>

    <!-- Footer -->
    <div class="flex items-center justify-between p-4 border-t border-slate-200 bg-gray-50 flex-shrink-0">
        <div class="text-sm text-gray-500">
            {vocabulary.length} vocabulary items, {dialogues.length} dialogues
        </div>
        <div class="flex gap-2">
            <button
                type="button"
                on:click={handleClose}
                class="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
                Cancel
            </button>
            <button
                type="button"
                on:click={handleSave}
                class="px-4 py-2 text-sm bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
            >
                Save Content
            </button>
        </div>
    </div>
</div>
