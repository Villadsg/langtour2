<script lang="ts">
	import PhraseLine from '$lib/components/PhraseLine.svelte';
	import { readSSE } from '$lib/sseClient';
	import type { QuickPhrase, GenerationContext } from '$lib/quickPhrasesHistory';

	export let phrases: QuickPhrase[];
	export let placeName: string;
	export let address: string;
	export let language: string;
	export let context: GenerationContext | undefined = undefined;

	let rootPhrases: QuickPhrase[] = phrases;
	let shownPhrases: QuickPhrase[] = phrases;
	let focusLabel: string | null = null;
	let loading = false;
	let errorMsg = '';
	// Picks so far (oldest → newest). Each pick is evidence about what the
	// learner is actually doing; the server uses the chain to narrow its
	// hypothesis on the next round.
	let chain: { sentence: string; translation: string }[] = [];

	interface Situation {
		reading: string;
		readingTranslation: string;
		suggestions: string[];
		suggestionsTranslation: string[];
	}
	let situation: Situation | null = null;
	let situationLoading = false;

	// Reset whenever the source set changes (new generation, switching history
	// entries). Keyed on the array reference: regenerate() only reassigns
	// shownPhrases, never the `phrases` prop, so a drill-down can't re-trigger
	// this — but switching the parent's entry mid-drill correctly resets.
	$: if (phrases !== rootPhrases) {
		rootPhrases = phrases;
		shownPhrases = phrases;
		focusLabel = null;
		errorMsg = '';
		chain = [];
		situation = null;
	}

	async function regenerate(phrase: QuickPhrase) {
		if (loading) return;
		loading = true;
		errorMsg = '';
		const tStart = performance.now();
		const prevShown = shownPhrases;
		const prevFocus = focusLabel;
		const prevChain = chain;
		const nextChain = [
			...chain,
			{ sentence: phrase.sentence, translation: phrase.sentenceTranslation }
		];
		const streamed: QuickPhrase[] = [];
		let streamError: string | null = null;
		let finalized = false;
		let firstAt = 0;
		try {
			const res = await fetch('/api/quick-phrases', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					language,
					placeName,
					address,
					cefrLevel: context?.cefrLevel,
					instructionLanguage: context?.instructionLanguage,
					city: context?.city,
					country: context?.country,
					timeBucket: context?.timeBucket,
					localTime: context?.localTime,
					weather: context?.weather,
					chain: nextChain
				})
			});
			if (!res.ok) {
				const text = await res.text().catch(() => '');
				throw new Error(
					res.status >= 500
						? 'The phrase generator is temporarily unavailable. Try again in a moment.'
						: text || `Request failed (${res.status})`
				);
			}

			// Swap to the new topic as phrases stream in.
			await readSSE(res, (event, payload) => {
				if (event === 'phrase' && payload?.phrase) {
					if (!firstAt) firstAt = performance.now();
					streamed.push(payload.phrase as QuickPhrase);
					focusLabel = phrase.sentence;
					shownPhrases = [...streamed];
				} else if (event === 'done') {
					finalized = true;
					const ph = (payload?.phrases as QuickPhrase[]) ?? streamed;
					if (ph.length) {
						shownPhrases = ph;
						focusLabel = phrase.sentence;
					}
				} else if (event === 'error') {
					streamError = payload?.message || 'Something went wrong.';
				}
			});

			if (streamError) throw new Error(streamError);
			if (!finalized || !shownPhrases.length) {
				throw new Error('No phrases came back. Try another one.');
			}
			chain = nextChain;
			if (import.meta.env.DEV) {
				console.log(
					`[quick-phrases timing] topic regenerate chain=${nextChain.length} ${Math.round(
						performance.now() - tStart
					)}ms total | first phrase ${firstAt ? Math.round(firstAt - tStart) : '?'}ms`
				);
			}
		} catch (err: any) {
			errorMsg = err?.message || 'Something went wrong.';
			shownPhrases = prevShown;
			focusLabel = prevFocus;
			chain = prevChain;
		} finally {
			loading = false;
		}
	}

	function back() {
		shownPhrases = rootPhrases;
		focusLabel = null;
		errorMsg = '';
		chain = [];
		situation = null;
	}

	async function readSituation() {
		if (situationLoading || chain.length < 2) return;
		situationLoading = true;
		errorMsg = '';
		try {
			const res = await fetch('/api/compose-situation', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					language,
					placeName,
					address,
					cefrLevel: context?.cefrLevel,
					instructionLanguage: context?.instructionLanguage,
					city: context?.city,
					country: context?.country,
					timeBucket: context?.timeBucket,
					localTime: context?.localTime,
					weather: context?.weather,
					chain
				})
			});
			if (!res.ok) {
				const text = await res.text().catch(() => '');
				throw new Error(
					res.status >= 500
						? 'The situation reader is temporarily unavailable. Try again in a moment.'
						: text || `Request failed (${res.status})`
				);
			}
			const data = await res.json();
			if (!data?.situation) throw new Error('No situation came back.');
			situation = data.situation as Situation;
		} catch (err: any) {
			errorMsg = err?.message || 'Something went wrong.';
		} finally {
			situationLoading = false;
		}
	}

	function onRowKey(e: KeyboardEvent, phrase: QuickPhrase) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			regenerate(phrase);
		}
	}
</script>

{#if focusLabel}
	<div
		class="mb-3 flex items-start gap-2 rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-800"
	>
		<span class="flex-1">More about: <span class="font-medium">“{focusLabel}”</span></span>
		<button
			type="button"
			on:click={back}
			class="flex-shrink-0 text-emerald-700 hover:text-emerald-900 font-medium"
		>
			← Back to all phrases
		</button>
	</div>
{:else}
	<p class="mb-3 text-sm text-emerald-700 flex items-center gap-1">
		<svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" d="M15 10l5 5-5 5M4 4h7a5 5 0 015 5v6" />
		</svg>
		Tap any phrase
	</p>
{/if}

<ul class="space-y-2" class:opacity-60={loading} class:pointer-events-none={loading}>
	{#each shownPhrases as p, i (i)}
		<li>
			<div
				role="button"
				tabindex="0"
				aria-label="Get more phrases on this topic"
				title="Tap for 4 more on this topic"
				on:click={() => regenerate(p)}
				on:keydown={(e) => onRowKey(e, p)}
				class="group cursor-pointer bg-white border border-slate-200 rounded-lg px-4 py-3 transition-colors hover:border-emerald-300 hover:bg-emerald-50/40 focus:outline-none focus:ring-2 focus:ring-emerald-300 flex items-center gap-3"
			>
				<div class="flex-1 min-w-0">
					<PhraseLine phrase={p} />
				</div>
				<svg
					class="h-5 w-5 flex-shrink-0 text-slate-300 group-hover:text-emerald-500 transition-colors"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					viewBox="0 0 24 24"
					aria-hidden="true"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
				</svg>
			</div>
		</li>
	{/each}
</ul>

{#if loading}
	<p class="mt-3 flex items-center gap-2 text-sm text-slate-500">
		<span
			class="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-emerald-500"
		></span>
		Finding more like this…
	</p>
{/if}

{#if errorMsg}
	<div
		class="mt-3 flex items-start gap-2 bg-amber-50 border-l-4 border-amber-400 text-amber-800 px-4 py-3 rounded text-sm"
	>
		<span class="flex-1">{errorMsg}</span>
		<button
			on:click={() => (errorMsg = '')}
			class="text-amber-700 hover:text-amber-900"
			aria-label="Dismiss">×</button
		>
	</div>
{/if}

{#if chain.length >= 2 && !situation}
	<button
		type="button"
		on:click={readSituation}
		disabled={situationLoading}
		class="mt-4 w-full rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-medium px-4 py-2.5 transition-colors flex items-center justify-center gap-2"
	>
		{#if situationLoading}
			<span class="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></span>
			Reading your situation…
		{:else}
			Read my situation ({chain.length} picks)
		{/if}
	</button>
{/if}

{#if situation}
	<div class="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 space-y-3">
		<div>
			<p class="text-base font-medium text-slate-900 leading-relaxed">{situation.reading}</p>
			{#if situation.readingTranslation}
				<p class="mt-1 text-sm text-slate-600 italic">{situation.readingTranslation}</p>
			{/if}
		</div>
		{#if situation.suggestions.length}
			<div>
				<p class="text-xs font-semibold uppercase tracking-wide text-emerald-700 mb-1.5">
					To enjoy more
				</p>
				<ul class="space-y-2">
					{#each situation.suggestions as s, i (i)}
						<li class="text-sm">
							<p class="text-slate-900">{s}</p>
							{#if situation.suggestionsTranslation[i]}
								<p class="text-slate-500 italic text-xs">
									{situation.suggestionsTranslation[i]}
								</p>
							{/if}
						</li>
					{/each}
				</ul>
			</div>
		{/if}
		<button
			type="button"
			on:click={() => (situation = null)}
			class="text-xs text-emerald-700 hover:text-emerald-900 font-medium"
		>
			Dismiss
		</button>
	</div>
{/if}
