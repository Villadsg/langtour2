<script lang="ts">
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { ConvexService } from '$lib/firebaseService';
    
    interface Tour {
        $id: string;
        name: string;
        cityId: string;
        language: string;
        description: string;
        imageUrl?: string;
    }
    
    let isLoading = true;
    let tours: Tour[] = [];
    let error = '';
    
    onMount(async () => {
        try {
            // Check if user is logged in
            const user = await ConvexService.getAccount();
            if (!user) {
                // Redirect to login page if not implemented
                // For now, we'll just show the tours
            }
            
            // Fetch tours from Supabase
            const response = await ConvexService.getAllTours();
            
            // Process documents to extract tour data from JSON in description field
            tours = response.data.map((doc: any) => {
                let tourData: Partial<Tour> = {};
                
                // Parse the JSON from the description field
                try {
                    if (doc.description && typeof doc.description === 'string') {
                        tourData = JSON.parse(doc.description);
                    }
                } catch (parseError) {
                    console.error('Error parsing tour data:', parseError);
                }
                
                // Create a combined object with document properties and parsed tour data
                return {
                    $id: doc.$id,
                    name: tourData.name || '',
                    cityId: tourData.cityId || '',
                    language: tourData.language || '',
                    description: tourData.description || '',
                    imageUrl: doc.imageUrl
                };
            }) as Tour[];
            
            isLoading = false;
        } catch (err: any) {
            error = err.message || 'Failed to load tours';
            isLoading = false;
        }
    });
    
    const deleteTour = async (tourId: string) => {
        if (confirm('Are you sure you want to delete this route?')) {
            try {
                await ConvexService.deleteTour(tourId);
                tours = tours.filter(tour => tour.$id !== tourId);
            } catch (err: any) {
                error = err.message || 'Failed to delete tour';
            }
        }
    };
</script>

<div class="container mx-auto px-4 py-8">
    <div class="flex justify-between items-center mb-8">
        <h1 class="text-3xl font-bold">Manage Routes</h1>
        <a href="/create-with-ai" class="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-bold py-2 px-4 rounded">
            Create New Route
        </a>
    </div>
    
    {#if error}
        <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert">
            <p>{error}</p>
        </div>
    {/if}
    
    {#if isLoading}
        <div class="flex justify-center items-center h-64">
            <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-slate-300"></div>
        </div>
    {:else}
        {#if tours.length === 0}
            <div class="bg-slate-50 p-8 border border-slate-200 rounded-lg text-center">
                <p class="text-slate-600">No routes found. Create your first route!</p>
            </div>
        {:else}
            <div class="overflow-x-auto">
                <table class="min-w-full bg-white rounded-lg overflow-hidden border border-slate-200">
                    <thead class="bg-slate-50 text-slate-700">
                        <tr>
                            <th class="py-3 px-4 text-left">Name</th>
                            <th class="py-3 px-4 text-left">City</th>
                            <th class="py-3 px-4 text-left">Language</th>
                            <th class="py-3 px-4 text-left">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-200">
                        {#each tours as tour}
                            <tr class="hover:bg-slate-50">
                                <td class="py-3 px-4">{tour.name}</td>
                                <td class="py-3 px-4">{tour.cityId}</td>
                                <td class="py-3 px-4">{tour.language}</td>
                                <td class="py-3 px-4 flex space-x-2">
                                    <a href="/admin/edit/{tour.$id}" class="text-slate-600 hover:text-slate-700">
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
