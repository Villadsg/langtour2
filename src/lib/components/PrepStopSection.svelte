<script lang="ts">
    import type { TourStop } from '$lib/firebase/types';

    export let stop: TourStop;
    export let stopNumber: number;
    export let showTeacherPlan: boolean = false;
</script>

{#if stop.teachingMaterial}
    <section class="print-break-avoid mb-8">
        <div class="flex items-center gap-3 bg-slate-100 text-slate-800 border border-slate-200 px-4 py-3 rounded-t-lg">
            <span class="inline-flex items-center justify-center w-8 h-8 bg-slate-800 text-white font-bold text-sm rounded-full">
                {stopNumber}
            </span>
            <h2 class="text-lg font-semibold">{stop.location?.placeName || stop.location?.address || `Stop ${stopNumber}`}</h2>
        </div>

        <div class="border border-t-0 border-slate-200 rounded-b-lg p-5 space-y-6">
            {#if stop.teachingMaterial.keywords && stop.teachingMaterial.keywords.length > 0}
                <div>
                    <h3 class="text-base font-semibold text-slate-800 mb-3">Key words</h3>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {#each stop.teachingMaterial.keywords as kw}
                            <div class="flex items-baseline justify-between gap-3 border border-slate-200 bg-slate-50 rounded-lg px-3 py-2">
                                <span class="font-semibold text-slate-900">{kw.word}</span>
                                <span class="text-sm text-slate-600">{kw.translation}</span>
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}

            {#if showTeacherPlan && stop.teachingMaterial.teacherPlan}
                <div class="border border-amber-200 bg-amber-50 rounded-lg p-4">
                    <div class="flex items-center gap-2 mb-2">
                        <svg class="w-4 h-4 text-amber-700" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-7a2 2 0 00-2-2H6a2 2 0 00-2 2v7a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        <h3 class="text-sm font-semibold uppercase tracking-wide text-amber-800">Guide plan (hidden from students)</h3>
                    </div>
                    <p class="text-sm text-amber-900 whitespace-pre-wrap leading-relaxed">{stop.teachingMaterial.teacherPlan}</p>
                </div>
            {/if}
        </div>
    </section>
{/if}
