<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { fade } from 'svelte/transition';
	import { citiesStore } from '$lib/stores/tourStore';
	import { ConvexService, currentUser } from '$lib/firebaseService';
	import Section from '$lib/components/Section.svelte';
	import TourMapView from '$lib/components/TourMapView.svelte';
	import QuickPhrasesButton from '$lib/components/QuickPhrasesButton.svelte';
	import QuickPhrasesResult from '$lib/components/QuickPhrasesResult.svelte';
	import type { TourListTour } from '$lib/components/TourListItem.svelte';
	import type { QuickPhrase } from '$lib/quickPhrasesHistory';

	import { text } from '$lib/styles/DesignSystem.svelte';
	import { getTourData, getStops } from '$lib/tourValidation';

	let allTours: (TourListTour & { tourType?: string; creatorId?: string })[] = [];
	let cities = $citiesStore;
	let tourTypeFilter: 'all' | 'person' | 'app' = 'all';
	let isLoading = true;
	let error = '';

	// Hero: single Madrid photo, rotating text pairs
	const heroImage = 'https://images.unsplash.com/photo-1543783207-ec64e4d95325?w=1920&q=80&auto=format&fit=crop';
	const heroPairs: { city: string; language: string }[] = [
		{ city: 'Madrid', language: 'Spanish' },
		{ city: 'Copenhagen', language: 'Danish' },
		{ city: 'Rome', language: 'Italian' },
		{ city: 'Paris', language: 'French' },
		{ city: 'Berlin', language: 'German' },
		{ city: 'Anywhere', language: 'English' }
	];
	let heroIdx = 0;
	let heroInterval: ReturnType<typeof setInterval> | null = null;
	$: hero = heroPairs[heroIdx];

	onMount(() => {
		heroInterval = setInterval(() => {
			heroIdx = (heroIdx + 1) % heroPairs.length;
		}, 4500);
	});
	onDestroy(() => {
		if (heroInterval) clearInterval(heroInterval);
	});

	function scrollToRoutes() {
		document.getElementById('available-routes')?.scrollIntoView({ behavior: 'smooth' });
	}

	onMount(async () => {
		try {
			const response = await ConvexService.getAllTours();
			allTours = response.data
				.map((doc: any) => {
					const parsed = getTourData(doc);
					const stops = getStops(doc);
					const city = cities.find(c => c.id === parsed.cityId);
					return {
						id: parsed.id,
						name: parsed.name,
						cityName: city ? `${city.name}, ${city.country}` : undefined,
						languageTaught: parsed.languageTaught || parsed.language,
						instructionLanguage: parsed.instructionLanguage,
						langDifficulty: parsed.langDifficulty,
						tourType: parsed.tourType,
						stops,
						creatorId: doc.creatorId
					};
				})
				.filter((t: any) => t.id && t.stops?.length > 0);
			isLoading = false;
		} catch (err: any) {
			error = `Failed to load routes: ${err.message || 'Unknown error'}.`;
			console.error('Error loading tours:', err);
			isLoading = false;
		}
	});

	$: filteredTours = allTours.filter(t =>
		tourTypeFilter === 'all' || t.tourType === tourTypeFilter
	);

	$: currentUserId = $currentUser?.id ?? null;
	$: ownedTourIds = new Set(
		allTours
			.filter(t => currentUserId && t.creatorId === currentUserId)
			.map(t => t.id)
	);

	let learningLanguage: string | null = null;
	let lastFetchedUserId: string | null = null;

	async function syncLearningLanguage(userId: string | null) {
		if (!userId) {
			learningLanguage = null;
			lastFetchedUserId = null;
			return;
		}
		if (userId === lastFetchedUserId) return;
		lastFetchedUserId = userId;
		try {
			const profile = await ConvexService.getPublicProfile(userId);
			learningLanguage = profile?.learningLanguage || null;
		} catch {
			learningLanguage = null;
		}
	}

	$: syncLearningLanguage(currentUserId);

	let quickResult: {
		phrases: QuickPhrase[];
		placeName: string;
		address: string;
		language: string;
		generatedAt: number;
	} | null = null;
</script>

<svelte:head>
	{#if !$currentUser}
		<link rel="preload" as="image" href={heroImage} />
	{/if}
</svelte:head>
{#if !$currentUser}
<section
	class="relative min-h-[70vh] flex items-center justify-center overflow-hidden bg-center bg-cover"
	style={`background-image: url('${heroImage}');`}
>
	<div class="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/75" aria-hidden="true"></div>

	<div class="relative container mx-auto px-6 py-24 text-left text-white hero-text max-w-5xl">
		<h1 class="text-4xl md:text-5xl lg:text-6xl font-semibold leading-tight mb-10 space-y-1">
			<div>
				Let
				<span class="inline-grid align-baseline text-amber-300">
					{#key hero.city}
						<span style="grid-area: 1 / 1" in:fade={{ duration: 600 }} out:fade={{ duration: 600 }}>{hero.city}</span>
					{/key}
				</span>
			</div>
			<div>teach you
			<div class="inline-grid text-amber-300">
				{#key hero.language}
					<span style="grid-area: 1 / 1" in:fade={{ duration: 600 }} out:fade={{ duration: 600 }}>{hero.language}</span>
				{/key}
			</div>
			</div>
		</h1>

		<div class="grid gap-6 md:grid-cols-2 items-stretch">
			<div class="flex flex-col bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6">
				<p class="text-lg md:text-xl text-white/95 mb-6 leading-relaxed">
					Phrases tied to what's around you, right now.
				</p>
				<div class="mt-auto">
					<QuickPhrasesButton
						onDark
						{learningLanguage}
						on:result={(e) => (quickResult = e.detail)}
					/>
				</div>
			</div>

			<div class="flex flex-col bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6">
				<p class="text-lg md:text-xl text-white/95 mb-6 leading-relaxed">
					Language learning routes guided by local bilingual teachers.
				</p>
				<div class="mt-auto flex flex-col sm:flex-row gap-3 items-stretch sm:items-start">
					<button
						on:click={scrollToRoutes}
						class="w-full sm:w-auto text-center bg-white text-slate-800 hover:bg-slate-100 font-medium py-3 px-8 rounded-lg transition-colors shadow-lg"
					>
						Browse routes
					</button>
					<a
						href="/signup"
						class="w-full sm:w-auto text-center bg-white/15 backdrop-blur-sm border border-white/50 text-white font-medium py-3 px-8 rounded-lg transition-colors"
					>
						Become a guide
					</a>
				</div>
			</div>
		</div>
	</div>
</section>
{/if}

<style>
	.hero-text :global(h1),
	.hero-text :global(h2),
	.hero-text :global(p) {
		text-shadow: 0 2px 12px rgba(0, 0, 0, 0.6), 0 1px 3px rgba(0, 0, 0, 0.5);
	}
</style>

{#if $currentUser}
<Section>
	<div class="text-center max-w-2xl mx-auto py-6">
		<h2 class="text-2xl font-medium text-slate-700 mb-1">Learn from where you are</h2>
		<div class="w-10 h-0.5 bg-slate-300 rounded-full mb-3 mx-auto"></div>
		<p class="text-slate-500 mb-6">
			Tap below to get phrases tied to what's around you right now.
		</p>
		<QuickPhrasesButton
			{learningLanguage}
			on:result={(e) => (quickResult = e.detail)}
		/>
		<QuickPhrasesResult result={quickResult} />
	</div>
</Section>
{/if}

<div id="available-routes"></div>
<Section variant="muted">
	<div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
		<div>
			<h2 class="text-2xl font-medium text-slate-700 mb-1">Available Routes</h2>
			<div class="w-10 h-0.5 bg-slate-300 rounded-full mb-2"></div>
			<p class={text.secondary}>Explore language routes near you on the map</p>
		</div>
	</div>

	{#if error}
		<div class="bg-amber-50 border-l-4 border-amber-400 text-amber-800 px-6 py-4 mb-6" role="alert">
			<p class="text-sm">{error}</p>
		</div>
	{/if}

	<div class="flex justify-center items-center space-x-2 mb-4">
		<span class="text-sm text-slate-500">Filter by:</span>
		<button
			class={`px-4 py-2 rounded-full text-sm font-medium transition-all ${tourTypeFilter === 'all' ? 'bg-slate-600 text-white' : 'bg-white text-slate-500 hover:text-slate-600 hover:bg-slate-50 border border-slate-200'}`}
			on:click={() => tourTypeFilter = 'all'}
		>
			All Routes
		</button>
		<button
			class={`flex items-center px-4 py-2 rounded-full text-sm font-medium transition-all ${tourTypeFilter === 'person' ? 'bg-slate-600 text-white' : 'bg-white text-slate-500 hover:text-slate-600 hover:bg-slate-50 border border-slate-200'}`}
			on:click={() => tourTypeFilter = 'person'}
		>
			<svg class="h-4 w-4 mr-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
			</svg>
			In-Person Guide
		</button>
		<button
			class={`flex items-center px-4 py-2 rounded-full text-sm font-medium transition-all ${tourTypeFilter === 'app' ? 'bg-slate-600 text-white' : 'bg-white text-slate-500 hover:text-slate-600 hover:bg-slate-50 border border-slate-200'}`}
			on:click={() => tourTypeFilter = 'app'}
		>
			<svg class="h-4 w-4 mr-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
				<rect x="7" y="2" width="10" height="20" rx="2" />
				<circle cx="12" cy="18" r="1" />
			</svg>
			App-Guided
		</button>
	</div>

	{#if isLoading}
		<div class="border border-slate-200 p-10 text-center bg-white rounded-lg">
			<p class={text.secondary}>Loading routes...</p>
		</div>
	{:else}
		<TourMapView
			tours={filteredTours}
			{currentUserId}
			{ownedTourIds}
		/>
	{/if}
</Section>
