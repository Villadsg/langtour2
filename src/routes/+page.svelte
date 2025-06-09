<script lang="ts">
	import { onMount } from 'svelte';
	import { citiesStore, type Tour } from '$lib/stores/tourStore';
	import { SupabaseService, currentUser, isAdmin } from '$lib/supabaseService';
	import TourCard from '$lib/components/TourCard.svelte';
	import { get } from 'svelte/store';
	import { toursStore } from '$lib/stores/tourStore';
	import Section from '$lib/components/Section.svelte';
	import FeatureCard from '$lib/components/FeatureCard.svelte';

	import { gradients, components, typography, spacing, text } from '$lib/styles/DesignSystem.svelte';

	let tours: Tour[] = [];
	let cities = $citiesStore;
	let searchQuery = '';
	// Tour type filter
	let tourTypeFilter = 'all'; // 'all', 'person', or 'app'
	let isLoading = true;
	let error = '';

	// Fetch tours from Supabase on component mount
	onMount(async () => {
		try {
			const response = await SupabaseService.getAllTours();
			
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
					console.error(`Error parsing tour data for tour ${doc.id}:`, parseError);
					// If parsing fails, use the description as is
					tourData = {
						name: 'Tour',
						description: doc.description || ''
					};
				}
				
				// Extract tourType - first check if it's directly on the doc, then in tourData
				const tourType = doc.tourType || tourData.tourType || 'person';
				
				// Extract price based on tour type
				let price = tourData.price;
				
				if (price === undefined) {
					price = tourType === 'app' ? 0 : 0; // Default price is 0
				}

				return {
					id: doc.id, // Use doc.id directly as per Supabase response structure
					cityId: tourData.cityId || '', // Prefer tourData for consistency from JSON
					name: tourData.name || 'Tour',
					languageTaught: tourData.languageTaught || '', // Correctly map languageTaught
					instructionLanguage: tourData.instructionLanguage || '', // Add instructionLanguage
					langDifficulty: tourData.langDifficulty || '', // Add langDifficulty
					description: tourData.description || '',
					imageUrl: doc.image_url, // Supabase typically uses snake_case for columns
					tourType: tourType, // tourType is already correctly extracted
					price: price // price is already correctly extracted
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

	// Filter tours based on search query and tour type
	$: filteredTours = tours.length
		? tours.filter(tour => {
			// Find the city for this tour
			const city = cities.find(c => c.id === tour.cityId);
			
			// Apply search query filter if present
			const matchesSearch = !searchQuery || (
				city?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				city?.country.toLowerCase().includes(searchQuery.toLowerCase()) ||
				tour.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				tour.languageTaught.toLowerCase().includes(searchQuery.toLowerCase())
			);
			
			// Apply tour type filter
			const matchesTourType = tourTypeFilter === 'all' || tour.tourType === tourTypeFilter;
			
			return matchesSearch && matchesTourType;
		})
		: [];
</script>



<!-- Hero section with gradient background - only visible when NOT logged in -->
{#if !$currentUser}
<div class={`${gradients.hero} ${text.primary} py-10`}>
	<div class="container mx-auto px-6">
		<div class="max-w-4xl mx-auto text-center">
			<h1 class={typography.heading.h1 + " mb-4"}>Language Learning Tours</h1>
			<p class={`text-xl ${text.secondary} mb-6`}>Explore cities and cultures through language learning</p>
			
			<!-- Feature highlights -->
			<div class="grid md:grid-cols-2 gap-3 md:gap-6 mt-8">
				<FeatureCard 
					icon="<svg xmlns='http://www.w3.org/2000/svg' class='h-6 w-6' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' /></svg>"
					title="Discover Cities Through Language"
					description="Experience cultural immersion while improving your language skills"
				/>
				
				<FeatureCard 
					icon="<svg xmlns='http://www.w3.org/2000/svg' class='h-6 w-6' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' /></svg>"
					title="Become a Language Guide"
					description="Create your own language tours and share your expertise with others while earning income."
				/>
			</div>
			
			<div class="mt-8">
				<a href="/login" class={components.button.secondary + " inline-block mx-2"}>Login</a>
				<a href="/signup" class={components.button.secondary + " inline-block mx-2"}>Sign Up</a>
			</div>
		</div>
	</div>
</div>
{/if}

<Section variant="muted">
	<div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
		<div>
			<h2 class={`${typography.heading.h2} ${text.primary} mb-2`}>Available Tours</h2>
			<p class={text.secondary}>Learn a language while experiencing a city</p>
		</div>
		
	</div>
	
	{#if error}
		<div class="bg-amber-50 border-l-4 border-amber-400 text-amber-800 px-6 py-4 mb-8" role="alert">
			<div class="flex">
				<div class="flex-shrink-0">
					<svg class="h-5 w-5 text-amber-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
						<path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
					</svg>
				</div>
				<div class="ml-3">
					<p class="text-sm font-medium">Connection Issue</p>
					<p class="text-sm mt-1">{error}</p>
					<p class="text-sm mt-1">Using local tour data instead. Tours created in the admin panel may not be visible.</p>
				</div>
			</div>
		</div>
	{/if}

	<!-- Search and filter section -->
	<div class="mb-6">
		<div class="max-w-4xl mx-auto">
			<!-- Search bar -->
			<div class="relative mb-4">
				<div class="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
					<svg class={`w-4 h-4 ${text.muted}`} aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20">
						<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z"/>
					</svg>
				</div>
				<input 
					type="text" 
					bind:value={searchQuery}
					class={components.input.base + " pl-10"}
					placeholder="Search by city, language, or tour name..."
				/>
			</div>
			
			<!-- Tour type filter -->
			<div class="flex justify-center items-center space-x-2">
				<span class="text-sm text-gray-600">Filter by:</span>
				
				<!-- All tours -->
				<button 
					class={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${tourTypeFilter === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
					on:click={() => tourTypeFilter = 'all'}
				>
					All Tours
				</button>
				
				<!-- Tour Guide filter -->
				<button 
					class={`flex items-center px-4 py-2 rounded-full text-sm font-medium transition-colors ${tourTypeFilter === 'person' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
					on:click={() => tourTypeFilter = 'person'}
				>
					<svg class="h-4 w-4 mr-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
					</svg>
					Tour Guide
				</button>
				
				<!-- App-guide filter -->
				<button 
					class={`flex items-center px-4 py-2 rounded-full text-sm font-medium transition-colors ${tourTypeFilter === 'app' ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-700 hover:bg-purple-100'}`}
					on:click={() => tourTypeFilter = 'app'}
				>
					<svg class="h-4 w-4 mr-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
						<rect x="7" y="2" width="10" height="20" rx="2" />
						<circle cx="12" cy="18" r="1" />
					</svg>
					App-guide
				</button>
			</div>
		</div>
	</div>
	
	<!-- Tours list -->
	<div class="grid grid-cols-1 md:grid-cols-2 gap-8">
		{#if filteredTours.length > 0}
			{#each filteredTours as tour}
				<TourCard {tour} />
			{/each}
		{:else}
			<div class="col-span-full border border-slate-200 p-10 text-center bg-white">
				<p class={text.secondary}>No tours found matching your search. Try a different search term.</p>
			</div>
		{/if}
	</div>
</Section>
