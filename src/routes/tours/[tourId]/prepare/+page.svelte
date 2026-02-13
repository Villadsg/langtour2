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

    onMount(async () => {
        try {
            const response = await ConvexService.getTour(tourId);
            if (response && response.data) {
                tour = response.data;
                const allStops = getStops(tour);
                stopsWithMaterial = allStops.filter(s => s.teachingMaterial);
            } else {
                error = 'Tour not found';
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
        <a href="/tours/{tourId}" class="no-print inline-flex items-center gap-1 text-sm text-green-700 hover:text-green-800 mb-6">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to tour
        </a>

        <!-- Header card -->
        <div class="bg-white border border-slate-200 rounded-lg p-6 mb-8">
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 class="text-2xl font-bold text-slate-900">{tourData.name}</h1>
                    <p class="text-sm text-slate-500 mt-1">Preparation Materials</p>
                    <div class="flex flex-wrap gap-2 mt-3">
                        {#if tourData.languageTaught}
                            <span class="inline-flex items-center px-2.5 py-1 bg-green-50 text-green-700 text-xs font-medium border border-green-200 rounded-md">
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
                <button
                    on:click={handlePrint}
                    class="no-print inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors"
                >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Download PDF
                </button>
            </div>
        </div>

        {#if stopsWithMaterial.length === 0}
            <!-- Empty state -->
            <div class="text-center py-16">
                <svg class="mx-auto w-16 h-16 text-slate-300 mb-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                </svg>
                <h2 class="text-lg font-semibold text-slate-700 mb-2">No preparation materials yet</h2>
                <p class="text-slate-500 text-sm">This tour doesn't have vocabulary or dialogues to study before your visit.</p>
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
