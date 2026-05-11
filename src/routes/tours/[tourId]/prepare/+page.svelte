<script lang="ts">
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import { ConvexService, currentUser } from '$lib/firebaseService';
    import { getTourData, getStops } from '$lib/tourValidation';
    import PrepStopSection from '$lib/components/PrepStopSection.svelte';
    import type { TourStop } from '$lib/firebase/types';

    const tourId = $page.params.tourId as string;

    let tour: any = null;
    let creatorId: string | null = null;
    let isLoading = true;
    let error = '';

    let stopsWithMaterial: TourStop[] = [];
    let nextSchedule: any = null;

    $: isCreator = !!($currentUser && creatorId && $currentUser.id === creatorId);
    $: isInPerson = tour && (tour.tourType ?? 'person') !== 'app';
    // Students see keyword-only view; creators can toggle on the teacher plan.
    let showTeacherPlan = false;

    onMount(async () => {
        try {
            const response = await ConvexService.getTour(tourId);
            if (response && response.data) {
                tour = response.data;
                creatorId = await ConvexService.getTourCreatorId(tour?.id || tour?.$id || '');
                const allStops = getStops(tour);
                stopsWithMaterial = allStops.filter(s =>
                    s.teachingMaterial && (
                        (s.teachingMaterial.keywords && s.teachingMaterial.keywords.length > 0) ||
                        s.teachingMaterial.teacherPlan
                    )
                );

                if ((tour.tourType ?? 'person') !== 'app') {
                    try {
                        const schedRes = await ConvexService.getScheduledTours(tourId);
                        const upcoming = (schedRes?.data || [])
                            .filter((s: any) => new Date(s.scheduled_date) > new Date())
                            .sort((a: any, b: any) =>
                                new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime()
                            );
                        nextSchedule = upcoming[0] || null;
                    } catch { /* ignore — meet-up card just won't show */ }
                }
            } else {
                error = 'Route not found';
            }
        } catch (err: any) {
            error = err.message || 'Failed to load tour';
        } finally {
            isLoading = false;
        }
    });

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

        <a href="/tours/{tourId}" class="no-print inline-flex items-center gap-1 text-sm text-slate-700 hover:text-slate-800 mb-6">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to route
        </a>

        {#if isCreator}
            <div class="no-print flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-4 mb-6">
                <div class="text-sm">
                    <p class="font-medium">Guide view</p>
                    <p class="text-amber-800">Only you (the guide) can see the teaching plan for each stop.</p>
                </div>
                <button
                    type="button"
                    role="switch"
                    aria-checked={showTeacherPlan}
                    on:click={() => (showTeacherPlan = !showTeacherPlan)}
                    class="inline-flex items-center gap-2 text-sm font-medium select-none"
                >
                    <span
                        class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors {showTeacherPlan ? 'bg-amber-600' : 'bg-slate-300'}"
                    >
                        <span
                            class="inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform {showTeacherPlan ? 'translate-x-5' : 'translate-x-0.5'}"
                        ></span>
                    </span>
                    Show plan
                </button>
            </div>
        {/if}

        {#if isInPerson && nextSchedule}
            <div class="bg-emerald-50 border border-emerald-200 rounded-lg p-5 mb-6 no-print">
                <div class="flex items-start gap-3">
                    <svg class="w-5 h-5 text-emerald-700 mt-0.5 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <div class="flex-1">
                        <h2 class="text-sm font-semibold text-emerald-900 uppercase tracking-wide mb-1">Where to meet your guide</h2>
                        <p class="text-base font-medium text-slate-900">
                            {nextSchedule.meeting_point || 'See route start'}
                        </p>
                        <p class="text-sm text-slate-600 mt-1">
                            {new Date(nextSchedule.scheduled_date).toLocaleString(undefined, {
                                weekday: 'short', month: 'short', day: 'numeric',
                                hour: 'numeric', minute: '2-digit'
                            })}
                        </p>
                    </div>
                </div>
            </div>
        {/if}

        <div class="bg-white border border-slate-200 rounded-lg p-6 mb-8">
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 class="text-2xl font-bold text-slate-900">{tourData.name}</h1>
                    <p class="text-sm text-slate-500 mt-1">Preparation: key words for each stop</p>
                    <p class="text-sm text-slate-500 mt-2 max-w-xl">
                        Before the tour, study these words for each stop and try to guess what your guide will talk about there.
                    </p>
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
            </div>
        </div>

        {#if stopsWithMaterial.length === 0}
            <div class="text-center py-16">
                <svg class="mx-auto w-16 h-16 text-slate-300 mb-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                </svg>
                <h2 class="text-lg font-semibold text-slate-700 mb-2">No preparation material yet</h2>
                <p class="text-slate-500 text-sm">This route doesn't have key words to study before the tour.</p>
            </div>
        {:else}
            {#if stopsWithMaterial.length >= 3}
                <div class="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-8 no-print">
                    <h2 class="text-sm font-semibold text-slate-700 mb-2">Stops</h2>
                    <ol class="list-decimal list-inside text-sm text-slate-600 space-y-1">
                        {#each stopsWithMaterial as stop, i}
                            <li>{stop.location?.placeName || stop.location?.address || `Stop ${i + 1}`}</li>
                        {/each}
                    </ol>
                </div>
            {/if}

            {#each stopsWithMaterial as stop, i}
                <PrepStopSection {stop} stopNumber={i + 1} showTeacherPlan={isCreator && showTeacherPlan} />
            {/each}
        {/if}
    {/if}
</div>
