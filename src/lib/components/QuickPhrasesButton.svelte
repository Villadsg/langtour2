<script lang="ts">
	import { createEventDispatcher, onDestroy } from 'svelte';
	import { userLocation, refreshUserLocation } from '$lib/stores/userLocation';
	import { reverseGeocode } from '$lib/geocodingService';
	import { fetchNearbyPois, type NearbyPoi } from '$lib/nearbyPois';
	import { saveEntry, type QuickPhrase } from '$lib/quickPhrasesHistory';

	export let learningLanguage: string | null = null;
	export let instructionLanguage: string = 'English';
	export let cefrLevel: string = 'A2';

	const dispatch = createEventDispatcher<{
		result: {
			phrases: QuickPhrase[];
			placeName: string;
			address: string;
			language: string;
			generatedAt: number;
		};
	}>();

	const LANGUAGE_OPTIONS = [
		'Spanish',
		'French',
		'Italian',
		'German',
		'Portuguese',
		'Danish',
		'Dutch',
		'Swedish',
		'Norwegian',
		'Japanese',
		'Mandarin',
		'Korean',
		'Greek',
		'Turkish',
		'Polish'
	];

	const LANG_STORAGE_KEY = 'lastQuickPhrasesLanguage';

	type Phase = 'idle' | 'locating' | 'fetching-context' | 'generating' | 'error';
	let phase: Phase = 'idle';
	let errorMsg = '';
	let pickedLanguage: string =
		learningLanguage ||
		(typeof localStorage !== 'undefined' ? localStorage.getItem(LANG_STORAGE_KEY) || '' : '');

	$: effectiveLanguage = learningLanguage || pickedLanguage;
	$: needsPicker = !learningLanguage;

	let unsubscribe: (() => void) | null = null;

	function waitForCoords(timeoutMs: number): Promise<{ lat: number; lng: number }> {
		return new Promise((resolve, reject) => {
			const existing = getCurrentCoords();
			if (existing) {
				resolve(existing);
				return;
			}
			const timer = setTimeout(() => {
				if (unsubscribe) unsubscribe();
				unsubscribe = null;
				reject(new Error('Location request timed out. Check that location permission is allowed.'));
			}, timeoutMs);

			unsubscribe = userLocation.subscribe((coords) => {
				if (coords) {
					clearTimeout(timer);
					if (unsubscribe) unsubscribe();
					unsubscribe = null;
					resolve(coords);
				}
			});
		});
	}

	function getCurrentCoords(): { lat: number; lng: number } | null {
		let snapshot: { lat: number; lng: number } | null = null;
		const u = userLocation.subscribe((v) => (snapshot = v));
		u();
		return snapshot;
	}

	async function handleClick() {
		errorMsg = '';
		if (!effectiveLanguage) {
			errorMsg = 'Pick a language first.';
			return;
		}
		if (typeof navigator !== 'undefined' && !navigator.geolocation) {
			errorMsg = 'Your browser does not support geolocation.';
			return;
		}

		try {
			phase = 'locating';
			const fresh = await refreshUserLocation();
			const coords = fresh ?? (await waitForCoords(15000));

			phase = 'fetching-context';
			const [place, pois] = await Promise.all([
				reverseGeocode(coords.lat, coords.lng),
				fetchNearbyPois(coords.lat, coords.lng)
			]);

			const placeName = place?.placeName || 'your current location';
			const address = place?.address || `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`;
			const city = place?.city;
			const country = place?.country;

			const now = new Date();
			const h = now.getHours();
			const timeBucket =
				h < 6 ? 'late night'
					: h < 11 ? 'morning'
					: h < 15 ? 'midday'
					: h < 18 ? 'afternoon'
					: h < 22 ? 'evening'
					: 'late night';
			const localTime = `${String(h).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

			phase = 'generating';
			const res = await fetch('/api/quick-phrases', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					language: effectiveLanguage,
					cefrLevel,
					placeName,
					address,
					city,
					country,
					timeBucket,
					localTime,
					pois,
					instructionLanguage
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

			const data = (await res.json()) as { phrases: QuickPhrase[]; generatedAt: number };

			if (typeof localStorage !== 'undefined' && !learningLanguage) {
				try {
					localStorage.setItem(LANG_STORAGE_KEY, effectiveLanguage);
				} catch {
					/* ignore */
				}
			}

			saveEntry({
				placeName,
				address,
				language: effectiveLanguage,
				generatedAt: data.generatedAt,
				phrases: data.phrases
			});

			dispatch('result', {
				phrases: data.phrases,
				placeName,
				address,
				language: effectiveLanguage,
				generatedAt: data.generatedAt
			});

			phase = 'idle';
		} catch (err: any) {
			phase = 'error';
			errorMsg = err?.message || 'Something went wrong.';
		}
	}

	function dismissError() {
		errorMsg = '';
		phase = 'idle';
	}

	onDestroy(() => {
		if (unsubscribe) unsubscribe();
	});

	$: busy = phase === 'locating' || phase === 'fetching-context' || phase === 'generating';
	$: buttonLabel =
		phase === 'locating'
			? 'Finding you…'
			: phase === 'fetching-context'
				? 'Looking around…'
				: phase === 'generating'
					? 'Generating phrases…'
					: 'Phrases from here';
</script>

<div class="flex flex-col items-center gap-3 w-full">
	{#if needsPicker}
		<label class="text-sm text-slate-600 flex items-center gap-2">
			Learning:
			<select
				bind:value={pickedLanguage}
				disabled={busy}
				class="border border-slate-300 rounded-md px-2 py-1 bg-white text-slate-800"
			>
				<option value="" disabled>Choose a language</option>
				{#each LANGUAGE_OPTIONS as lang}
					<option value={lang}>{lang}</option>
				{/each}
			</select>
		</label>
	{/if}

	<button
		type="button"
		on:click={handleClick}
		disabled={busy || !effectiveLanguage}
		class="w-full sm:w-auto inline-flex items-center justify-center gap-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-4 px-8 rounded-lg shadow-lg transition-colors text-lg"
	>
		{#if busy}
			<span class="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></span>
		{:else}
			<svg class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" d="M12 11c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3z"/>
				<path stroke-linecap="round" stroke-linejoin="round" d="M19 11c0 7-7 11-7 11s-7-4-7-11a7 7 0 1114 0z"/>
			</svg>
		{/if}
		{buttonLabel}
	</button>

	{#if errorMsg}
		<div class="mt-2 flex items-start gap-2 bg-amber-50 border-l-4 border-amber-400 text-amber-800 px-4 py-3 rounded text-sm max-w-md">
			<span class="flex-1">{errorMsg}</span>
			<button on:click={dismissError} class="text-amber-700 hover:text-amber-900" aria-label="Dismiss">×</button>
		</div>
	{/if}
</div>
