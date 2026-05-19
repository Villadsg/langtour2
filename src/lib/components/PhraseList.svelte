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

	// Reset whenever the source set changes (new generation, switching history
	// entries). Keyed on the array reference: regenerate() only reassigns
	// shownPhrases, never the `phrases` prop, so a drill-down can't re-trigger
	// this — but switching the parent's entry mid-drill correctly resets.
	$: if (phrases !== rootPhrases) {
		rootPhrases = phrases;
		shownPhrases = phrases;
		focusLabel = null;
		errorMsg = '';
	}

	async function regenerate(phrase: QuickPhrase) {
		if (loading) return;
		loading = true;
		errorMsg = '';
		const tStart = performance.now();
		const prevShown = shownPhrases;
		const prevFocus = focusLabel;
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
					focusSentence: phrase.sentence,
					focusTranslation: phrase.sentenceTranslation
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
			if (import.meta.env.DEV) {
				console.log(
					`[quick-phrases timing] topic regenerate ${Math.round(
						performance.now() - tStart
					)}ms total | first phrase ${firstAt ? Math.round(firstAt - tStart) : '?'}ms`
				);
			}
		} catch (err: any) {
			errorMsg = err?.message || 'Something went wrong.';
			shownPhrases = prevShown;
			focusLabel = prevFocus;
		} finally {
			loading = false;
		}
	}

	function back() {
		shownPhrases = rootPhrases;
		focusLabel = null;
		errorMsg = '';
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
				class="cursor-pointer bg-white border border-slate-200 rounded-lg px-4 py-3 transition-colors hover:border-emerald-300 hover:bg-emerald-50/40 focus:outline-none focus:ring-2 focus:ring-emerald-300"
			>
				<PhraseLine phrase={p} />
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
