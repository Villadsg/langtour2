<script lang="ts">
    import type { TourStop } from '$lib/firebase/types';

    export let stop: TourStop;
    export let stopNumber: number;
</script>

{#if stop.teachingMaterial}
    <section class="print-break-avoid mb-8">
        <!-- Header -->
        <div class="flex items-center gap-3 bg-slate-100 text-slate-800 border border-slate-200 px-4 py-3 rounded-t-lg">
            <span class="inline-flex items-center justify-center w-8 h-8 bg-slate-800 text-white font-bold text-sm rounded-full">
                {stopNumber}
            </span>
            <h2 class="text-lg font-semibold">{stop.location?.placeName || stop.location?.address || `Stop ${stopNumber}`}</h2>
        </div>

        <div class="border border-t-0 border-slate-200 rounded-b-lg p-5 space-y-6">
            <!-- Vocabulary -->
            {#if stop.teachingMaterial.vocabulary && stop.teachingMaterial.vocabulary.length > 0}
                <div>
                    <h3 class="text-base font-semibold text-slate-800 mb-3">Vocabulary</h3>
                    <div class="overflow-x-auto">
                        <table class="w-full text-sm border-collapse">
                            <thead>
                                <tr class="bg-slate-100 text-left">
                                    <th class="px-3 py-2 font-medium text-slate-600 border border-slate-200">Word</th>
                                    <th class="px-3 py-2 font-medium text-slate-600 border border-slate-200">Pronunciation</th>
                                    <th class="px-3 py-2 font-medium text-slate-600 border border-slate-200">Translation</th>
                                    <th class="px-3 py-2 font-medium text-slate-600 border border-slate-200">Example</th>
                                </tr>
                            </thead>
                            <tbody>
                                {#each stop.teachingMaterial.vocabulary as vocab, i}
                                    <tr class={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                        <td class="px-3 py-2 font-medium text-slate-800 border border-slate-200">{vocab.word}</td>
                                        <td class="px-3 py-2 text-slate-600 italic border border-slate-200">{vocab.pronunciation || '—'}</td>
                                        <td class="px-3 py-2 text-slate-700 border border-slate-200">{vocab.translation}</td>
                                        <td class="px-3 py-2 text-slate-600 border border-slate-200">{vocab.context || '—'}</td>
                                    </tr>
                                {/each}
                            </tbody>
                        </table>
                    </div>
                </div>
            {/if}

            <!-- Dialogues -->
            {#if stop.teachingMaterial.dialogues && stop.teachingMaterial.dialogues.length > 0}
                <div>
                    <h3 class="text-base font-semibold text-slate-800 mb-3">Practice Dialogues</h3>
                    <div class="space-y-4">
                        {#each stop.teachingMaterial.dialogues as dialogue}
                            <div class="print-break-avoid border border-slate-200 rounded-lg overflow-hidden">
                                <div class="bg-slate-100 px-4 py-2 border-b border-slate-200">
                                    <h4 class="font-medium text-slate-700">{dialogue.title}</h4>
                                    {#if dialogue.participants && dialogue.participants.length > 0}
                                        <p class="text-xs text-slate-500 mt-0.5">{dialogue.participants.join(' & ')}</p>
                                    {/if}
                                </div>
                                <div class="p-4 space-y-3">
                                    {#each dialogue.lines as line, lineIndex}
                                        {@const isEven = lineIndex % 2 === 0}
                                        <div class="flex gap-3 {isEven ? '' : 'flex-row-reverse'}">
                                            <div class="flex-shrink-0 w-20 text-xs font-semibold {isEven ? 'text-slate-700' : 'text-blue-700'} pt-1 {isEven ? 'text-left' : 'text-right'}">
                                                {line.speaker}
                                            </div>
                                            <div class="flex-1 {isEven ? 'bg-slate-50 border-slate-200' : 'bg-blue-50 border-blue-200'} border rounded-lg px-3 py-2">
                                                <p class="text-sm text-slate-800">{line.text}</p>
                                                <p class="text-xs text-slate-500 mt-1 italic">{line.translation}</p>
                                            </div>
                                        </div>
                                    {/each}
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}

            <!-- Did You Know? Facts -->
            {#if stop.teachingMaterial.facts && stop.teachingMaterial.facts.length > 0}
                {@const categoryStyles = {
                    historical: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', label: 'text-blue-700', keyword: 'text-blue-600', sep: 'text-blue-400' },
                    cultural: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', label: 'text-amber-700', keyword: 'text-amber-600', sep: 'text-amber-400' },
                    linguistic: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-800', label: 'text-purple-700', keyword: 'text-purple-600', sep: 'text-purple-400' },
                    geographical: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', label: 'text-emerald-700', keyword: 'text-emerald-600', sep: 'text-emerald-400' }
                }}
                <div>
                    <h3 class="text-base font-semibold text-slate-800 mb-3">Did You Know?</h3>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {#each stop.teachingMaterial.facts as fact}
                            {@const s = categoryStyles[fact.category] || categoryStyles.cultural}
                            <div class="border rounded-lg p-3 {s.bg} {s.border}">
                                <span class="inline-block text-xs font-semibold uppercase tracking-wide mb-1 {s.label}">
                                    {fact.category}
                                </span>
                                <p class="text-sm {s.text}">{fact.text}</p>
                                {#if fact.keywords && fact.keywords.length > 0}
                                    <div class="mt-2 pt-2 border-t {s.border}">
                                        <p class="text-xs font-medium mb-1.5 {s.keyword}">Key vocabulary</p>
                                        <div class="space-y-1">
                                            {#each fact.keywords as kw}
                                                <div class="flex items-baseline gap-2 text-sm">
                                                    <span class="font-semibold {s.text}">{kw.word}</span>
                                                    <span class="text-xs {s.sep}">—</span>
                                                    <span class="{s.keyword}">{kw.translation}</span>
                                                </div>
                                            {/each}
                                        </div>
                                    </div>
                                {/if}
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}
        </div>
    </section>
{/if}
