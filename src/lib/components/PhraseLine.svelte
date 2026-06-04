<script lang="ts">
	import type { QuickPhrase } from '$lib/quickPhrasesHistory';

	export let phrase: QuickPhrase;
	// Needed to gloss a word in context. Source = phrase language, target = the
	// learner's instruction language (defaults to English).
	export let language: string = '';
	export let instructionLanguage: string = 'English';

	// Glosses are no longer generated up-front; we fetch each word's meaning the
	// first time it's hovered/tapped and cache it here (keyed by token index).
	// `loading` guards against duplicate in-flight requests per token.
	let fetched: Record<number, string> = {};
	let loading: Record<number, boolean> = {};

	// New phrase → drop the cache so stale glosses can't bleed across phrases.
	let cachedFor: QuickPhrase | null = null;
	$: if (phrase !== cachedFor) {
		cachedFor = phrase;
		fetched = {};
		loading = {};
	}

	// Prefer a meaning that shipped with the phrase (older history entries still
	// carry them); otherwise use whatever we've fetched on demand.
	function glossFor(i: number): string {
		return phrase.words[i]?.meaning || fetched[i] || '';
	}

	async function ensureGloss(i: number) {
		if (glossFor(i) || loading[i] || !language) return;
		const word = phrase.words[i]?.word;
		if (!word) return;
		loading = { ...loading, [i]: true };
		try {
			const res = await fetch('/api/word-gloss', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ word, sentence: phrase.sentence, language, instructionLanguage })
			});
			if (res.ok) {
				const data = await res.json();
				if (data?.gloss) fetched = { ...fetched, [i]: data.gloss };
			}
		} catch {
			/* leave it unset — a later hover/tap retries */
		} finally {
			loading = { ...loading, [i]: false };
		}
	}
</script>

{#if phrase.words && phrase.words.length}
	<p class="text-lg text-slate-900 leading-loose">
		{#each phrase.words as w, i (i)}<span class="relative inline-block"
				><button
					type="button"
					on:click|stopPropagation={() => ensureGloss(i)}
					on:keydown|stopPropagation
					on:mouseenter={() => ensureGloss(i)}
					on:focus={() => ensureGloss(i)}
					class="peer cursor-help rounded px-0.5 hover:bg-emerald-100 focus:bg-emerald-100 focus:outline-none"
					>{w.word}</button
				><span
					class="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 py-0.5 text-lg text-emerald-700 shadow-sm peer-hover:block peer-focus:block"
					>{glossFor(i) || (loading[i] ? '…' : '')}</span
				></span
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
