<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import Section from '$lib/components/Section.svelte';
	import { loadHistory, type HistoryEntry } from '$lib/quickPhrasesHistory';

	let entry: HistoryEntry | null = null;
	let loaded = false;

	$: id = $page.params.id;

	onMount(() => {
		entry = loadHistory().find((e) => e.id === id) ?? null;
		loaded = true;
	});

	function formatTime(ts: number): string {
		try {
			return new Date(ts).toLocaleString();
		} catch {
			return '';
		}
	}
</script>

<svelte:head>
	<title>{entry ? `Phrases near ${entry.placeName}` : 'Phrases'}</title>
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
		{:else if !entry}
			<div class="bg-amber-50 border-l-4 border-amber-400 text-amber-800 px-6 py-4 rounded" role="alert">
				<p class="text-sm">
					These phrases couldn't be found. They may have expired from your recent
					history — generate a new set from the home page.
				</p>
			</div>
		{:else}
			<div class="mb-6">
				<p class="text-sm uppercase tracking-wide text-slate-500">
					{entry.language} phrases near
				</p>
				<h1 class="text-2xl font-semibold text-slate-800">{entry.placeName}</h1>
				<p class="text-sm text-slate-500">{entry.address}</p>
				<p class="text-xs text-slate-400 mt-1">{formatTime(entry.generatedAt)}</p>
			</div>

			<ul class="space-y-2">
				{#each entry.phrases as p, i (i)}
					<li class="bg-white border border-slate-200 rounded-lg px-4 py-3">
						<p class="text-slate-900">{p.sentence}</p>
						{#if p.sentenceTranslation}
							<p class="text-sm text-slate-500 italic">{p.sentenceTranslation}</p>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</Section>
