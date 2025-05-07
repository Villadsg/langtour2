<script lang="ts">
	import { onMount } from 'svelte';
	import { citiesStore, type Tour } from '$lib/stores/tourStore';
	import { SupabaseService, currentUser, isAdmin } from '$lib/supabaseService';
	import TourCard from '$lib/components/TourCard.svelte';
	import NavBar from '$lib/components/NavBar.svelte';
	import { get } from 'svelte/store';
	import { toursStore } from '$lib/stores/tourStore';

	let tours: Tour[] = [];
	let cities = $citiesStore;
	let searchQuery = '';
	let isLoading = true;
	let error = '';

	// Fetch tours from Supabase on component mount
	onMount(async () => {
		try {
			console.log('Attempting to fetch tours from Supabase...');
			const response = await SupabaseService.getAllTours();
			console.log('Supabase response:', response);
			
			// Map Supabase records to Tour objects, extracting data from JSON in description field
			tours = response.data.map((doc: any) => {
				let tourData: Partial<Tour> = {};
				
				// Handle the description field which might be JSON or a plain string
				try {
					if (doc.description) {
						if (typeof doc.description === 'string') {
							// Check if it looks like JSON (starts with { or [)
							if (doc.description.trim().startsWith('{') || doc.description.trim().startsWith('[')) {
								tourData = JSON.parse(doc.description);
							} else {
								// It's a plain string, create a simple object with description
								tourData = {
									description: doc.description
								};
							}
						} else if (typeof doc.description === 'object') {
							// It's already an object
							tourData = doc.description;
						}
					}
				} catch (parseError) {
					console.error('Error parsing tour data:', parseError);
					// If parsing fails, use the description as is
					tourData = {
						name: 'Tour',
						description: doc.description || ''
					};
				}
				
				return {
					id: doc.$id,
					cityId: tourData.cityId || '',
					name: doc.name || tourData.name || 'Tour',
					language: tourData.language || '',
					description: tourData.description || '',
					imageUrl: doc.imageUrl
				};
			});
			isLoading = false;
			error = ''; // Clear any previous errors
		} catch (err: any) {
			const errorMessage = err.message || 'Unknown error';
			error = `Failed to load tours from Supabase: ${errorMessage}. Falling back to local data.`;
			console.error('Error loading tours from Supabase:', err);
			// Fallback to local data if Supabase fails
			tours = get(toursStore);
			isLoading = false;
		}
	});

	// Filter tours based on search query
	$: filteredTours = searchQuery && tours.length
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

<NavBar />

<!-- Site features information -->
<div class="bg-gradient-to-r from-blue-50 to-white py-4 px-6 mb-8 rounded-lg shadow-sm border-l-4 border-blue-500">
	<div class="container mx-auto">
		<div class="flex flex-col lg:flex-row justify-center items-start lg:items-center space-y-4 lg:space-y-0 lg:space-x-16">
			<div class="flex items-start max-w-lg">
				<svg class="h-5 w-5 text-blue-500 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
				</svg>
				<div class="flex-1">
					<span class="font-medium whitespace-normal">Discover cities or cafeterias through language learning</span>
					<span class="block text-sm text-gray-600 mt-1">Explore new places while practicing languages with locals</span>
				</div>
			</div>
			<div class="flex items-start max-w-lg">
				<svg class="h-5 w-5 text-blue-500 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
				</svg>
				<div class="flex-1">
					<span class="font-medium whitespace-normal">Create tours to become a language teacher on the move</span>
					<span class="block text-sm text-gray-600 mt-1">Share your language skills and cultural knowledge with others</span>
				</div>
			</div>
		</div>
	</div>
</div>
<div class="container mx-auto px-4 py-8">
	<div class="flex justify-between items-center mb-6">
		<div>
			<h1 class="text-3xl font-bold mb-2">Language Learning Tours</h1>
			<p class="text-gray-600">Explore language learning tours in Copenhagen and Madrid</p>
		</div>
		{#if $currentUser && $isAdmin}
			<a href="/dashboard" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
				Manage Tours
			</a>
		{/if}
	</div>
	
	
	{#if error}
		<div class="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4" role="alert">
			<div class="flex">
				<div class="py-1">
					<svg class="fill-current h-6 w-6 text-yellow-500 mr-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
						<path d="M2.93 17.07A10 10 0 1 1 17.07 2.93 10 10 0 0 1 2.93 17.07zm12.73-1.41A8 8 0 1 0 4.34 4.34a8 8 0 0 0 11.32 11.32zM9 11V9h2v6H9v-4zm0-6h2v2H9V5z"/>
					</svg>
				</div>
				<div>
					<p class="font-bold">Connection Issue</p>
					<p class="text-sm">{error}</p>
					<p class="text-sm mt-2">Using local tour data instead. Tours created in the admin panel may not be visible.</p>
				</div>
			</div>
		</div>
	{/if}

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
