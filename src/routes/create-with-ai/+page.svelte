<script lang="ts">
    import { goto } from '$app/navigation';
    import { currentUser, ConvexService } from '$lib/firebaseService';
    import { citiesStore } from '$lib/stores/tourStore';
    import { batchGeocode } from '$lib/geocodingService';
    import type { ParsedStopData, TourStop } from '$lib/firebase/types';
    import type { BatchGeocodeProgress } from '$lib/geocodingService';
    import StopLocationPicker from '$lib/components/StopLocationPicker.svelte';
    import type { TourStopLocation } from '$lib/firebase/types';

    let isLoading = false;
    let error = '';

    // Step tracking
    let step: 'prompt' | 'paste' | 'review' = 'prompt';
    let copied = false;

    // Paste step
    let pastedJson = '';
    let parseError = '';

    // Parsed route data
    let trailName = '';
    let trailDescription = '';
    let cityName = '';
    let cityId = '';
    let languageTaught = '';
    let instructionLanguage = '';
    let langDifficulty = 'B1';
    let tourType = 'person';
    let price = 0;
    let stops: ParsedStopData[] = [];

    // Geocoding
    let isGeocoding = false;
    let geocodeProgress: BatchGeocodeProgress | null = null;

    // Location fixing
    let fixingStopIndex: number | null = null;

    // Creating
    let isCreating = false;

    // Inline editing on review step
    let editingField: string | null = null;
    function startEdit(field: string) {
        editingField = field;
    }
    function commitEdit() {
        if (editingField === 'cityName') {
            cityId = resolveCityId(cityName);
        }
        editingField = null;
    }
    function editKey(e: KeyboardEvent) {
        if (e.key === 'Enter' && !(e.shiftKey && (e.target as HTMLElement).tagName === 'TEXTAREA')) {
            e.preventDefault();
            commitEdit();
        } else if (e.key === 'Escape') {
            editingField = null;
        }
    }
    function autofocus(node: HTMLElement) {
        (node as HTMLInputElement).focus();
        if ('select' in node) (node as HTMLInputElement).select();
    }
    const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

    const LLM_PROMPT = `Help me create a language-learning walking route. Ask one at a time, conversationally:
1. City?
2. Language to teach?
3. Language the learner speaks?
4. Stops (first one is the starting location). Only list stops I explicitly mention — never invent or pad.

You may auto-fill: name, description, langDifficulty (A1–C2), placeType.

Then output ONLY this JSON (no markdown):
{
  "name": "...",
  "cityName": "...",
  "languageTaught": "...",
  "instructionLanguage": "...",
  "langDifficulty": "B1",
  "description": "...",
  "stops": [ { "placeName": "...", "placeType": "square" } ]
}

placeType: cafe, restaurant, museum, market, landmark, park, shop, neighborhood, station, square, or other.
Languages: write the English name in title case (e.g. Japanese, Portuguese).

Start: which city?`;

    function handleCopy() {
        navigator.clipboard.writeText(LLM_PROMPT);
        copied = true;
        setTimeout(() => { copied = false; }, 2000);
    }

    function resolveCityId(name: string): string {
        const cities = $citiesStore;
        const normalized = name.toLowerCase().trim();
        const match = cities.find(c => c.name.toLowerCase() === normalized);
        return match ? match.id : normalized.replace(/\s+/g, '-');
    }

    async function handleImport() {
        parseError = '';
        error = '';

        try {
            let jsonStr = pastedJson.trim();

            // Strip markdown code fences
            const codeBlockMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
            if (codeBlockMatch) {
                jsonStr = codeBlockMatch[1].trim();
            }

            const parsed = JSON.parse(jsonStr);

            // Validate required fields
            if (!parsed.name || typeof parsed.name !== 'string') {
                parseError = 'Missing required field: "name"';
                return;
            }
            if (!parsed.languageTaught || typeof parsed.languageTaught !== 'string') {
                parseError = 'Missing required field: "languageTaught"';
                return;
            }
            if (!parsed.instructionLanguage || typeof parsed.instructionLanguage !== 'string') {
                parseError = 'Missing required field: "instructionLanguage"';
                return;
            }
            if (!parsed.stops || !Array.isArray(parsed.stops) || parsed.stops.length === 0) {
                parseError = 'Missing or empty "stops" array';
                return;
            }

            // Store parsed data
            trailName = parsed.name;
            trailDescription = parsed.description || '';
            cityName = parsed.cityName || '';
            cityId = resolveCityId(cityName);
            languageTaught = parsed.languageTaught;
            instructionLanguage = parsed.instructionLanguage;
            langDifficulty = parsed.langDifficulty || 'B1';
            // tourType and price are app defaults, not AI-controlled
            tourType = 'person';
            price = 0;

            // Convert stops to ParsedStopData
            stops = parsed.stops.map((s: any) => ({
                placeName: s.placeName || 'Unknown Stop',
                addressOrDescription: '',
                placeType: s.placeType || 'other',
                geocodeStatus: 'pending' as const
            }));

            // Run geocoding
            isGeocoding = true;
            step = 'review';

            stops = await batchGeocode(
                stops,
                cityName,
                (progress) => { geocodeProgress = progress; }
            );

            isGeocoding = false;
            geocodeProgress = null;
        } catch (e: any) {
            if (step === 'review') {
                // Geocoding failed but parsing succeeded
                isGeocoding = false;
                error = `Geocoding error: ${e.message}`;
            } else {
                parseError = `JSON parse error: ${e.message}`;
            }
        }
    }

    function handleLocationConfirm(index: number, event: CustomEvent<TourStopLocation>) {
        const location = event.detail;
        stops[index] = {
            ...stops[index],
            location,
            geocodeStatus: 'found',
            alternatives: []
        };
        stops = stops;
        fixingStopIndex = null;
    }

    function deleteStop(index: number) {
        stops = stops.filter((_, i) => i !== index);
        if (fixingStopIndex === index) {
            fixingStopIndex = null;
        } else if (fixingStopIndex !== null && fixingStopIndex > index) {
            fixingStopIndex = fixingStopIndex - 1;
        }
    }

    function statusIcon(status: ParsedStopData['geocodeStatus']): string {
        switch (status) {
            case 'found': return 'found';
            case 'ambiguous': return 'ambiguous';
            case 'not_found': return 'not_found';
            default: return 'pending';
        }
    }

    $: allStopsResolved = stops.length > 0 && stops.every(s => s.geocodeStatus === 'found');

    async function handleCreate() {
        if (!allStopsResolved) return;

        if (!$currentUser) {
            const returnUrl = encodeURIComponent('/create-with-ai');
            goto(`/login?redirect=${returnUrl}`);
            return;
        }

        isCreating = true;
        error = '';

        try {
            const tourStops: TourStop[] = stops.map((s, i) => ({
                id: `stop-${i + 1}`,
                order: i,
                location: {
                    lat: s.location!.lat,
                    lng: s.location!.lng,
                    address: s.location!.address || '',
                    placeName: s.placeName,
                    placeType: s.placeType || ''
                }
            }));

            const tourData = {
                name: trailName,
                cityId,
                languageTaught,
                instructionLanguage,
                langDifficulty,
                description: trailDescription,
                tourType,
                price,
                stops: tourStops
            };

            await ConvexService.createTour(tourData);
            goto('/dashboard');
        } catch (e: any) {
            error = e.message || 'Failed to create route';
        } finally {
            isCreating = false;
        }
    }
</script>

<div class="container mx-auto px-4 py-8 max-w-4xl">
    {#if isLoading}
        <div class="flex justify-center items-center h-64">
            <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-slate-300"></div>
        </div>
    {:else}
        <!-- Back link -->
        <a href={$currentUser ? '/dashboard' : '/'} class="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-600 mb-6">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            {$currentUser ? 'Back to dashboard' : 'Back to routes'}
        </a>

        <!-- Header -->
        <div class="bg-white border border-slate-200 rounded-lg p-6 mb-8">
            <h1 class="text-2xl font-medium text-slate-700">Create Route with External Chat</h1>
            <p class="text-sm text-slate-500 mt-1">Copy the prompt into any external chatbot, paste back the JSON result</p>

            <!-- Step indicator -->
            <div class="flex items-center gap-2 mt-4">
                {#each ['Copy Prompt', 'Paste Result', 'Review & Create'] as label, i}
                    {@const currentIndex = step === 'prompt' ? 0 : step === 'paste' ? 1 : 2}
                    <div class="flex items-center gap-2">
                        <span class="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium
                            {i <= currentIndex ? 'bg-slate-600 text-white' : 'bg-slate-100 text-slate-400'}">
                            {i < currentIndex ? '✓' : i + 1}
                        </span>
                        <span class="text-sm {i === currentIndex ? 'font-medium text-slate-700' : 'text-slate-400'}">
                            {label}
                        </span>
                        {#if i < 2}
                            <div class="w-8 h-px {i < currentIndex ? 'bg-slate-400' : 'bg-slate-200'}"></div>
                        {/if}
                    </div>
                {/each}
            </div>
        </div>

        {#if error}
            <div class="relative flex items-center justify-between bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4" role="alert">
                <p>{error}</p>
                <button class="ml-4 text-red-400 hover:text-red-600" on:click={() => error = ''}>
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
            </div>
        {/if}

        <!-- Step 1: Copy Prompt -->
        {#if step === 'prompt'}
            <div class="bg-white border border-slate-200 rounded-lg p-6">
                <h2 class="text-lg font-medium text-slate-700 mb-2">Step 1: Copy the prompt</h2>
                <p class="text-sm text-slate-600 mb-4">
                    Copy this prompt and paste it into any external chatbot (ChatGPT, Claude, Gemini, etc.). Chat with it to design your route, and it will output JSON at the end.
                </p>

                <div class="relative">
                    <pre class="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-600 overflow-x-auto whitespace-pre-wrap max-h-96 overflow-y-auto">{LLM_PROMPT}</pre>
                    <button
                        on:click={handleCopy}
                        class="absolute top-2 right-2 inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-medium py-1.5 px-3 rounded-md shadow-sm transition-colors"
                    >
                        {#if copied}
                            <svg class="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
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
                        class="inline-flex items-center gap-2 bg-slate-600 hover:bg-slate-700 text-white font-medium py-2.5 px-5 rounded-lg transition-colors"
                    >
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                        </svg>
                        {copied ? 'Copied!' : 'Copy Prompt'}
                    </button>
                    <button
                        on:click={() => { step = 'paste'; }}
                        class="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium py-2.5 px-5 rounded-lg transition-colors"
                    >
                        Next: Paste Result
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>
            </div>
        {/if}

        <!-- Step 2: Paste JSON -->
        {#if step === 'paste'}
            <div class="bg-white border border-slate-200 rounded-lg p-6">
                <h2 class="text-lg font-medium text-slate-700 mb-2">Step 2: Paste the AI response</h2>
                <p class="text-sm text-slate-600 mb-4">
                    Copy the JSON that was generated and paste it below. The app will look up all the stop locations automatically.
                </p>

                <textarea
                    bind:value={pastedJson}
                    placeholder="Paste the JSON response here..."
                    class="w-full h-64 bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-600 font-mono resize-y focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent"
                ></textarea>

                {#if parseError}
                    <div class="mt-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                        {parseError}
                    </div>
                {/if}

                <div class="mt-4 flex gap-3">
                    <button
                        on:click={() => { step = 'prompt'; parseError = ''; }}
                        class="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium py-2.5 px-5 rounded-lg transition-colors"
                    >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                        Back
                    </button>
                    <button
                        on:click={handleImport}
                        disabled={!pastedJson.trim()}
                        class="inline-flex items-center gap-2 bg-slate-600 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 px-5 rounded-lg transition-colors"
                    >
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        Import &amp; Preview
                    </button>
                </div>
            </div>
        {/if}

        <!-- Step 3: Review & Create -->
        {#if step === 'review'}
            <!-- Geocoding progress -->
            {#if isGeocoding && geocodeProgress}
                <div class="bg-white border border-slate-200 rounded-lg p-6 mb-6">
                    <div class="flex items-center gap-3 mb-3">
                        <div class="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-slate-500"></div>
                        <span class="text-sm font-normal text-slate-600">
                            Looking up locations... {geocodeProgress.completed}/{geocodeProgress.total}
                        </span>
                    </div>
                    <div class="w-full bg-slate-100 rounded-full h-2">
                        <div
                            class="bg-slate-500 h-2 rounded-full transition-all"
                            style="width: {(geocodeProgress.completed / geocodeProgress.total) * 100}%"
                        ></div>
                    </div>
                    <p class="text-xs text-slate-500 mt-2">Currently: {geocodeProgress.currentPlace}</p>
                </div>
            {/if}

            {#if !isGeocoding}
                <!-- Route summary -->
                <div class="bg-white border border-slate-200 rounded-lg p-6 mb-6">
                    <div class="flex items-center justify-between mb-4">
                        <h2 class="text-lg font-medium text-slate-700">Review Route</h2>
                        <div class="flex gap-3">
                            <button
                                on:click={() => { step = 'paste'; }}
                                class="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium py-2 px-4 rounded-lg transition-colors text-sm"
                            >
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
                                </svg>
                                Re-paste
                            </button>
                            <button
                                on:click={handleCreate}
                                disabled={!allStopsResolved || isCreating}
                                class="inline-flex items-center gap-2 bg-slate-600 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 px-5 rounded-lg transition-colors"
                            >
                                {#if isCreating}
                                    <div class="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                                    Creating...
                                {:else}
                                    Create Route
                                {/if}
                            </button>
                        </div>
                    </div>

                    <p class="text-xs text-slate-400 mb-2">Double-click any value to edit</p>
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                        <div>
                            <span class="text-slate-500">Name</span>
                            {#if editingField === 'name'}
                                <input type="text" bind:value={trailName} on:blur={commitEdit} on:keydown={editKey} use:autofocus
                                    class="font-normal text-slate-600 w-full border border-slate-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-slate-400" />
                            {:else}
                                <p class="font-normal text-slate-600 cursor-pointer hover:bg-slate-50 rounded" on:dblclick={() => startEdit('name')}>{trailName}</p>
                            {/if}
                        </div>
                        <div>
                            <span class="text-slate-500">City</span>
                            {#if editingField === 'cityName'}
                                <input type="text" bind:value={cityName} on:blur={commitEdit} on:keydown={editKey} use:autofocus
                                    class="font-normal text-slate-600 w-full border border-slate-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-slate-400" />
                            {:else}
                                <p class="font-normal text-slate-600 cursor-pointer hover:bg-slate-50 rounded" on:dblclick={() => startEdit('cityName')}>{cityName || 'N/A'}</p>
                            {/if}
                        </div>
                        <div>
                            <span class="text-slate-500">Teaching</span>
                            {#if editingField === 'languageTaught'}
                                <input type="text" bind:value={languageTaught} on:blur={commitEdit} on:keydown={editKey} use:autofocus
                                    class="font-normal text-slate-600 w-full border border-slate-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-slate-400" />
                            {:else}
                                <p class="font-normal text-slate-600 cursor-pointer hover:bg-slate-50 rounded" on:dblclick={() => startEdit('languageTaught')}>{languageTaught}</p>
                            {/if}
                        </div>
                        <div>
                            <span class="text-slate-500">Instructions in</span>
                            {#if editingField === 'instructionLanguage'}
                                <input type="text" bind:value={instructionLanguage} on:blur={commitEdit} on:keydown={editKey} use:autofocus
                                    class="font-normal text-slate-600 w-full border border-slate-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-slate-400" />
                            {:else}
                                <p class="font-normal text-slate-600 cursor-pointer hover:bg-slate-50 rounded" on:dblclick={() => startEdit('instructionLanguage')}>{instructionLanguage}</p>
                            {/if}
                        </div>
                        <div>
                            <span class="text-slate-500">Difficulty</span>
                            {#if editingField === 'langDifficulty'}
                                <select bind:value={langDifficulty} on:blur={commitEdit} on:change={commitEdit} use:autofocus
                                    class="font-normal text-slate-600 w-full border border-slate-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-slate-400">
                                    {#each CEFR_LEVELS as level}
                                        <option value={level}>{level}</option>
                                    {/each}
                                </select>
                            {:else}
                                <p class="font-normal text-slate-600 cursor-pointer hover:bg-slate-50 rounded" on:dblclick={() => startEdit('langDifficulty')}>{langDifficulty}</p>
                            {/if}
                        </div>
                        <div>
                            <span class="text-slate-500">Stops</span>
                            <p class="font-normal text-slate-600">{stops.length}</p>
                        </div>
                    </div>

                    {#if editingField === 'description'}
                        <textarea bind:value={trailDescription} on:blur={commitEdit} on:keydown={editKey} use:autofocus
                            class="text-sm text-slate-600 mt-3 border-t border-slate-100 pt-3 w-full border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-slate-400"
                            rows="3"></textarea>
                    {:else if trailDescription}
                        <p class="text-sm text-slate-600 mt-3 border-t border-slate-100 pt-3 cursor-pointer hover:bg-slate-50 rounded" on:dblclick={() => startEdit('description')}>{trailDescription}</p>
                    {:else}
                        <p class="text-sm text-slate-400 italic mt-3 border-t border-slate-100 pt-3 cursor-pointer hover:bg-slate-50 rounded" on:dblclick={() => startEdit('description')}>Double-click to add description</p>
                    {/if}

                    {#if !allStopsResolved}
                        <div class="mt-4 bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-lg text-sm">
                            Some stops need their location fixed before you can create the route.
                        </div>
                    {/if}
                </div>

                <!-- Stop cards -->
                <div class="space-y-4">
                    {#each stops as stop, i}
                        <div class="bg-white border border-slate-200 rounded-lg overflow-hidden">
                            <div class="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
                                <div class="flex items-center gap-3">
                                    <span class="inline-flex items-center justify-center w-7 h-7 bg-slate-500 text-white font-medium text-xs rounded-full">
                                        {i + 1}
                                    </span>
                                    <div>
                                        <span class="font-normal text-slate-600">{stop.placeName}</span>
                                        {#if stop.placeType && stop.placeType !== 'other'}
                                            <span class="ml-2 text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{stop.placeType}</span>
                                        {/if}
                                    </div>
                                </div>
                                <div class="flex items-center gap-2">
                                    {#if statusIcon(stop.geocodeStatus) === 'found'}
                                        <span class="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-50 border border-slate-200 px-2 py-1 rounded-full">
                                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                            </svg>
                                            Found
                                        </span>
                                    {:else if statusIcon(stop.geocodeStatus) === 'ambiguous'}
                                        <span class="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full">
                                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                                            </svg>
                                            Ambiguous
                                        </span>
                                    {:else if statusIcon(stop.geocodeStatus) === 'not_found'}
                                        <span class="inline-flex items-center gap-1 text-xs text-red-700 bg-red-50 border border-red-200 px-2 py-1 rounded-full">
                                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                            Not found
                                        </span>
                                    {:else}
                                        <span class="text-xs text-slate-400">Pending</span>
                                    {/if}

                                    {#if stop.geocodeStatus !== 'found' || (stop.geocodeStatus === 'found' && fixingStopIndex === i)}
                                        <button
                                            on:click={() => { fixingStopIndex = fixingStopIndex === i ? null : i; }}
                                            class="text-xs text-slate-500 hover:text-slate-600 font-medium px-2 py-1 rounded hover:bg-slate-50 transition-colors"
                                        >
                                            {fixingStopIndex === i ? 'Close map' : 'Fix location'}
                                        </button>
                                    {:else}
                                        <button
                                            on:click={() => { fixingStopIndex = i; }}
                                            class="text-xs text-slate-400 hover:text-slate-600 font-normal px-2 py-1 rounded hover:bg-slate-50 transition-colors"
                                        >
                                            Adjust
                                        </button>
                                    {/if}

                                    <button
                                        on:click={() => deleteStop(i)}
                                        title="Delete stop"
                                        aria-label="Delete stop"
                                        class="text-xs text-red-500 hover:text-red-700 font-normal p-1 rounded hover:bg-red-50 transition-colors"
                                    >
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            {#if stop.location && fixingStopIndex !== i}
                                <div class="px-4 py-2 text-xs text-slate-500 border-b border-slate-100">
                                    {stop.location.address || `${stop.location.lat.toFixed(5)}, ${stop.location.lng.toFixed(5)}`}
                                </div>
                            {/if}

                            {#if fixingStopIndex === i}
                                <div class="p-4">
                                    <StopLocationPicker
                                        location={stop.location}
                                        alternatives={stop.alternatives || []}
                                        placeName={stop.placeName}
                                        on:confirm={(e) => handleLocationConfirm(i, e)}
                                    />
                                </div>
                            {/if}
                        </div>
                    {/each}
                </div>

                <!-- Bottom create button -->
                <div class="mt-6 flex justify-end">
                    <button
                        on:click={handleCreate}
                        disabled={!allStopsResolved || isCreating}
                        class="inline-flex items-center gap-2 bg-slate-600 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 px-5 rounded-lg transition-colors"
                    >
                        {#if isCreating}
                            <div class="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                            Creating...
                        {:else}
                            Create Route
                        {/if}
                    </button>
                </div>
            {/if}
        {/if}
    {/if}
</div>
