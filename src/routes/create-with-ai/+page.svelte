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
    let step: 'type' | 'chat' | 'review' | 'done' = 'type';
    let createdTourId: string | null = null;

    // Chat step
    interface ChatMessage { role: 'user' | 'assistant'; content: string; }
    let chatMessages: ChatMessage[] = [];
    let chatInput = '';
    let chatLoading = false;
    let chatError = '';
    let chatScroll: HTMLElement | null = null;
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

    function buildSystemPrompt(type: 'app' | 'person'): string {
        const isApp = type === 'app';
        const typeBlock = isApp
            ? `This is an APP-GUIDED self-walking route. The learner walks alone (or with a friend) and the phone unlocks phrases at each stop based on GPS.
- Stop selection: each stop must be a publicly visible, signed/findable place — named landmarks, squares, parks, recognizable shopfronts. NEVER suggest "the corner where X used to stand" or invisible/conceptual spots. The walker has only GPS and signage.
- Aim for 6–10 stops, roughly 5–10 minutes walking apart.
- Description should address a learner walking with a friend, phone in hand.`
            : `This is an IN-PERSON guided route. A human guide walks with the group and narrates each stop.
- Stop selection: stops can include subtle or conceptual spots ("this corner used to be the city wall") because the guide will point and explain.
- Aim for 4–6 stops with deeper content per stop — the guide expands at each one.
- Description should address a learner joining a group led by a guide.`;

        return `You help the user design a language-learning walking route. Ask one question at a time, conversationally:
1. Language to teach?
2. Language the learner speaks?
3. Stops (first one is the starting location). Only list stops the user explicitly mentions — never invent or pad.

${typeBlock}

You may auto-fill: name, description, langDifficulty (A1–C2), placeType, and cityName (infer from the stops — do not ask).

When you have all needed info, output ONLY this JSON (no markdown, no prose, no code fences) as your final message:
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

Open with: "Which language do you want to teach?"`;
    }

    $: systemPrompt = buildSystemPrompt(tourType as 'app' | 'person');

    function extractJson(text: string): any | null {
        let s = text.trim();
        const fence = s.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
        if (fence) s = fence[1].trim();
        try { return JSON.parse(s); } catch {}
        const match = s.match(/\{[\s\S]*\}/);
        if (!match) return null;
        try { return JSON.parse(match[0]); } catch { return null; }
    }

    function looksLikeRouteJson(obj: any): boolean {
        return obj && typeof obj === 'object'
            && typeof obj.name === 'string'
            && typeof obj.languageTaught === 'string'
            && typeof obj.instructionLanguage === 'string'
            && Array.isArray(obj.stops);
    }

    async function startChat() {
        chatError = '';
        parseError = '';
        step = 'chat';
        chatMessages = [{ role: 'user', content: 'Begin.' }];
        await sendToLlm(chatMessages);
    }

    async function sendToLlm(history: ChatMessage[]) {
        chatLoading = true;
        chatError = '';
        try {
            const res = await fetch('/api/llm-generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    system: systemPrompt,
                    messages: history,
                    temperature: 0.5
                })
            });
            if (!res.ok) {
                const txt = await res.text().catch(() => '');
                throw new Error(txt || `HTTP ${res.status}`);
            }
            const data = await res.json();
            const content: string = (data?.content || '').trim();
            chatMessages = [...chatMessages, { role: 'assistant', content }];
            scrollChat();

            const maybe = extractJson(content);
            if (looksLikeRouteJson(maybe)) {
                await importFromObject(maybe);
            }
        } catch (e: any) {
            chatError = e?.message || 'Failed to reach the assistant';
        } finally {
            chatLoading = false;
        }
    }

    async function handleSendChat() {
        const text = chatInput.trim();
        if (!text || chatLoading) return;
        const next: ChatMessage[] = [...chatMessages, { role: 'user', content: text }];
        chatMessages = next;
        chatInput = '';
        scrollChat();
        await sendToLlm(next);
    }

    function chatKey(e: KeyboardEvent) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendChat();
        }
    }

    function scrollChat() {
        requestAnimationFrame(() => {
            if (chatScroll) chatScroll.scrollTop = chatScroll.scrollHeight;
        });
    }

    function handleSkipToManual() {
        trailName = '';
        trailDescription = '';
        cityName = '';
        cityId = '';
        languageTaught = '';
        instructionLanguage = '';
        langDifficulty = 'B1';
        tourType = 'person';
        price = 0;
        stops = [];
        isGeocoding = false;
        geocodeProgress = null;
        step = 'review';
    }

    function addManualStop() {
        stops = [...stops, {
            placeName: 'New stop',
            addressOrDescription: '',
            placeType: 'other',
            geocodeStatus: 'not_found' as const
        }];
        fixingStopIndex = stops.length - 1;
    }

    let editingStopIndex: number | null = null;
    let editingStopField: 'placeName' | null = null;
    function startStopEdit(i: number, field: 'placeName') {
        editingStopIndex = i;
        editingStopField = field;
    }
    function commitStopEdit() {
        editingStopIndex = null;
        editingStopField = null;
    }
    function stopEditKey(e: KeyboardEvent) {
        if (e.key === 'Enter') { e.preventDefault(); commitStopEdit(); }
        else if (e.key === 'Escape') { editingStopIndex = null; editingStopField = null; }
    }

    function resolveCityId(name: string): string {
        const cities = $citiesStore;
        const normalized = name.toLowerCase().trim();
        const match = cities.find(c => c.name.toLowerCase() === normalized);
        return match ? match.id : normalized.replace(/\s+/g, '-');
    }

    async function importFromObject(parsed: any) {
        parseError = '';
        error = '';

        if (!parsed.stops || !Array.isArray(parsed.stops) || parsed.stops.length === 0) {
            parseError = 'Missing or empty "stops" array';
            return;
        }

        trailName = parsed.name;
        trailDescription = parsed.description || '';
        cityName = parsed.cityName || '';
        cityId = resolveCityId(cityName);
        languageTaught = parsed.languageTaught;
        instructionLanguage = parsed.instructionLanguage;
        langDifficulty = parsed.langDifficulty || 'B1';
        price = 0;

        stops = parsed.stops.map((s: any) => ({
            placeName: s.placeName || 'Unknown Stop',
            addressOrDescription: '',
            placeType: s.placeType || 'other',
            geocodeStatus: 'pending' as const
        }));

        isGeocoding = true;
        step = 'review';

        try {
            stops = await batchGeocode(
                stops,
                cityName,
                (progress) => { geocodeProgress = progress; }
            );
        } catch (e: any) {
            error = `Geocoding error: ${e.message}`;
        } finally {
            isGeocoding = false;
            geocodeProgress = null;
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

            const created = await ConvexService.createTour(tourData);
            createdTourId = created?.id || created?._id || null;
            step = 'done';
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
            <h1 class="text-2xl font-medium text-slate-700">Create Route with AI</h1>
            <p class="text-sm text-slate-500 mt-1">Chat with the assistant to design your route — it will fill in the details automatically.</p>

            <!-- Step indicator -->
            <div class="flex items-center gap-2 mt-4">
                {#each ['Pick Type', 'Chat with AI', 'Review & Create'] as label, i}
                    {@const currentIndex = step === 'type' ? 0 : step === 'chat' ? 1 : 2}
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

        <!-- Step 0: Pick Tour Type -->
        {#if step === 'type'}
            <div class="bg-white border border-slate-200 rounded-lg p-6">
                <h2 class="text-lg font-medium text-slate-700 mb-2">Step 1: Pick the route type</h2>
                <p class="text-sm text-slate-600 mb-4">
                    This affects the kind of stops and phrases the AI will produce, and how learners experience the route. You can't change this later — pick the one that matches what you want to build.
                </p>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                        type="button"
                        on:click={() => { tourType = 'app'; startChat(); }}
                        class="text-left border border-slate-200 hover:border-slate-400 hover:bg-slate-50 rounded-lg p-5 transition-colors"
                    >
                        <div class="flex items-center gap-2 mb-2">
                            <svg class="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M12 11c0 3.866-4 9-4 9s-4-5.134-4-9a4 4 0 118 0z" />
                                <circle cx="8" cy="11" r="1.5" fill="currentColor" />
                            </svg>
                            <h3 class="font-medium text-slate-800">App-guided</h3>
                        </div>
                        <p class="text-sm text-slate-600">Self-walking with a friend. Phone unlocks phrases at each stop using GPS. Stops must be visible/findable on foot.</p>
                    </button>

                    <button
                        type="button"
                        on:click={() => { tourType = 'person'; startChat(); }}
                        class="text-left border border-slate-200 hover:border-slate-400 hover:bg-slate-50 rounded-lg p-5 transition-colors"
                    >
                        <div class="flex items-center gap-2 mb-2">
                            <svg class="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-5.13a4 4 0 11-8 0 4 4 0 018 0zm6 0a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <h3 class="font-medium text-slate-800">In-person</h3>
                        </div>
                        <p class="text-sm text-slate-600">A guide walks with the group and narrates each stop. Phrases are questions to ask the guide. Stops can include subtle/conceptual spots.</p>
                    </button>
                </div>
            </div>
        {/if}

        <!-- Step 1: Chat with AI -->
        {#if step === 'chat'}
            <div class="bg-white border border-slate-200 rounded-lg p-6">
                <div class="flex items-center justify-between mb-2">
                    <h2 class="text-lg font-medium text-slate-700">Step 2: Chat with the assistant</h2>
                    <span class="inline-flex items-center px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200 rounded-md">
                        {tourType === 'app' ? 'App-guided' : 'In-person'}
                    </span>
                </div>
                <p class="text-sm text-slate-600 mb-4">
                    Answer the assistant's questions. When it has everything it needs, it will produce your route automatically.
                </p>

                <div bind:this={chatScroll} class="bg-slate-50 border border-slate-200 rounded-lg p-4 h-96 overflow-y-auto space-y-3">
                    {#each chatMessages.filter((m, idx) => !(idx === 0 && m.role === 'user' && m.content === 'Begin.')) as msg}
                        {#if msg.role === 'user'}
                            <div class="flex justify-end">
                                <div class="max-w-[80%] bg-slate-600 text-white rounded-lg px-3 py-2 text-sm whitespace-pre-wrap">{msg.content}</div>
                            </div>
                        {:else}
                            <div class="flex justify-start">
                                <div class="max-w-[80%] bg-white border border-slate-200 text-slate-700 rounded-lg px-3 py-2 text-sm whitespace-pre-wrap">{msg.content}</div>
                            </div>
                        {/if}
                    {/each}
                    {#if chatLoading}
                        <div class="flex justify-start">
                            <div class="bg-white border border-slate-200 text-slate-400 rounded-lg px-3 py-2 text-sm inline-flex items-center gap-2">
                                <div class="animate-spin rounded-full h-3 w-3 border-t-2 border-b-2 border-slate-400"></div>
                                Thinking…
                            </div>
                        </div>
                    {/if}
                </div>

                {#if chatError}
                    <div class="mt-3 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">{chatError}</div>
                {/if}
                {#if parseError}
                    <div class="mt-3 bg-amber-50 border border-amber-200 text-amber-700 px-4 py-2 rounded-lg text-sm">{parseError}</div>
                {/if}

                <div class="mt-3 flex gap-2">
                    <textarea
                        bind:value={chatInput}
                        on:keydown={chatKey}
                        disabled={chatLoading}
                        placeholder="Type your reply…"
                        rows="2"
                        class="flex-1 bg-white border border-slate-200 rounded-lg p-3 text-sm text-slate-700 resize-y focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent disabled:opacity-50"
                    ></textarea>
                    <button
                        on:click={handleSendChat}
                        disabled={chatLoading || !chatInput.trim()}
                        class="self-end inline-flex items-center gap-2 bg-slate-600 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 px-5 rounded-lg transition-colors"
                    >
                        Send
                    </button>
                </div>

                <div class="mt-4 flex gap-3">
                    <button
                        on:click={() => { step = 'type'; }}
                        class="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium py-2 px-3 rounded-lg transition-colors text-sm"
                    >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                        Back
                    </button>
                    <button
                        on:click={startChat}
                        disabled={chatLoading}
                        class="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-600 font-medium py-2 px-3 rounded-lg transition-colors text-sm"
                    >
                        Restart chat
                    </button>
                    <button
                        on:click={handleSkipToManual}
                        class="ml-auto inline-flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm font-medium py-2 px-3 transition-colors"
                    >
                        Skip — fill manually
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
                                on:click={() => { step = 'chat'; }}
                                class="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium py-2 px-4 rounded-lg transition-colors text-sm"
                            >
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
                                </svg>
                                Back to chat
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
                            {:else if trailName}
                                <p class="font-normal text-slate-600 cursor-pointer hover:bg-slate-50 rounded" on:dblclick={() => startEdit('name')}>{trailName}</p>
                            {:else}
                                <p class="font-normal text-slate-400 italic cursor-pointer hover:bg-slate-50 rounded" on:dblclick={() => startEdit('name')}>Double-click to add</p>
                            {/if}
                        </div>
                        <div>
                            <span class="text-slate-500">City</span>
                            {#if editingField === 'cityName'}
                                <input type="text" bind:value={cityName} on:blur={commitEdit} on:keydown={editKey} use:autofocus
                                    class="font-normal text-slate-600 w-full border border-slate-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-slate-400" />
                            {:else if cityName}
                                <p class="font-normal text-slate-600 cursor-pointer hover:bg-slate-50 rounded" on:dblclick={() => startEdit('cityName')}>{cityName}</p>
                            {:else}
                                <p class="font-normal text-slate-400 italic cursor-pointer hover:bg-slate-50 rounded" on:dblclick={() => startEdit('cityName')}>Double-click to add</p>
                            {/if}
                        </div>
                        <div>
                            <span class="text-slate-500">Teaching</span>
                            {#if editingField === 'languageTaught'}
                                <input type="text" bind:value={languageTaught} on:blur={commitEdit} on:keydown={editKey} use:autofocus
                                    class="font-normal text-slate-600 w-full border border-slate-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-slate-400" />
                            {:else if languageTaught}
                                <p class="font-normal text-slate-600 cursor-pointer hover:bg-slate-50 rounded" on:dblclick={() => startEdit('languageTaught')}>{languageTaught}</p>
                            {:else}
                                <p class="font-normal text-slate-400 italic cursor-pointer hover:bg-slate-50 rounded" on:dblclick={() => startEdit('languageTaught')}>Double-click to add</p>
                            {/if}
                        </div>
                        <div>
                            <span class="text-slate-500">Instructions in</span>
                            {#if editingField === 'instructionLanguage'}
                                <input type="text" bind:value={instructionLanguage} on:blur={commitEdit} on:keydown={editKey} use:autofocus
                                    class="font-normal text-slate-600 w-full border border-slate-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-slate-400" />
                            {:else if instructionLanguage}
                                <p class="font-normal text-slate-600 cursor-pointer hover:bg-slate-50 rounded" on:dblclick={() => startEdit('instructionLanguage')}>{instructionLanguage}</p>
                            {:else}
                                <p class="font-normal text-slate-400 italic cursor-pointer hover:bg-slate-50 rounded" on:dblclick={() => startEdit('instructionLanguage')}>Double-click to add</p>
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
                                        {#if editingStopIndex === i && editingStopField === 'placeName'}
                                            <input type="text" bind:value={stops[i].placeName} on:blur={commitStopEdit} on:keydown={stopEditKey} use:autofocus
                                                class="font-normal text-slate-600 border border-slate-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-slate-400" />
                                        {:else}
                                            <span class="font-normal text-slate-600 cursor-pointer hover:bg-white rounded px-1" on:dblclick={() => startStopEdit(i, 'placeName')}>{stop.placeName}</span>
                                        {/if}
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

                <div class="mt-4">
                    <button
                        on:click={addManualStop}
                        class="inline-flex items-center gap-2 bg-white border border-dashed border-slate-300 hover:bg-slate-50 text-slate-600 font-medium py-2 px-4 rounded-lg transition-colors text-sm"
                    >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                        Add stop
                    </button>
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

        {#if step === 'done'}
            <div class="bg-white border border-slate-200 rounded-lg p-6 sm:p-8 text-center">
                <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 mb-4">
                    <svg class="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                </div>
                <h2 class="text-xl font-semibold text-slate-900 mb-1">Route created</h2>
                <p class="text-sm text-slate-600 max-w-lg mx-auto">
                    Next, generate preparation material for your students: key words for each stop (that they study before the tour) and a private plan for you as the guide.
                </p>

                <div class="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
                    {#if createdTourId}
                        <a
                            href="/tours/{createdTourId}/generate-material"
                            class="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white font-medium py-2.5 px-5 rounded-lg transition-colors"
                        >
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                            </svg>
                            Create preparation material
                        </a>
                        <a
                            href="/tours/{createdTourId}"
                            class="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2.5 px-5 rounded-lg transition-colors"
                        >
                            View route
                        </a>
                    {/if}
                    <button
                        on:click={() => goto('/dashboard')}
                        class="inline-flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm font-medium py-2.5 px-3 transition-colors"
                    >
                        Skip for now
                    </button>
                </div>
            </div>
        {/if}
    {/if}
</div>
