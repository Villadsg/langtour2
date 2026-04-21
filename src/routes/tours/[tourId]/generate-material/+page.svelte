<script lang="ts">
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { ConvexService, currentUser } from '$lib/firebaseService';
    import { citiesStore } from '$lib/stores/tourStore';
    import { getTourData, getStops } from '$lib/tourValidation';
    import type { FactKeyword } from '$lib/firebase/types';

    const tourId = $page.params.tourId as string;

    let tour: any = null;
    let creatorId: string | null = null;
    let isLoading = true;
    let error = '';
    let isSaving = false;

    let step: 'prompt' | 'paste' | 'preview' = 'prompt';
    let generatedPrompt = '';
    let pastedJson = '';
    let parseError = '';
    let copied = false;

    interface StopResult {
        stopId: string;
        placeName: string;
        keywords: FactKeyword[];
        teacherPlan: string;
    }
    let stopResults: StopResult[] = [];

    let stopInfos: { id: string; placeName: string; placeType: string }[] = [];
    let languageTaught = '';
    let instructionLanguage = 'English';
    let cefrLevel = '';
    let cityName = '';

    onMount(async () => {
        try {
            const response = await ConvexService.getTour(tourId);
            if (!response?.data) {
                error = 'Route not found';
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

        const levelHint = cefrLevel ? `The learner is at ${cefrLevel} level.` : '';

        return `I am creating preparation material for a walking language tour in ${cityName}.
The learner speaks ${instructionLanguage} and is learning ${languageTaught}. ${levelHint}

The route has ${stopInfos.length} stops:
${stopList}

For EACH stop, produce TWO things:

1. "keywords": 6-10 key words or short phrases that will come up when the guide talks at that stop. Each keyword is a word/phrase in ${languageTaught} with its ${instructionLanguage} translation. Pick words that are specific and evocative enough that a student who studies them before the tour can GUESS what the guide will talk about — but don't give the whole story away.

2. "teacherPlan": a concise plan (3-6 sentences, written in ${instructionLanguage}) for the guide describing what to talk about at the stop. This must use/touch every keyword above so the keywords are a faithful preview of the talk. Only the guide will see this; students will only see the keywords and have to guess.

Respond ONLY with valid JSON in this exact format:

{
  "stops": [
    {
      "placeName": "Name of stop 1",
      "keywords": [
        { "word": "word in ${languageTaught}", "translation": "translation in ${instructionLanguage}" }
      ],
      "teacherPlan": "Plan for the guide in ${instructionLanguage}, 3-6 sentences, referencing the keywords above."
    }
  ]
}

Important:
- One entry per stop, in the same order as listed above
- 6-10 keywords per stop
- Keywords are in ${languageTaught}, translations in ${instructionLanguage}
- teacherPlan is written in ${instructionLanguage}
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

    function handleSkipToManual() {
        stopResults = stopInfos.map(s => ({
            stopId: s.id,
            placeName: s.placeName,
            keywords: [{ word: '', translation: '' }],
            teacherPlan: ''
        }));
        step = 'preview';
    }

    function addKeyword(i: number) {
        stopResults[i].keywords = [...stopResults[i].keywords, { word: '', translation: '' }];
        stopResults = stopResults;
    }
    function removeKeyword(stopIdx: number, kwIdx: number) {
        stopResults[stopIdx].keywords = stopResults[stopIdx].keywords.filter((_, i) => i !== kwIdx);
        stopResults = stopResults;
    }

    function handleParse() {
        parseError = '';
        try {
            let jsonStr = pastedJson.trim();
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
                parseError = `Expected ${stopInfos.length} stops but got ${parsed.stops.length}. Stops will be matched by order.`;
            }

            stopResults = [];
            const count = Math.min(parsed.stops.length, stopInfos.length);
            for (let i = 0; i < count; i++) {
                const pStop = parsed.stops[i];
                const keywords: FactKeyword[] = Array.isArray(pStop.keywords)
                    ? pStop.keywords
                        .filter((k: any) => k && k.word && k.translation)
                        .map((k: any) => ({ word: String(k.word), translation: String(k.translation) }))
                    : [];
                const teacherPlan: string = typeof pStop.teacherPlan === 'string' ? pStop.teacherPlan.trim() : '';

                stopResults.push({
                    stopId: stopInfos[i].id,
                    placeName: stopInfos[i].placeName,
                    keywords,
                    teacherPlan
                });
            }

            if (stopResults.every(s => s.keywords.length === 0 && !s.teacherPlan)) {
                parseError = 'No keywords or plans found in the pasted JSON. Check the format and try again.';
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
                if (result && (result.keywords.length > 0 || result.teacherPlan)) {
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
                            keywords: result.keywords,
                            teacherPlan: result.teacherPlan,
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
            error = err.message || 'Failed to save material';
        } finally {
            isSaving = false;
        }
    }

    $: totalKeywords = stopResults.reduce((sum, s) => sum + s.keywords.length, 0);
    $: stopsWithPlan = stopResults.filter(s => s.teacherPlan).length;
</script>

<div class="container mx-auto px-4 py-8 max-w-4xl">
    {#if isLoading}
        <div class="flex justify-center items-center h-64">
            <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-slate-300"></div>
        </div>
    {:else if error && !tour}
        <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert">
            <p>{error}</p>
        </div>
    {:else if tour}
        {@const tourData = getTourData(tour)}

        <a href="/tours/{tourId}" class="inline-flex items-center gap-1 text-sm text-slate-700 hover:text-slate-800 mb-6">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to route
        </a>

        <div class="bg-white border border-slate-200 rounded-lg p-6 mb-8">
            <h1 class="text-2xl font-bold text-slate-900">{tourData.name}</h1>
            <p class="text-sm text-slate-500 mt-1">Generate preparation material</p>
            <p class="text-sm text-slate-600 mt-3 max-w-2xl">
                For each stop, the AI will produce key words (shown to students so they can guess what the tour will cover) and a private plan for you, the guide, describing what to talk about at the stop.
            </p>

            <div class="flex items-center gap-2 mt-4">
                {#each ['Copy Prompt', 'Paste Result', 'Preview & Save'] as label, i}
                    {@const stepIndex = i}
                    {@const currentIndex = step === 'prompt' ? 0 : step === 'paste' ? 1 : 2}
                    <div class="flex items-center gap-2">
                        <span class="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold
                            {stepIndex <= currentIndex ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-500'}">
                            {stepIndex < currentIndex ? '✓' : stepIndex + 1}
                        </span>
                        <span class="text-sm {stepIndex === currentIndex ? 'font-medium text-slate-900' : 'text-slate-400'}">
                            {label}
                        </span>
                        {#if i < 2}
                            <div class="w-8 h-px {stepIndex < currentIndex ? 'bg-slate-400' : 'bg-slate-200'}"></div>
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

        {#if step === 'prompt'}
            <div class="bg-white border border-slate-200 rounded-lg p-6 mb-6">
                <h2 class="text-lg font-semibold text-slate-900 mb-2">Step 1: Copy the prompt</h2>
                <p class="text-sm text-slate-600 mb-4">
                    Copy this prompt and paste it into any AI chatbot (ChatGPT, Claude, Gemini, etc.).
                </p>

                <div class="relative">
                    <pre class="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-700 overflow-x-auto whitespace-pre-wrap max-h-96 overflow-y-auto">{generatedPrompt}</pre>
                    <button
                        on:click={handleCopy}
                        class="absolute top-2 right-2 inline-flex items-center gap-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium py-1.5 px-3 rounded-md shadow-sm transition-colors"
                    >
                        {copied ? 'Copied!' : 'Copy'}
                    </button>
                </div>

                <div class="mt-4 flex gap-3">
                    <button
                        on:click={handleCopy}
                        class="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white font-medium py-2.5 px-5 rounded-lg transition-colors"
                    >
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
                    <button
                        on:click={handleSkipToManual}
                        class="ml-auto inline-flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm font-medium py-2.5 px-3 transition-colors"
                    >
                        Skip — fill manually
                    </button>
                </div>
            </div>
        {/if}

        {#if step === 'paste'}
            <div class="bg-white border border-slate-200 rounded-lg p-6 mb-6">
                <h2 class="text-lg font-semibold text-slate-900 mb-2">Step 2: Paste the AI response</h2>
                <p class="text-sm text-slate-600 mb-4">
                    Paste the JSON response from the chatbot below.
                </p>

                <textarea
                    bind:value={pastedJson}
                    placeholder="Paste the JSON response here..."
                    class="w-full h-64 bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-700 font-mono resize-y focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent"
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
                        class="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 px-5 rounded-lg transition-colors"
                    >
                        Import &amp; Preview
                    </button>
                </div>
            </div>
        {/if}

        {#if step === 'preview'}
            <div class="bg-white border border-slate-200 rounded-lg p-6 mb-6">
                <div class="flex items-center justify-between mb-4">
                    <div>
                        <h2 class="text-lg font-semibold text-slate-900">Step 3: Review & save</h2>
                        <p class="text-sm text-slate-500 mt-1">{totalKeywords} keywords across {stopResults.filter(s => s.keywords.length > 0).length} stops · {stopsWithPlan} guide plan{stopsWithPlan !== 1 ? 's' : ''}</p>
                    </div>
                    <div class="flex gap-3">
                        <button
                            on:click={() => { step = 'paste'; }}
                            class="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2 px-4 rounded-lg transition-colors text-sm"
                        >
                            Re-paste
                        </button>
                        <button
                            on:click={handleSave}
                            disabled={isSaving}
                            class="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 px-5 rounded-lg transition-colors"
                        >
                            {isSaving ? 'Saving…' : 'Save to Route'}
                        </button>
                    </div>
                </div>
            </div>

            <div class="space-y-4">
                {#each stopResults as result, i}
                    <div class="bg-white border border-slate-200 rounded-lg overflow-hidden">
                        <div class="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
                            <div class="flex items-center gap-3">
                                <span class="inline-flex items-center justify-center w-7 h-7 bg-slate-800 text-white font-bold text-xs rounded-full">
                                    {i + 1}
                                </span>
                                <span class="font-medium text-slate-800">{result.placeName}</span>
                            </div>
                            <span class="text-sm text-slate-500">{result.keywords.length} keyword{result.keywords.length !== 1 ? 's' : ''}</span>
                        </div>

                        <div class="p-4 space-y-4">
                            <div>
                                <h4 class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Student keywords</h4>
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {#each result.keywords as kw, ki}
                                        <div class="flex items-center gap-2 border border-slate-200 bg-slate-50 rounded-lg px-2 py-1.5">
                                            <input type="text" bind:value={stopResults[i].keywords[ki].word}
                                                placeholder="word"
                                                class="flex-1 min-w-0 font-semibold text-slate-900 bg-transparent border-0 focus:outline-none focus:ring-0 text-sm" />
                                            <span class="text-slate-300">·</span>
                                            <input type="text" bind:value={stopResults[i].keywords[ki].translation}
                                                placeholder="translation"
                                                class="flex-1 min-w-0 text-sm text-slate-600 bg-transparent border-0 focus:outline-none focus:ring-0" />
                                            <button on:click={() => removeKeyword(i, ki)}
                                                aria-label="Remove keyword"
                                                class="text-slate-400 hover:text-red-500 p-1 rounded">
                                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </div>
                                    {/each}
                                </div>
                                <button on:click={() => addKeyword(i)}
                                    class="mt-2 inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 font-medium py-1 px-2 rounded hover:bg-slate-50 transition-colors">
                                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
                                    </svg>
                                    Add keyword
                                </button>
                            </div>

                            <div class="border border-amber-200 bg-amber-50 rounded-lg p-3">
                                <h4 class="text-xs font-semibold uppercase tracking-wide text-amber-800 mb-1">Guide plan (only you see this)</h4>
                                <textarea bind:value={stopResults[i].teacherPlan}
                                    rows="4"
                                    placeholder="What will you talk about at this stop? 3-6 sentences."
                                    class="w-full text-sm text-amber-900 bg-transparent border-0 focus:outline-none focus:ring-0 resize-y leading-relaxed"
                                ></textarea>
                            </div>
                        </div>
                    </div>
                {/each}
            </div>

            <div class="mt-6 flex justify-end">
                <button
                    on:click={handleSave}
                    disabled={isSaving}
                    class="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 px-5 rounded-lg transition-colors"
                >
                    {isSaving ? 'Saving…' : 'Save to Route'}
                </button>
            </div>
        {/if}
    {/if}
</div>
