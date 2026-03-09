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
    let isGenerating = false;
    let allDone = false;
    let isSaving = false;

    interface StopStatus {
        stopId: string;
        placeName: string;
        status: 'idle' | 'searching' | 'generating' | 'done' | 'error';
        facts: StopFact[];
        error?: string;
        hadWebContext?: boolean;
    }

    let stopStatuses: StopStatus[] = [];

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

            const stops = getStops(tour);
            stopStatuses = stops.map(s => ({
                stopId: s.id,
                placeName: s.location?.placeName || s.location?.address || `Stop ${s.order}`,
                status: 'idle',
                facts: []
            }));
        } catch (err: any) {
            error = err.message || 'Failed to load tour';
        } finally {
            isLoading = false;
        }
    });

    async function handleGenerate() {
        if (!tour) return;
        isGenerating = true;
        allDone = false;

        // Reset statuses
        stopStatuses = stopStatuses.map(s => ({ ...s, status: 'idle' as const, facts: [], error: undefined }));

        const tourData = getTourData(tour);
        const stops = getStops(tour);
        const cityName = getCityName(tourData.cityId);

        const body = {
            stops: stops.map(s => ({
                id: s.id,
                placeName: s.location?.placeName || s.location?.address || '',
                placeType: s.location?.placeType || ''
            })),
            languageTaught: tourData.languageTaught || '',
            instructionLanguage: tourData.instructionLanguage || 'English',
            cefrLevel: tourData.langDifficulty || '',
            city: cityName
        };

        try {
            const response = await fetch('/api/generate-facts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({ message: response.statusText }));
                error = errData.message || `Server error ${response.status}`;
                isGenerating = false;
                return;
            }

            const reader = response.body?.getReader();
            if (!reader) {
                error = 'No response stream';
                isGenerating = false;
                return;
            }

            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                let eventType = '';
                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        eventType = line.slice(7).trim();
                    } else if (line.startsWith('data: ')) {
                        const data = JSON.parse(line.slice(6));
                        handleSSEEvent(eventType, data);
                    }
                }
            }
        } catch (err: any) {
            error = err.message || 'Failed to connect to generation API';
        } finally {
            isGenerating = false;
        }
    }

    function handleSSEEvent(event: string, data: any) {
        if (event === 'progress') {
            stopStatuses = stopStatuses.map(s =>
                s.stopId === data.stopId ? { ...s, status: data.status } : s
            );
        } else if (event === 'facts') {
            stopStatuses = stopStatuses.map(s =>
                s.stopId === data.stopId
                    ? { ...s, status: 'done', facts: data.facts, hadWebContext: data.hadWebContext }
                    : s
            );
        } else if (event === 'error') {
            stopStatuses = stopStatuses.map(s =>
                s.stopId === data.stopId ? { ...s, status: 'error', error: data.error } : s
            );
        } else if (event === 'done') {
            allDone = true;
        }
    }

    function getCityName(cityId: string): string {
        const cities = $citiesStore;
        const city = cities.find(c => c.id === cityId);
        return city ? city.name : '';
    }

    async function handleSave() {
        if (!tour) return;
        isSaving = true;

        try {
            const tourData = getTourData(tour);
            const stops = getStops(tour);

            const updatedStops = stops.map(stop => {
                const status = stopStatuses.find(s => s.stopId === stop.id);
                if (status && status.facts.length > 0) {
                    return {
                        ...stop,
                        teachingMaterial: {
                            ...(stop.teachingMaterial || {
                                vocabulary: [],
                                dialogues: [],
                                generatedAt: 0,
                                languageTaught: tourData.languageTaught || '',
                                instructionLanguage: tourData.instructionLanguage || 'English',
                                cefrLevel: tourData.langDifficulty || ''
                            }),
                            facts: status.facts,
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

    function statusLabel(status: string): string {
        switch (status) {
            case 'idle': return 'Waiting';
            case 'searching': return 'Searching Wikipedia...';
            case 'generating': return 'Generating facts...';
            case 'done': return 'Complete';
            case 'error': return 'Error';
            default: return status;
        }
    }

    function statusColor(status: string): string {
        switch (status) {
            case 'idle': return 'text-slate-400';
            case 'searching': return 'text-blue-600';
            case 'generating': return 'text-amber-600';
            case 'done': return 'text-green-600';
            case 'error': return 'text-red-600';
            default: return 'text-slate-500';
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

    $: completedCount = stopStatuses.filter(s => s.status === 'done').length;
    $: hasAnyFacts = stopStatuses.some(s => s.facts.length > 0);
</script>

<div class="container mx-auto px-4 py-8 max-w-4xl">
    {#if isLoading}
        <div class="flex justify-center items-center h-64">
            <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-400"></div>
        </div>
    {:else if error}
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
            <p class="text-sm text-slate-500 mt-1">Generate Preparation Material &amp; Facts</p>
            <p class="text-sm text-slate-500 mt-1">{stopStatuses.length} stop{stopStatuses.length !== 1 ? 's' : ''} &middot; {completedCount} completed</p>

            <div class="mt-4 flex gap-3">
                <button
                    on:click={handleGenerate}
                    disabled={isGenerating}
                    class="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 px-5 rounded-lg transition-colors"
                >
                    {#if isGenerating}
                        <div class="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                        Generating...
                    {:else}
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                        </svg>
                        Generate All
                    {/if}
                </button>

                {#if hasAnyFacts && allDone}
                    <button
                        on:click={handleSave}
                        disabled={isSaving}
                        class="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 px-5 rounded-lg transition-colors"
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
                {/if}
            </div>
        </div>

        <!-- Stop cards -->
        <div class="space-y-4">
            {#each stopStatuses as stopStatus, i}
                <div class="bg-white border border-slate-200 rounded-lg overflow-hidden">
                    <!-- Stop header -->
                    <div class="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
                        <div class="flex items-center gap-3">
                            <span class="inline-flex items-center justify-center w-7 h-7 bg-green-600 text-white font-bold text-xs rounded-full">
                                {i + 1}
                            </span>
                            <span class="font-medium text-slate-800">{stopStatus.placeName}</span>
                        </div>
                        <div class="flex items-center gap-2">
                            {#if stopStatus.status === 'searching' || stopStatus.status === 'generating'}
                                <div class="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-green-500"></div>
                            {/if}
                            <span class="text-sm font-medium {statusColor(stopStatus.status)}">{statusLabel(stopStatus.status)}</span>
                        </div>
                    </div>

                    <!-- Facts display -->
                    {#if stopStatus.facts.length > 0}
                        <div class="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {#each stopStatus.facts as fact}
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
                                                        <span class="text-xs opacity-50">—</span>
                                                        <span class="opacity-75">{kw.translation}</span>
                                                    </div>
                                                {/each}
                                            </div>
                                        </div>
                                    {/if}
                                </div>
                            {/each}
                        </div>
                        {#if stopStatus.hadWebContext === false}
                            <p class="px-4 pb-3 text-xs text-amber-600">Generated without Wikipedia data</p>
                        {/if}
                    {/if}

                    <!-- Error display -->
                    {#if stopStatus.status === 'error' && stopStatus.error}
                        <div class="px-4 py-3 bg-red-50 text-red-700 text-sm">
                            {stopStatus.error}
                        </div>
                    {/if}
                </div>
            {/each}
        </div>
    {/if}
</div>
