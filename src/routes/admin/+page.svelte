<script lang="ts">
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { AppwriteService } from '$lib/appwriteService';
    import type { Models } from 'appwrite';
    
    interface AppwriteTour extends Models.Document {
        name: string;
        cityId: string;
        language: string;
        description: string;
        imageUrl?: string;
    }
    
    let isLoading = true;
    let tours: AppwriteTour[] = [];
    let error = '';
    
    onMount(async () => {
        try {
            // Check if user is logged in
            const user = await AppwriteService.getAccount();
            if (!user) {
                // Redirect to login page if not implemented
                // For now, we'll just show the tours
            }
            
            // Fetch tours from Appwrite
            const response = await AppwriteService.getAllTours();
            
            // Process documents to extract tour data from JSON in description field
            tours = response.documents.map(doc => {
                let tourData: Partial<AppwriteTour> = {};
                
                // Parse the JSON from the description field
                try {
                    if (doc.description && typeof doc.description === 'string') {
                        tourData = JSON.parse(doc.description);
                    }
                } catch (parseError) {
                    console.error('Error parsing tour data:', parseError);
                }
                
                // Create a combined object with Appwrite document properties and parsed tour data
                return {
                    ...doc,
                    name: tourData.name || '',
                    cityId: tourData.cityId || '',
                    language: tourData.language || '',
                    description: tourData.description || ''
                };
            }) as AppwriteTour[];
            
            isLoading = false;
        } catch (err: any) {
            error = err.message || 'Failed to load tours';
            isLoading = false;
        }
    });
    
    const deleteTour = async (tourId: string) => {
        if (confirm('Are you sure you want to delete this tour?')) {
            try {
                await AppwriteService.deleteTour(tourId);
                tours = tours.filter(tour => tour.$id !== tourId);
            } catch (err: any) {
                error = err.message || 'Failed to delete tour';
            }
        }
    };
</script>

<div class="container mx-auto px-4 py-8">
    <div class="flex justify-between items-center mb-8">
        <h1 class="text-3xl font-bold">Manage Tours</h1>
        <a href="/admin/create" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
            Create New Tour
        </a>
    </div>
    
    {#if error}
        <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert">
            <p>{error}</p>
        </div>
    {/if}
    
    {#if isLoading}
        <div class="flex justify-center items-center h-64">
            <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
    {:else}
        {#if tours.length === 0}
            <div class="bg-gray-100 p-8 rounded-lg text-center">
                <p class="text-gray-600">No tours found. Create your first tour!</p>
            </div>
        {:else}
            <div class="overflow-x-auto">
                <table class="min-w-full bg-white rounded-lg overflow-hidden shadow-md">
                    <thead class="bg-gray-100 text-gray-700">
                        <tr>
                            <th class="py-3 px-4 text-left">Name</th>
                            <th class="py-3 px-4 text-left">City</th>
                            <th class="py-3 px-4 text-left">Language</th>
                            <th class="py-3 px-4 text-left">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200">
                        {#each tours as tour}
                            <tr class="hover:bg-gray-50">
                                <td class="py-3 px-4">{tour.name}</td>
                                <td class="py-3 px-4">{tour.cityId}</td>
                                <td class="py-3 px-4">{tour.language}</td>
                                <td class="py-3 px-4 flex space-x-2">
                                    <a href="/admin/edit/{tour.$id}" class="text-blue-600 hover:text-blue-800">
                                        Edit
                                    </a>
                                    <button 
                                        on:click={() => deleteTour(tour.$id)} 
                                        class="text-red-600 hover:text-red-800"
                                    >
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        {/if}
    {/if}
</div>
