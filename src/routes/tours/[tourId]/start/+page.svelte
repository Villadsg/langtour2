<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { page } from '$app/stores';
    import { ConvexService } from '$lib/firebaseService';
    import { getTourData, getStops } from '$lib/tourValidation';
    import {
        userLocation,
        watchUserLocation,
        clearUserLocationWatch,
        haversineKm,
        bearingDeg,
        formatDistance
    } from '$lib/stores/userLocation';
    import TourStopsMap from '$lib/components/TourStopsMap.svelte';
    import type { TourStop } from '$lib/firebase/types';

    const tourId = $page.params.tourId as string;
    const UNLOCK_RADIUS_KM = 0.075;

    let tour: any = null;
    let stops: TourStop[] = [];
    let isLoading = true;
    let error = '';
    let watchId: number | null = null;
    let unlockedIds = new Set<string>();
    let showCompletion = false;
    let completionDismissed = false;

    const storageKey = (id: string) => `langtour:unlocked:${id}`;

    function loadUnlocked(id: string): Set<string> {
        if (typeof localStorage === 'undefined') return new Set();
        try {
            const raw = localStorage.getItem(storageKey(id));
            if (!raw) return new Set();
            const arr = JSON.parse(raw);
            return Array.isArray(arr) ? new Set(arr) : new Set();
        } catch {
            return new Set();
        }
    }

    function persistUnlocked(id: string, set: Set<string>) {
        if (typeof localStorage === 'undefined') return;
        try {
            localStorage.setItem(storageKey(id), JSON.stringify([...set]));
        } catch { /* ignore */ }
    }

    onMount(async () => {
        try {
            const response = await ConvexService.getTour(tourId);
            if (response && response.data) {
                tour = response.data;
                stops = getStops(tour).sort((a, b) => a.order - b.order);
                unlockedIds = loadUnlocked(tourId);
            } else {
                error = 'Route not found';
            }
        } catch (err: any) {
            error = err.message || 'Failed to load tour';
        } finally {
            isLoading = false;
        }

        watchId = watchUserLocation();
    });

    onDestroy(() => {
        clearUserLocationWatch(watchId);
    });

    function distanceKm(stop: TourStop): number | null {
        if (!$userLocation || !stop.location) return null;
        return haversineKm(
            $userLocation.lat,
            $userLocation.lng,
            stop.location.lat,
            stop.location.lng
        );
    }

    $: if ($userLocation) {
        let changed = false;
        for (const s of stops) {
            const d = distanceKm(s);
            if (d != null && d <= UNLOCK_RADIUS_KM && !unlockedIds.has(s.id)) {
                unlockedIds.add(s.id);
                changed = true;
            }
        }
        if (changed) {
            unlockedIds = unlockedIds;
            persistUnlocked(tourId, unlockedIds);
        }
    }

    function isUnlocked(stop: TourStop): boolean {
        return unlockedIds.has(stop.id);
    }

    function bearingTo(stop: TourStop): number | null {
        if (!$userLocation || !stop.location) return null;
        return bearingDeg(
            $userLocation.lat,
            $userLocation.lng,
            stop.location.lat,
            stop.location.lng
        );
    }

    $: nextStop = stops.find((s) => !unlockedIds.has(s.id)) || null;
    $: allDone = stops.length > 0 && stops.every((s) => unlockedIds.has(s.id));
    $: if (allDone && !completionDismissed) showCompletion = true;
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

        <a href="/tours/{tourId}" class="inline-flex items-center gap-1 text-sm text-slate-700 hover:text-slate-800 mb-6">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to route
        </a>

        <div class="bg-white border border-slate-200 rounded-lg p-6 mb-6">
            <h1 class="text-2xl font-bold text-slate-900">{tourData.name}</h1>
            <p class="text-sm text-slate-500 mt-1">Walk to each stop. Phrases unlock when you're within 75 m.</p>
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
            {#if !$userLocation}
                <p class="mt-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                    Getting your location… please allow location access in your browser.
                </p>
            {/if}
        </div>

        {#if stops.length > 0}
            <div class="mb-8">
                <TourStopsMap {stops} />
            </div>
        {/if}

        {#each stops as stop, i}
            {@const d = distanceKm(stop)}
            {@const unlocked = isUnlocked(stop)}
            <section class="mb-6">
                <div class="flex items-center gap-3 px-4 py-3 rounded-t-lg border {unlocked ? 'bg-green-50 border-green-200 text-green-900' : 'bg-slate-100 border-slate-200 text-slate-800'}">
                    <span class="inline-flex items-center justify-center w-8 h-8 font-bold text-sm rounded-full {unlocked ? 'bg-green-600 text-white' : 'bg-slate-800 text-white'}">
                        {i + 1}
                    </span>
                    <h2 class="text-lg font-semibold flex-1">
                        {stop.location?.placeName || stop.location?.address || `Stop ${i + 1}`}
                    </h2>
                    {#if unlocked}
                        <span class="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wide">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            Visited
                        </span>
                    {:else if nextStop && nextStop.id === stop.id && d != null && bearingTo(stop) != null}
                        <span class="inline-flex items-center gap-2 text-sm text-slate-700">
                            <svg
                                class="w-5 h-5 text-green-600"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                viewBox="0 0 24 24"
                                style="transform: rotate({bearingTo(stop)}deg)"
                            >
                                <path stroke-linecap="round" stroke-linejoin="round" d="M12 19V5M5 12l7-7 7 7" />
                            </svg>
                            {formatDistance(d)}
                        </span>
                    {:else if d != null}
                        <span class="text-sm text-slate-600">{formatDistance(d)}</span>
                    {:else}
                        <span class="text-sm text-slate-500">—</span>
                    {/if}
                </div>

                <div class="border border-t-0 border-slate-200 rounded-b-lg p-5">
                    {#if !unlocked}
                        <div class="flex items-center gap-3 text-slate-500 text-sm">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M12 11c0-1.657 1.343-3 3-3s3 1.343 3 3v3M6 11h12a2 2 0 012 2v7a2 2 0 01-2 2H6a2 2 0 01-2-2v-7a2 2 0 012-2z" />
                            </svg>
                            <span>Walk closer to unlock the phrases for this stop.</span>
                        </div>
                    {:else if stop.teachingMaterial?.keywords && stop.teachingMaterial.keywords.length > 0}
                        {@const hasSentences = stop.teachingMaterial.keywords.some(k => k.sentence)}
                        <h3 class="text-base font-semibold text-slate-800 mb-3">
                            {hasSentences ? 'Say it to your friend' : 'Key words'}
                        </h3>
                        {#if hasSentences}
                            <ol class="space-y-2 list-decimal list-inside">
                                {#each stop.teachingMaterial.keywords as kw}
                                    <li class="border border-slate-200 bg-slate-50 rounded-lg px-3 py-2">
                                        {#if kw.sentence}
                                            <div class="text-slate-900">{kw.sentence}</div>
                                            {#if kw.sentenceTranslation}
                                                <div class="text-sm text-slate-500 mt-0.5">{kw.sentenceTranslation}</div>
                                            {/if}
                                            <div class="text-xs text-slate-400 mt-1">
                                                <span class="font-medium text-slate-600">{kw.word}</span> · {kw.translation}
                                            </div>
                                        {:else}
                                            <span class="font-semibold text-slate-900">{kw.word}</span>
                                            <span class="text-sm text-slate-600 ml-2">{kw.translation}</span>
                                        {/if}
                                    </li>
                                {/each}
                            </ol>
                        {:else}
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {#each stop.teachingMaterial.keywords as kw}
                                    <div class="flex items-baseline justify-between gap-3 border border-slate-200 bg-slate-50 rounded-lg px-3 py-2">
                                        <span class="font-semibold text-slate-900">{kw.word}</span>
                                        <span class="text-sm text-slate-600">{kw.translation}</span>
                                    </div>
                                {/each}
                            </div>
                        {/if}
                    {:else}
                        <p class="text-sm text-slate-500">No phrases prepared for this stop.</p>
                    {/if}
                </div>
            </section>
        {/each}
    {/if}
</div>

{#if showCompletion}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4">
        <div class="bg-white rounded-lg max-w-lg w-full p-6 shadow-xl">
            <div class="flex items-center gap-3 mb-3">
                <div class="inline-flex items-center justify-center w-10 h-10 rounded-full bg-green-100 text-green-700">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <h2 class="text-xl font-semibold text-slate-900">Route complete</h2>
            </div>
            <p class="text-slate-600 mb-4">You've visited every stop. Nice walk! Here's a quick review of all the phrases you unlocked.</p>

            <div class="max-h-72 overflow-y-auto border border-slate-200 rounded-lg p-3 bg-slate-50 mb-4">
                {#each stops as stop, i}
                    {#if stop.teachingMaterial?.keywords?.length}
                        <div class="mb-3 last:mb-0">
                            <div class="text-xs font-semibold text-slate-700 mb-1">{i + 1}. {stop.location?.placeName || `Stop ${i + 1}`}</div>
                            <ul class="space-y-1 text-sm">
                                {#each stop.teachingMaterial.keywords as kw}
                                    {#if kw.sentence}
                                        <li class="text-slate-700">
                                            {kw.sentence}
                                            {#if kw.sentenceTranslation}
                                                <span class="text-slate-400"> — {kw.sentenceTranslation}</span>
                                            {/if}
                                        </li>
                                    {/if}
                                {/each}
                            </ul>
                        </div>
                    {/if}
                {/each}
            </div>

            <div class="flex justify-end">
                <button
                    type="button"
                    on:click={() => { showCompletion = false; completionDismissed = true; }}
                    class="bg-slate-700 hover:bg-slate-800 text-white font-medium py-2 px-4 rounded-lg"
                >
                    Done
                </button>
            </div>
        </div>
    </div>
{/if}
