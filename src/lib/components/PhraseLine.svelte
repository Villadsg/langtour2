<script lang="ts">
	import type { QuickPhrase } from '$lib/quickPhrasesHistory';

	export let phrase: QuickPhrase;
</script>

{#if phrase.words && phrase.words.length}
	<p class="text-lg text-slate-900 leading-loose">
		{#each phrase.words as w, i (i)}<span class="relative inline-block"
				><button
					type="button"
					on:click|stopPropagation
					on:keydown|stopPropagation
					class="peer cursor-help rounded px-0.5 hover:bg-emerald-100 focus:bg-emerald-100 focus:outline-none"
					>{w.word}</button
				>{#if w.meaning}<span
						class="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 py-0.5 text-lg text-emerald-700 shadow-sm peer-hover:block peer-focus:block"
						>{w.meaning}</span
					>{/if}</span
			>{#if i < phrase.words.length - 1}{' '}{/if}{/each}
	</p>
{:else}
	<!-- No per-word data: reveal the whole-sentence translation on hover, styled like the word glosses (green highlight + tooltip above). -->
	<p class="text-lg text-slate-900 leading-loose">
		<span class="relative inline-block"
			><button
				type="button"
				on:click|stopPropagation
				on:keydown|stopPropagation
				class="peer cursor-help rounded px-0.5 text-left hover:bg-emerald-100 focus:bg-emerald-100 focus:outline-none"
				>{phrase.sentence}</button
			>{#if phrase.sentenceTranslation}<span
					class="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden w-max max-w-[90vw] -translate-x-1/2 whitespace-normal rounded-md border border-slate-200 bg-white px-2 py-1 text-lg leading-snug text-emerald-700 shadow-sm peer-hover:block peer-focus:block"
					>{phrase.sentenceTranslation}</span
				>{/if}</span
		>
	</p>
{/if}
