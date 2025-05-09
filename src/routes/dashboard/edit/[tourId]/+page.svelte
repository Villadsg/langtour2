<script lang="ts">
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';
    import { SupabaseService, currentUser } from '$lib/supabaseService';
    import TourForm from '$lib/components/TourForm.svelte';
    import type { Tour } from '$lib/stores/tourStore';

    
    interface SupabaseTour extends Omit<Tour, 'id'> {
        $id: string;
        imageUrl?: string;
    }
    
    const tourId = $page.params.tourId;
    
    let isLoading = true;
    let isSubmitting = false;
    let tour: SupabaseTour | null = null;
    let error = '';
    
    onMount(async () => {
        try {
            // Check if user is logged in
            const user = await SupabaseService.getAccount();
            if (!user) {
                // Redirect to login page if not logged in
                goto('/login');
                return;
            }
            
            // Fetch tour from Supabase
            const doc = await SupabaseService.getTour(tourId);
            
            // Check if the current user is the creator of this tour
            const creatorId = await SupabaseService.getTourCreatorId(tourId);
            if (creatorId !== user.id) {
                error = "You don't have permission to edit this tour";
                isLoading = false;
                return;
            }
            
            // Parse the JSON from the description field
            let tourData: Partial<SupabaseTour> = {};
            try {
                if (doc.description) {
                    if (typeof doc.description === 'string') {
                        tourData = JSON.parse(doc.description);
                    } else {
                        tourData = doc.description;
                    }
                }
            } catch (parseError) {
                console.error('Error parsing tour data:', parseError);
            }
            
            // Create a combined object with Supabase document properties and parsed tour data
            tour = {
                $id: doc.id,
                name: tourData.name || '',
                cityId: tourData.cityId || '',
                language: tourData.language || '',
                description: tourData.description || '',
                imageUrl: doc.image_url
            } as SupabaseTour;
            
            isLoading = false;
        } catch (err: any) {
            error = err.message || 'Failed to load tour';
            isLoading = false;
        }
    });
    
    const handleSubmit = async (event: { detail: Partial<Tour> }) => {
        const tourData = event.detail;
        isSubmitting = true;
        error = '';
        
        try {
            // Update tour in Supabase
            await SupabaseService.updateTour(tourId, tourData);
            
            // Redirect to dashboard page
            goto('/dashboard');
        } catch (err: any) {
            error = err.message || 'Failed to update tour';
            isSubmitting = false;
        }
    };
    
    const handleCancel = () => {
        goto('/dashboard');
    };
</script>


<div class="container mx-auto px-4 py-8">
    <div class="mb-8">
        <a href="/dashboard" class="text-blue-600 hover:underline inline-flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clip-rule="evenodd" />
            </svg>
            Back to Dashboard
        </a>
    </div>

    <h1 class="text-3xl font-bold mb-6">Edit Tour</h1>
    
    {#if error}
        <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert">
            <p>{error}</p>
        </div>
    {/if}
    
    {#if isLoading || isSubmitting}
        <div class="flex justify-center items-center h-64">
            <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
    {:else if tour}
        <TourForm 
            tour={{
                name: tour.name,
                cityId: tour.cityId,
                language: tour.language,
                description: tour.description,
                imageUrl: tour.imageUrl || ''
            }} 
            isEditing={true} 
            on:submit={handleSubmit} 
            on:cancel={handleCancel} 
        />
    {:else}
        <div class="bg-red-100 p-8 rounded-lg text-center">
            <p class="text-red-600">Tour not found. Please return to the dashboard.</p>
            <a href="/dashboard" class="inline-block mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                Back to Dashboard
            </a>
        </div>
    {/if}
</div>
