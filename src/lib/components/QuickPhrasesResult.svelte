<script lang="ts">
	import { onMount } from 'svelte';
	import {
		loadHistory,
		clearHistory,
		type HistoryEntry,
		type QuickPhrase
	} from '$lib/quickPhrasesHistory';

	export let result: {
		phrases: QuickPhrase[];
		placeName: string;
		address: string;
		language: string;
		generatedAt: number;
	} | null = null;

	let history: HistoryEntry[] = [];
	let historyOpen = false;
	let viewing: HistoryEntry | null = null;
	let expandedIdx: number | null = null;

	function refreshHistory() {
		history = loadHistory();
	}

	onMount(() => {
		refreshHistory();
	});

	$: if (result) {
		refreshHistory();
		expandedIdx = null;
		viewing = null;
	}

	$: shown = viewing
		? {
				phrases: viewing.phrases,
				placeName: viewing.placeName,
				address: viewing.address,
				language: viewing.language,
				generatedAt: viewing.generatedAt
			}
		: result;

	function toggleExpand(i: number) {
		expandedIdx = expandedIdx === i ? null : i;
	}

	function formatTime(ts: number): string {
		try {
			return new Date(ts).toLocaleString();
		} catch {
			return '';
		}
	}

	function handleClear() {
		clearHistory();
		refreshHistory();
		viewing = null;
	}
</script>

{#if shown}
	<div class="mt-8 text-left w-full max-w-2xl mx-auto">
		<div class="mb-4">
			<p class="text-sm uppercase tracking-wide text-slate-500">
				{shown.language} phrases near
			</p>
			<h3 class="text-xl font-semibold text-slate-800">{shown.placeName}</h3>
			<p class="text-sm text-slate-500">{shown.address}</p>
			{#if viewing}
				<p class="text-xs text-slate-400 mt-1">From history · {formatTime(shown.generatedAt)}</p>
			{/if}
		</div>

		<ul class="space-y-2">
			{#each shown.phrases as p, i (i)}
				<li>
					<button
						type="button"
						on:click={() => toggleExpand(i)}
						class="w-full text-left bg-white border border-slate-200 hover:border-emerald-300 rounded-lg px-4 py-3 transition-colors"
					>
						<div class="flex items-baseline justify-between gap-3">
							<span class="text-lg font-medium text-slate-900">{p.word}</span>
							<span class="text-sm text-slate-500">{p.translation}</span>
						</div>
						{#if expandedIdx === i && (p.sentence || p.context)}
							<div class="mt-2 pt-2 border-t border-slate-100 text-sm space-y-1">
								{#if p.sentence}
									<p class="text-slate-800">{p.sentence}</p>
									<p class="text-slate-500 italic">{p.sentenceTranslation}</p>
								{/if}
								{#if p.context}
									<p class="text-xs text-slate-400">Context: {p.context}</p>
								{/if}
							</div>
						{/if}
					</button>
				</li>
			{/each}
		</ul>

		{#if viewing}
			<button
				type="button"
				on:click={() => (viewing = null)}
				class="mt-4 text-sm text-emerald-700 hover:text-emerald-800"
			>
				← Back to latest
			</button>
		{/if}
	</div>
{/if}

{#if history.length > 0}
	<div class="mt-8 w-full max-w-2xl mx-auto text-left">
		<button
			type="button"
			on:click={() => (historyOpen = !historyOpen)}
			class="text-sm text-slate-600 hover:text-slate-800 flex items-center gap-1"
		>
			<svg
				class="h-4 w-4 transition-transform {historyOpen ? 'rotate-90' : ''}"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				viewBox="0 0 24 24"
			>
				<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
			</svg>
			History ({history.length})
		</button>

		{#if historyOpen}
			<ul class="mt-3 space-y-2">
				{#each history as h (h.id)}
					<li>
						<button
							type="button"
							on:click={() => (viewing = h)}
							class="w-full text-left bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md px-3 py-2"
						>
							<div class="flex justify-between items-baseline gap-2">
								<span class="font-medium text-slate-800 truncate">{h.placeName}</span>
								<span class="text-xs text-slate-500 flex-shrink-0">{h.language}</span>
							</div>
							<p class="text-xs text-slate-500">{formatTime(h.generatedAt)}</p>
						</button>
					</li>
				{/each}
			</ul>
			<button
				type="button"
				on:click={handleClear}
				class="mt-3 text-xs text-slate-500 hover:text-red-600"
			>
				Clear history
			</button>
		{/if}
	</div>
{/if}
