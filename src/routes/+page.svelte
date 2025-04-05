<script lang="ts">
	import { citiesStore } from '$lib/stores/tourStore';
	import CityCard from '$lib/components/CityCard.svelte';

	let cities = $citiesStore;
</script>

<div class="container mx-auto px-4 py-8">
	<h1 class="text-3xl font-bold mb-2">Language Learning Tours</h1>
	<p class="text-gray-600 mb-8">Select a city to explore language learning tours</p>
	
	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
		{#each cities as city}
			<CityCard {city} />
		{/each}
	</div>
</div>
