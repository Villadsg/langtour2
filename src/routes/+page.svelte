<script lang="ts">
	import { toursStore, citiesStore } from '$lib/stores/tourStore';
	import TourCard from '$lib/components/TourCard.svelte';

	let tours = $toursStore;
	let cities = $citiesStore;
	let searchQuery = '';

	// Filter tours based on search query
	$: filteredTours = searchQuery
		? tours.filter(tour => {
			// Find the city for this tour
			const city = cities.find(c => c.id === tour.cityId);
			// Match against city name, country, tour name, or language
			return (
				city?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				city?.country.toLowerCase().includes(searchQuery.toLowerCase()) ||
				tour.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				tour.language.toLowerCase().includes(searchQuery.toLowerCase())
			);
		})
		: tours;
</script>

<div class="container mx-auto px-4 py-8">
	<h1 class="text-3xl font-bold mb-2">Language Learning Tours</h1>
	<p class="text-gray-600 mb-4">Explore language learning tours in Copenhagen and Madrid</p>
	
	<!-- Search bar -->
	<div class="mb-8">
		<div class="relative">
			<div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
				<svg class="w-4 h-4 text-gray-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20">
					<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z"/>
				</svg>
			</div>
			<input 
				type="text" 
				bind:value={searchQuery}
				class="block w-full p-4 pl-10 text-sm text-gray-900 border border-gray-300 rounded-lg bg-white focus:ring-blue-500 focus:border-blue-500" 
				placeholder="Search by city, language, or tour name..."
			/>
		</div>
	</div>
	
	<!-- Tours list -->
	<div class="space-y-6 max-h-[70vh] overflow-y-auto pr-2 pb-4">
		{#if filteredTours.length > 0}
			{#each filteredTours as tour}
				<TourCard {tour} />
			{/each}
		{:else}
			<div class="bg-gray-100 p-8 rounded-lg text-center">
				<p class="text-gray-600">No tours found matching your search. Try a different search term.</p>
			</div>
		{/if}
	</div>
</div>
