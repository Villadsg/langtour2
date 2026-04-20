<script lang="ts">
	import { onMount } from 'svelte';
	import { citiesStore } from '$lib/stores/tourStore';
	import { ConvexService, currentUser } from '$lib/firebaseService';
	import Section from '$lib/components/Section.svelte';
	import FeatureCard from '$lib/components/FeatureCard.svelte';
	import TourMapView from '$lib/components/TourMapView.svelte';
	import type { TourListTour } from '$lib/components/TourListItem.svelte';

	import { gradients, text } from '$lib/styles/DesignSystem.svelte';
	import { getTourData, getStops } from '$lib/tourValidation';

	let allTours: (TourListTour & { tourType?: string; creatorId?: string })[] = [];
	let cities = $citiesStore;
	let tourTypeFilter: 'all' | 'person' | 'app' = 'all';
	let isLoading = true;
	let error = '';

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
</script>

{#if !$currentUser}
<div class={`${gradients.hero} ${text.primary} pt-24 pb-16`}>
	<div class="container mx-auto px-6">
		<div class="max-w-4xl mx-auto text-center">
			<h1 class="text-4xl md:text-5xl lg:text-6xl font-medium leading-tight mb-5 text-slate-700">
				Language learning city routes
			</h1>
			<p class="text-lg text-slate-500 mb-8 max-w-2xl mx-auto leading-relaxed">Learn a language while exploring a city</p>

			<div class="grid md:grid-cols-2 gap-4 md:gap-6 mt-4">
				<FeatureCard
					icon="<svg xmlns='http://www.w3.org/2000/svg' class='h-6 w-6' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' /></svg>"
					title="Discover Cities Through Language"
					description="Improve your language skills from the preparation material and the bilingual route guide, while exploring the city"
				/>
				<FeatureCard
					icon="<svg xmlns='http://www.w3.org/2000/svg' class='h-6 w-6' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' /></svg>"
					title="Become a Language Guide"
					description="Create your own language routes and share your expertise with others while earning income."
				/>
			</div>
		</div>
	</div>
</div>
{/if}

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
			Route Guide
		</button>
		<button
			class={`flex items-center px-4 py-2 rounded-full text-sm font-medium transition-all ${tourTypeFilter === 'app' ? 'bg-slate-600 text-white' : 'bg-white text-slate-500 hover:text-slate-600 hover:bg-slate-50 border border-slate-200'}`}
			on:click={() => tourTypeFilter = 'app'}
		>
			<svg class="h-4 w-4 mr-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
				<rect x="7" y="2" width="10" height="20" rx="2" />
				<circle cx="12" cy="18" r="1" />
			</svg>
			App-guide
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
