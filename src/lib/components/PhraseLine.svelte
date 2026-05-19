<script lang="ts">
	import type { QuickPhrase } from '$lib/quickPhrasesHistory';

	export let phrase: QuickPhrase;
</script>

{#if phrase.words && phrase.words.length}
	<p class="text-slate-900 leading-loose">
		{#each phrase.words as w, i (i)}<span class="relative inline-block"
				><button
					type="button"
					on:click|stopPropagation
					on:keydown|stopPropagation
					class="peer cursor-help rounded px-0.5 hover:bg-emerald-100 focus:bg-emerald-100 focus:outline-none"
					>{w.word}</button
				>{#if w.meaning}<span
						class="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-800 px-2 py-1 text-xs text-white peer-hover:block peer-focus:block"
						>{w.meaning}</span
					>{/if}</span
			>{#if i < phrase.words.length - 1}{' '}{/if}{/each}
	</p>
{:else}
	<!-- Older entries have no per-word data: reveal the full translation on hover so only the learned language is shown by default. -->
	<span class="relative inline-block">
		<button
			type="button"
			on:click|stopPropagation
			on:keydown|stopPropagation
			class="peer cursor-help text-left text-slate-900 focus:outline-none"
			>{phrase.sentence}</button
		>
		{#if phrase.sentenceTranslation}
			<span
				class="pointer-events-none absolute bottom-full left-0 z-10 mb-1 hidden max-w-xs rounded bg-slate-800 px-2 py-1 text-xs text-white peer-hover:block peer-focus:block"
				>{phrase.sentenceTranslation}</span
			>
		{/if}
	</span>
{/if}
