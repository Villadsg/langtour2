<script lang="ts">
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { ConvexService, currentUser } from '$lib/firebaseService';
    import { citiesStore } from '$lib/stores/tourStore';
    import { getTourData, getStops } from '$lib/tourValidation';
    import type { TourStop, StopFact } from '$lib/firebase/types';

    const tourId = $page.params.tourId as string;

    let tour: any = null;
    let creatorId: string | null = null;
    let isLoading = true;
    let error = '';
    let isSaving = false;

    // Step tracking: 'prompt' -> 'paste' -> 'preview'
    let step: 'prompt' | 'paste' | 'preview' = 'prompt';
    let generatedPrompt = '';
    let pastedJson = '';
    let parseError = '';
    let copied = false;

    // Parsed results per stop
    interface StopResult {
        stopId: string;
        placeName: string;
        facts: StopFact[];
    }
    let stopResults: StopResult[] = [];

    // Tour metadata for prompt building
    let stopInfos: { id: string; placeName: string; placeType: string }[] = [];
    let languageTaught = '';
    let instructionLanguage = 'English';
    let cefrLevel = '';
    let cityName = '';

    onMount(async () => {
        try {
            const response = await ConvexService.getTour(tourId);
            if (!response?.data) {
                error = 'Trail not found';
                isLoading = false;
                return;
            }
            tour = response.data;
            creatorId = await ConvexService.getTourCreatorId(tour?.id || tour?.$id || '');

            if (!$currentUser || $currentUser.id !== creatorId) {
                goto(`/tours/${tourId}`);
                return;
            }

            const tourData = getTourData(tour);
            const stops = getStops(tour);
            cityName = getCityName(tourData.cityId);
            languageTaught = tourData.languageTaught || '';
            instructionLanguage = tourData.instructionLanguage || 'English';
            cefrLevel = tourData.langDifficulty || '';

            stopInfos = stops.map(s => ({
                id: s.id,
                placeName: s.location?.placeName || s.location?.address || `Stop ${s.order}`,
                placeType: s.location?.placeType || ''
            }));

            // Auto-generate the prompt
            generatedPrompt = buildPrompt();
        } catch (err: any) {
            error = err.message || 'Failed to load tour';
        } finally {
            isLoading = false;
        }
    });

    function getCityName(cityId: string): string {
        const cities = $citiesStore;
        const city = cities.find(c => c.id === cityId);
        return city ? city.name : '';
    }

    function buildPrompt(): string {
        const stopList = stopInfos.map((s, i) =>
            `  ${i + 1}. "${s.placeName}"${s.placeType ? ` (${s.placeType})` : ''}`
        ).join('\n');

        const levelHint = cefrLevel
            ? `The learner is at ${cefrLevel} level.`
            : '';

        return `I am creating language learning material for a walking trail in ${cityName}.
The learner speaks ${instructionLanguage} and is learning ${languageTaught}. ${levelHint}

The trail has ${stopInfos.length} stops:
${stopList}

For EACH stop, write 4 interesting facts about the place. Each fact should be:
- Written in ${languageTaught} (1-3 sentences)
- Categorized as one of: "cultural", "historical", "linguistic", "geographical"
- Include 4 key vocabulary words from the fact in ${languageTaught} with ${instructionLanguage} translations

Respond ONLY with valid JSON in this exact format:

{
  "stops": [
    {
      "placeName": "Name of stop 1",
      "facts": [
        {
          "text": "Fact text in ${languageTaught}...",
          "category": "cultural",
          "keywords": [
            { "word": "word in ${languageTaught}", "translation": "translation in ${instructionLanguage}" },
            { "word": "word2", "translation": "translation2" },
            { "word": "word3", "translation": "translation3" },
            { "word": "word4", "translation": "translation4" }
          ]
        }
      ]
    }
  ]
}

Important:
- Each stop must have exactly 4 facts
- Each fact must have exactly 4 keywords
- Facts must be written in ${languageTaught}
- Keywords translations must be in ${instructionLanguage}
- category must be one of: "cultural", "historical", "linguistic", "geographical"
- Use a variety of categories across the 4 facts
- Respond with ONLY the JSON, no other text`;
    }

    function handleCopy() {
        navigator.clipboard.writeText(generatedPrompt);
        copied = true;
        setTimeout(() => { copied = false; }, 2000);
    }

    function handleGoToPaste() {
        step = 'paste';
    }

    const VALID_CATEGORIES = ['cultural', 'historical', 'linguistic', 'geographical'];

    function handleParse() {
        parseError = '';
        try {
            let jsonStr = pastedJson.trim();

            // Try to extract JSON from markdown code blocks
            const codeBlockMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
            if (codeBlockMatch) {
                jsonStr = codeBlockMatch[1].trim();
            }

            const parsed = JSON.parse(jsonStr);

            if (!parsed.stops || !Array.isArray(parsed.stops)) {
                parseError = 'Invalid format: expected a "stops" array in the JSON.';
                return;
            }

            if (parsed.stops.length !== stopInfos.length) {
                parseError = `Expected ${stopInfos.length} stops but got ${parsed.stops.length}. You can still import — stops will be matched by order.`;
            }

            // Map parsed stops to our stop IDs
            stopResults = [];
            const count = Math.min(parsed.stops.length, stopInfos.length);
            for (let i = 0; i < count; i++) {
                const pStop = parsed.stops[i];
                const facts: StopFact[] = [];

                if (pStop.facts && Array.isArray(pStop.facts)) {
                    for (const f of pStop.facts) {
                        if (f.text && typeof f.text === 'string') {
                            const category = VALID_CATEGORIES.includes(f.category) ? f.category : 'cultural';
                            const keywords = Array.isArray(f.keywords)
                                ? f.keywords
                                    .filter((k: any) => k.word && k.translation)
                                    .map((k: any) => ({ word: k.word, translation: k.translation }))
                                : [];
                            facts.push({ text: f.text, category, keywords });
                        }
                    }
                }

                stopResults.push({
                    stopId: stopInfos[i].id,
                    placeName: stopInfos[i].placeName,
                    facts
                });
            }

            if (stopResults.every(s => s.facts.length === 0)) {
                parseError = 'No valid facts found in the pasted JSON. Check the format and try again.';
                stopResults = [];
                return;
            }

            step = 'preview';
        } catch (e: any) {
            parseError = `JSON parse error: ${e.message}`;
        }
    }

    async function handleSave() {
        if (!tour) return;
        isSaving = true;

        try {
            const tourData = getTourData(tour);
            const stops = getStops(tour);

            const updatedStops = stops.map(stop => {
                const result = stopResults.find(r => r.stopId === stop.id);
                if (result && result.facts.length > 0) {
                    return {
                        ...stop,
                        teachingMaterial: {
                            ...(stop.teachingMaterial || {
                                vocabulary: [],
                                dialogues: [],
                                generatedAt: 0,
                                languageTaught: languageTaught,
                                instructionLanguage: instructionLanguage,
                                cefrLevel: cefrLevel
                            }),
                            facts: result.facts,
                            generatedAt: Date.now()
                        }
                    };
                }
                return stop;
            });

            const updatePayload: any = {
                description: {
                    ...tourData,
                    stops: updatedStops
                }
            };

            await ConvexService.updateTour(tour.id || tour.$id, updatePayload);
            goto(`/tours/${tourId}/prepare`);
        } catch (err: any) {
            error = err.message || 'Failed to save facts';
        } finally {
            isSaving = false;
        }
    }

    function categoryColor(category: string): string {
        switch (category) {
            case 'historical': return 'bg-blue-50 border-blue-200 text-blue-800';
            case 'cultural': return 'bg-amber-50 border-amber-200 text-amber-800';
            case 'linguistic': return 'bg-purple-50 border-purple-200 text-purple-800';
            case 'geographical': return 'bg-emerald-50 border-emerald-200 text-emerald-800';
            default: return 'bg-amber-50 border-amber-200 text-amber-800';
        }
    }

    function categoryLabel(category: string): string {
        return category.charAt(0).toUpperCase() + category.slice(1);
    }

    $: totalFacts = stopResults.reduce((sum, s) => sum + s.facts.length, 0);
</script>

<div class="container mx-auto px-4 py-8 max-w-4xl">
    {#if isLoading}
        <div class="flex justify-center items-center h-64">
            <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-400"></div>
        </div>
    {:else if error && !tour}
        <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert">
            <p>{error}</p>
        </div>
    {:else if tour}
        {@const tourData = getTourData(tour)}

        <!-- Back link -->
        <a href="/tours/{tourId}" class="inline-flex items-center gap-1 text-sm text-green-700 hover:text-green-800 mb-6">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to trail
        </a>

        <!-- Header -->
        <div class="bg-white border border-slate-200 rounded-lg p-6 mb-8">
            <h1 class="text-2xl font-bold text-slate-900">{tourData.name}</h1>
            <p class="text-sm text-slate-500 mt-1">Generate Preparation Material</p>

            <!-- Step indicator -->
            <div class="flex items-center gap-2 mt-4">
                {#each ['Copy Prompt', 'Paste Result', 'Preview & Save'] as label, i}
                    {@const stepIndex = i}
                    {@const currentIndex = step === 'prompt' ? 0 : step === 'paste' ? 1 : 2}
                    <div class="flex items-center gap-2">
                        <span class="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold
                            {stepIndex <= currentIndex ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-500'}">
                            {stepIndex < currentIndex ? '✓' : stepIndex + 1}
                        </span>
                        <span class="text-sm {stepIndex === currentIndex ? 'font-medium text-slate-900' : 'text-slate-400'}">
                            {label}
                        </span>
                        {#if i < 2}
                            <div class="w-8 h-px {stepIndex < currentIndex ? 'bg-green-400' : 'bg-slate-200'}"></div>
                        {/if}
                    </div>
                {/each}
            </div>
        </div>

        {#if error}
            <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert">
                <p>{error}</p>
            </div>
        {/if}

        <!-- Step 1: Copy Prompt -->
        {#if step === 'prompt'}
            <div class="bg-white border border-slate-200 rounded-lg p-6 mb-6">
                <h2 class="text-lg font-semibold text-slate-900 mb-2">Step 1: Copy the prompt</h2>
                <p class="text-sm text-slate-600 mb-4">
                    Copy this prompt and paste it into any AI chatbot (ChatGPT, Claude, Gemini, etc.). The AI will generate facts and vocabulary for each stop on your trail.
                </p>

                <div class="relative">
                    <pre class="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-700 overflow-x-auto whitespace-pre-wrap max-h-96 overflow-y-auto">{generatedPrompt}</pre>
                    <button
                        on:click={handleCopy}
                        class="absolute top-2 right-2 inline-flex items-center gap-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium py-1.5 px-3 rounded-md shadow-sm transition-colors"
                    >
                        {#if copied}
                            <svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                            Copied!
                        {:else}
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                            </svg>
                            Copy
                        {/if}
                    </button>
                </div>

                <div class="mt-4 flex gap-3">
                    <button
                        on:click={handleCopy}
                        class="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 px-5 rounded-lg transition-colors"
                    >
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                        </svg>
                        {copied ? 'Copied!' : 'Copy Prompt'}
                    </button>
                    <button
                        on:click={handleGoToPaste}
                        class="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2.5 px-5 rounded-lg transition-colors"
                    >
                        Next: Paste Result
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>
            </div>
        {/if}

        <!-- Step 2: Paste JSON Result -->
        {#if step === 'paste'}
            <div class="bg-white border border-slate-200 rounded-lg p-6 mb-6">
                <h2 class="text-lg font-semibold text-slate-900 mb-2">Step 2: Paste the AI response</h2>
                <p class="text-sm text-slate-600 mb-4">
                    Copy the JSON response from your AI chatbot and paste it below. It should contain a "stops" array with facts for each stop.
                </p>

                <textarea
                    bind:value={pastedJson}
                    placeholder="Paste the JSON response here..."
                    class="w-full h-64 bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-700 font-mono resize-y focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                ></textarea>

                {#if parseError}
                    <div class="mt-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                        {parseError}
                    </div>
                {/if}

                <div class="mt-4 flex gap-3">
                    <button
                        on:click={() => { step = 'prompt'; parseError = ''; }}
                        class="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2.5 px-5 rounded-lg transition-colors"
                    >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                        Back to Prompt
                    </button>
                    <button
                        on:click={handleParse}
                        disabled={!pastedJson.trim()}
                        class="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 px-5 rounded-lg transition-colors"
                    >
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        Import &amp; Preview
                    </button>
                </div>
            </div>
        {/if}

        <!-- Step 3: Preview & Save -->
        {#if step === 'preview'}
            <div class="bg-white border border-slate-200 rounded-lg p-6 mb-6">
                <div class="flex items-center justify-between mb-4">
                    <div>
                        <h2 class="text-lg font-semibold text-slate-900">Step 3: Review & Save</h2>
                        <p class="text-sm text-slate-500 mt-1">{totalFacts} facts across {stopResults.filter(s => s.facts.length > 0).length} stops</p>
                    </div>
                    <div class="flex gap-3">
                        <button
                            on:click={() => { step = 'paste'; }}
                            class="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2 px-4 rounded-lg transition-colors text-sm"
                        >
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
                            </svg>
                            Re-paste
                        </button>
                        <button
                            on:click={handleSave}
                            disabled={isSaving}
                            class="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 px-5 rounded-lg transition-colors"
                        >
                            {#if isSaving}
                                <div class="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                                Saving...
                            {:else}
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                </svg>
                                Save to Trail
                            {/if}
                        </button>
                    </div>
                </div>
            </div>

            <!-- Stop cards with facts preview -->
            <div class="space-y-4">
                {#each stopResults as result, i}
                    <div class="bg-white border border-slate-200 rounded-lg overflow-hidden">
                        <!-- Stop header -->
                        <div class="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
                            <div class="flex items-center gap-3">
                                <span class="inline-flex items-center justify-center w-7 h-7 bg-green-600 text-white font-bold text-xs rounded-full">
                                    {i + 1}
                                </span>
                                <span class="font-medium text-slate-800">{result.placeName}</span>
                            </div>
                            <span class="text-sm text-slate-500">{result.facts.length} fact{result.facts.length !== 1 ? 's' : ''}</span>
                        </div>

                        {#if result.facts.length > 0}
                            <div class="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {#each result.facts as fact}
                                    <div class="border rounded-lg p-3 {categoryColor(fact.category)}">
                                        <span class="inline-block text-xs font-semibold uppercase tracking-wide mb-1">{categoryLabel(fact.category)}</span>
                                        <p class="text-sm">{fact.text}</p>
                                        {#if fact.keywords && fact.keywords.length > 0}
                                            <div class="mt-2 pt-2 border-t border-current/10">
                                                <p class="text-xs font-medium mb-1">Key vocabulary</p>
                                                <div class="space-y-0.5">
                                                    {#each fact.keywords as kw}
                                                        <div class="flex items-baseline gap-2 text-sm">
                                                            <span class="font-semibold">{kw.word}</span>
                                                            <span class="text-xs opacity-50">--</span>
                                                            <span class="opacity-75">{kw.translation}</span>
                                                        </div>
                                                    {/each}
                                                </div>
                                            </div>
                                        {/if}
                                    </div>
                                {/each}
                            </div>
                        {:else}
                            <div class="px-4 py-3 text-sm text-amber-600">No facts generated for this stop</div>
                        {/if}
                    </div>
                {/each}
            </div>

            <!-- Bottom save button -->
            <div class="mt-6 flex justify-end">
                <button
                    on:click={handleSave}
                    disabled={isSaving}
                    class="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 px-5 rounded-lg transition-colors"
                >
                    {#if isSaving}
                        <div class="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                        Saving...
                    {:else}
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        Save to Trail
                    {/if}
                </button>
            </div>
        {/if}
    {/if}
</div>
