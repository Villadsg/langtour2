<script lang="ts">
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import Section from '$lib/components/Section.svelte';
	import PhraseList from '$lib/components/PhraseList.svelte';
	import PhraseLine from '$lib/components/PhraseLine.svelte';
	import { readSSE } from '$lib/sseClient';
	import { takePending } from '$lib/quickPhrasesPending';
	import {
		loadHistory,
		saveEntry,
		type HistoryEntry,
		type QuickPhrase,
		type GenerationContext
	} from '$lib/quickPhrasesHistory';

	let entry: HistoryEntry | null = null;
	let loaded = false;

	// Streaming state (used when this page was reached from a fresh generation).
	let streaming = false;
	let streamPhrases: QuickPhrase[] = [];
	let streamError = '';
	let head: { placeName: string; address: string; language: string } | null = null;
	let streamContext: GenerationContext | undefined;

	$: id = $page.params.id;

	let handledId: string | null = null;
	$: if (browser && id && id !== handledId) {
		handledId = id;
		void start(id);
	}

	async function start(currentId: string) {
		loaded = false;
		entry = null;
		streaming = false;
		streamPhrases = [];
		streamError = '';
		head = null;

		const existing = loadHistory().find((e) => e.id === currentId);
		if (existing) {
			entry = existing;
			loaded = true;
			return;
		}

		const pending = takePending(currentId);
		if (!pending) {
			loaded = true;
			return;
		}

		head = {
			placeName: pending.placeName,
			address: pending.address,
			language: pending.language
		};
		streamContext = pending.context;
		streaming = true;
		loaded = true;

		const tStart = performance.now();
		let firstAt = 0;
		let finalized = false;

		try {
			const res = await fetch('/api/quick-phrases', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(pending.body)
			});
			if (!res.ok) {
				const text = await res.text().catch(() => '');
				throw new Error(
					res.status >= 500
						? 'The phrase generator is temporarily unavailable. Try again in a moment.'
						: text || `Request failed (${res.status})`
				);
			}

			await readSSE(res, (event, payload) => {
				if (event === 'phrase' && payload?.phrase) {
					if (!firstAt) firstAt = performance.now();
					streamPhrases = [...streamPhrases, payload.phrase as QuickPhrase];
				} else if (event === 'done') {
					finalized = true;
					const phrases = (payload?.phrases as QuickPhrase[]) ?? streamPhrases;
					const generatedAt =
						typeof payload?.generatedAt === 'number' ? payload.generatedAt : Date.now();
					const saved = saveEntry(
						{
							placeName: pending.placeName,
							address: pending.address,
							language: pending.language,
							generatedAt,
							phrases,
							context: pending.context
						},
						pending.id
					);
					entry = saved;
					streaming = false;
				} else if (event === 'error') {
					streamError = payload?.message || 'Something went wrong.';
				}
			});

			if (streamError) throw new Error(streamError);
			if (!finalized) throw new Error('The phrase generator ended unexpectedly. Try again.');

			if (import.meta.env.DEV) {
				console.log(
					`[quick-phrases timing] page stream ${Math.round(performance.now() - tStart)}ms total` +
						` | first phrase ${firstAt ? Math.round(firstAt - tStart) : '?'}ms`
				);
			}
		} catch (err: any) {
			streamError = err?.message || 'Something went wrong.';
			streaming = false;
		}
	}

	function formatTime(ts: number): string {
		try {
			return new Date(ts).toLocaleString();
		} catch {
			return '';
		}
	}
</script>

<svelte:head>
	<title>{entry?.placeName || head?.placeName ? `Phrases near ${entry?.placeName ?? head?.placeName}` : 'Phrases'}</title>
</svelte:head>

<Section>
	<div class="max-w-2xl mx-auto py-6">
		<a href="/" class="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-6">
			<svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
			</svg>
			Back home
		</a>

		{#if !loaded}
			<p class="text-slate-500">Loading…</p>
		{:else if entry}
			<div class="mb-6">
				<p class="text-sm uppercase tracking-wide text-slate-500">
					{entry.language} phrases near
				</p>
				<h1 class="text-2xl font-semibold text-slate-800">{entry.placeName}</h1>
				<p class="text-sm text-slate-500">{entry.address}</p>
				<p class="text-xs text-slate-400 mt-1">{formatTime(entry.generatedAt)}</p>
			</div>

			<PhraseList
				phrases={entry.phrases}
				placeName={entry.placeName}
				address={entry.address}
				language={entry.language}
				context={entry.context}
			/>
		{:else if streaming || (streamError && head)}
			<div class="mb-6">
				<p class="text-sm uppercase tracking-wide text-slate-500">
					{head?.language} phrases near
				</p>
				<h1 class="text-2xl font-semibold text-slate-800">{head?.placeName}</h1>
				<p class="text-sm text-slate-500">{head?.address}</p>
				{#if streaming}
					<p class="text-xs text-emerald-600 mt-1 flex items-center gap-2">
						<span
							class="animate-spin rounded-full h-3 w-3 border-t-2 border-b-2 border-emerald-500"
						></span>
						Generating…
					</p>
				{/if}
			</div>

			{#if streamPhrases.length}
				<ul class="space-y-2">
					{#each streamPhrases as p, i (i)}
						<li class="bg-white border border-slate-200 rounded-lg px-4 py-3">
							<PhraseLine
								phrase={p}
								language={head?.language ?? ''}
								instructionLanguage={streamContext?.instructionLanguage}
							/>
						</li>
					{/each}
				</ul>
			{:else if streaming}
				<p class="text-slate-500 text-sm">Finding phrases for where you are…</p>
			{/if}

			{#if streamError}
				<div
					class="mt-4 bg-amber-50 border-l-4 border-amber-400 text-amber-800 px-6 py-4 rounded"
					role="alert"
				>
					<p class="text-sm">{streamError}</p>
				</div>
			{/if}
		{:else}
			<div class="bg-amber-50 border-l-4 border-amber-400 text-amber-800 px-6 py-4 rounded" role="alert">
				<p class="text-sm">
					These phrases couldn't be found. They may have expired from your recent
					history — generate a new set from the home page.
				</p>
			</div>
		{/if}
	</div>
</Section>
