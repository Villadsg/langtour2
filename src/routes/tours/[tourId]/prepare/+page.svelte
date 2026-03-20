<script lang="ts">
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import { ConvexService } from '$lib/firebaseService';
    import { getTourData, getStops } from '$lib/tourValidation';
    import PrepStopSection from '$lib/components/PrepStopSection.svelte';
    import type { TourStop } from '$lib/firebase/types';

    const tourId = $page.params.tourId;

    let tour: any = null;
    let isLoading = true;
    let error = '';

    let stopsWithMaterial: TourStop[] = [];

    // Quiz mode state
    let mode: 'prepare' | 'quiz' = 'prepare';
    // Track checked facts as "stopIndex-factIndex"
    let checkedFacts: Set<string> = new Set();
    let showResults = false;

    $: totalFacts = stopsWithMaterial.reduce(
        (sum, stop) => sum + (stop.teachingMaterial?.facts?.length || 0), 0
    );
    $: checkedCount = checkedFacts.size;
    $: scorePercent = totalFacts > 0 ? Math.round((checkedCount / totalFacts) * 100) : 0;

    function toggleFact(key: string) {
        if (checkedFacts.has(key)) {
            checkedFacts.delete(key);
        } else {
            checkedFacts.add(key);
        }
        checkedFacts = checkedFacts; // trigger reactivity
    }

    function resetQuiz() {
        checkedFacts = new Set();
        showResults = false;
    }

    function getScoreMessage(percent: number): { text: string; color: string } {
        if (percent === 100) return { text: 'Perfect! You caught every single fact!', color: 'text-slate-700' };
        if (percent >= 75) return { text: 'Great job! You picked up most of the facts.', color: 'text-slate-600' };
        if (percent >= 50) return { text: 'Not bad! You got about half of them.', color: 'text-amber-600' };
        if (percent >= 25) return { text: 'Keep exploring! There\'s more to discover next time.', color: 'text-slate-600' };
        return { text: 'Time for another walk? The trail has lots to teach!', color: 'text-red-600' };
    }

    onMount(async () => {
        try {
            const response = await ConvexService.getTour(tourId);
            if (response && response.data) {
                tour = response.data;
                const allStops = getStops(tour);
                stopsWithMaterial = allStops.filter(s => s.teachingMaterial);
            } else {
                error = 'Trail not found';
            }
        } catch (err: any) {
            error = err.message || 'Failed to load tour';
        } finally {
            isLoading = false;
        }
    });

    function handlePrint() {
        window.print();
    }

    const categoryStyles: Record<string, { bg: string; border: string; text: string; label: string; checked: string }> = {
        historical: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', label: 'text-blue-700', checked: 'bg-blue-100 border-blue-400 ring-2 ring-blue-300' },
        cultural: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', label: 'text-amber-700', checked: 'bg-amber-100 border-amber-400 ring-2 ring-amber-300' },
        linguistic: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-800', label: 'text-purple-700', checked: 'bg-purple-100 border-purple-400 ring-2 ring-purple-300' },
        geographical: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', label: 'text-emerald-700', checked: 'bg-emerald-100 border-emerald-400 ring-2 ring-emerald-300' }
    };
</script>

<div class="container mx-auto px-4 py-8 max-w-4xl">
    {#if isLoading}
        <div class="flex justify-center items-center h-64">
            <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-slate-300"></div>
        </div>
    {:else if error}
        <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert">
            <p>{error}</p>
        </div>
    {:else if tour}
        {@const tourData = getTourData(tour)}

        <!-- Back link -->
        <a href="/tours/{tourId}" class="no-print inline-flex items-center gap-1 text-sm text-slate-700 hover:text-slate-800 mb-6">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to trail
        </a>

        <!-- Header card -->
        <div class="bg-white border border-slate-200 rounded-lg p-6 mb-8">
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 class="text-2xl font-bold text-slate-900">{tourData.name}</h1>
                    <p class="text-sm text-slate-500 mt-1">Preparation Materials</p>
                    <div class="flex flex-wrap gap-2 mt-3">
                        {#if tourData.languageTaught}
                            <span class="inline-flex items-center px-2.5 py-1 bg-slate-50 text-slate-700 text-xs font-medium border border-slate-200 rounded-md">
                                {tourData.languageTaught}
                            </span>
                        {/if}
                        {#if tourData.langDifficulty}
                            <span class="inline-flex items-center px-2.5 py-1 bg-slate-50 text-slate-700 text-xs font-medium border border-slate-200 rounded-md">
                                {tourData.langDifficulty}
                            </span>
                        {/if}
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <button
                        on:click={handlePrint}
                        class="no-print inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-medium py-2 px-4 rounded-lg text-sm transition-colors"
                    >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Download PDF
                    </button>
                </div>
            </div>
        </div>

        <!-- Mode toggle -->
        {#if totalFacts > 0}
            <div class="no-print flex items-center justify-center gap-1 bg-slate-100 border border-slate-200 rounded-lg p-1 mb-8">
                <button
                    on:click={() => { mode = 'prepare'; }}
                    class="flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors {mode === 'prepare' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}"
                >
                    <svg class="w-4 h-4 inline-block mr-1 -mt-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                    </svg>
                    Study
                </button>
                <button
                    on:click={() => { mode = 'quiz'; showResults = false; }}
                    class="flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors {mode === 'quiz' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}"
                >
                    <svg class="w-4 h-4 inline-block mr-1 -mt-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Trail Quiz
                </button>
            </div>
        {/if}

        {#if mode === 'quiz' && totalFacts > 0}
            <!-- Quiz mode -->
            <div class="mb-6">
                <div class="bg-white border border-slate-200 rounded-lg p-4 mb-6">
                    <div class="flex items-center justify-between mb-2">
                        <p class="text-sm font-medium text-slate-700">
                            Check off the facts you heard on the trail
                        </p>
                        <span class="text-sm font-semibold text-slate-900">{checkedCount} / {totalFacts}</span>
                    </div>
                    <div class="w-full bg-slate-200 rounded-full h-2.5">
                        <div
                            class="h-2.5 rounded-full transition-all duration-300 {scorePercent === 100 ? 'bg-slate-700' : scorePercent >= 50 ? 'bg-amber-500' : 'bg-slate-400'}"
                            style="width: {scorePercent}%"
                        ></div>
                    </div>
                </div>

                {#each stopsWithMaterial as stop, stopIdx}
                    {#if stop.teachingMaterial?.facts && stop.teachingMaterial.facts.length > 0}
                        <div class="mb-6">
                            <div class="flex items-center gap-3 mb-3">
                                <span class="inline-flex items-center justify-center w-7 h-7 bg-slate-800 text-white font-bold text-xs rounded-full">
                                    {stopIdx + 1}
                                </span>
                                <h3 class="text-base font-semibold text-slate-800">
                                    {stop.location?.placeName || stop.location?.address || `Stop ${stopIdx + 1}`}
                                </h3>
                            </div>
                            <div class="grid grid-cols-1 gap-2">
                                {#each stop.teachingMaterial.facts as fact, factIdx}
                                    {@const key = `${stopIdx}-${factIdx}`}
                                    {@const isChecked = checkedFacts.has(key)}
                                    {@const s = categoryStyles[fact.category] || categoryStyles.cultural}
                                    <button
                                        on:click={() => toggleFact(key)}
                                        class="w-full text-left border rounded-lg p-3 transition-all duration-200 {isChecked ? s.checked : s.bg + ' ' + s.border} hover:shadow-sm"
                                    >
                                        <div class="flex items-start gap-3">
                                            <div class="flex-shrink-0 mt-0.5">
                                                <div class="w-5 h-5 rounded border-2 flex items-center justify-center transition-colors {isChecked ? 'bg-slate-800 border-slate-800' : 'border-slate-300 bg-white'}">
                                                    {#if isChecked}
                                                        <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                                                            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    {/if}
                                                </div>
                                            </div>
                                            <div class="flex-1">
                                                <span class="inline-block text-xs font-semibold uppercase tracking-wide mb-1 {s.label}">
                                                    {fact.category}
                                                </span>
                                                <p class="text-sm {isChecked ? 'line-through opacity-60' : ''} {s.text}">{fact.text}</p>
                                            </div>
                                        </div>
                                    </button>
                                {/each}
                            </div>
                        </div>
                    {/if}
                {/each}

                <!-- Score / Results -->
                <div class="flex flex-col items-center gap-3 mt-8">
                    {#if !showResults}
                        <button
                            on:click={() => showResults = true}
                            class="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white font-medium py-2.5 px-6 rounded-lg text-sm transition-colors"
                        >
                            See my score
                        </button>
                    {:else}
                        {@const result = getScoreMessage(scorePercent)}
                        <div class="w-full max-w-md bg-white border border-slate-200 rounded-lg p-6 text-center">
                            <div class="text-4xl font-bold text-slate-900 mb-1">{scorePercent}%</div>
                            <div class="text-sm text-slate-500 mb-3">{checkedCount} out of {totalFacts} facts spotted</div>
                            <p class="text-sm font-medium {result.color}">{result.text}</p>
                            <button
                                on:click={resetQuiz}
                                class="mt-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors"
                            >
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                                </svg>
                                Reset quiz
                            </button>
                        </div>
                    {/if}
                </div>
            </div>
        {:else if stopsWithMaterial.length === 0}
            <!-- Empty state -->
            <div class="text-center py-16">
                <svg class="mx-auto w-16 h-16 text-slate-300 mb-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                </svg>
                <h2 class="text-lg font-semibold text-slate-700 mb-2">No preparation materials yet</h2>
                <p class="text-slate-500 text-sm">This trail doesn't have vocabulary or dialogues to study before your visit.</p>
            </div>
        {:else}
            <!-- Table of contents (3+ stops) -->
            {#if stopsWithMaterial.length >= 3}
                <div class="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-8 no-print">
                    <h2 class="text-sm font-semibold text-slate-700 mb-2">Contents</h2>
                    <ol class="list-decimal list-inside text-sm text-slate-600 space-y-1">
                        {#each stopsWithMaterial as stop, i}
                            <li>{stop.location?.placeName || stop.location?.address || `Stop ${i + 1}`}</li>
                        {/each}
                    </ol>
                </div>
            {/if}

            <!-- Stop sections -->
            {#each stopsWithMaterial as stop, i}
                <PrepStopSection {stop} stopNumber={i + 1} />
            {/each}
        {/if}
    {/if}
</div>
