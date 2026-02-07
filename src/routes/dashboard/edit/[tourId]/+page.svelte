<script lang="ts">
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';
    import { ConvexService, currentUser } from '$lib/firebaseService';
    import EditTourForm from '$lib/components/editTourForm.svelte';
    import type { TourStop } from '$lib/firebase/types';

    const tourId = $page.params.tourId;

    let isLoading = true;
    let isSubmitting = false;
    let error = '';

    // All fields the form needs
    let tourData: {
        id: string;
        name: string;
        cityId: string;
        languageTaught: string;
        instructionLanguage: string;
        langDifficulty: string;
        description: string;
        imageUrl: string;
        tourType: string;
        price: number;
        stops: TourStop[];
    } | null = null;

    onMount(async () => {
        try {
            const user = await ConvexService.getAccount();
            if (!user) {
                goto('/login');
                return;
            }

            const { data: doc, error: tourError } = await ConvexService.getTour(tourId);

            if (tourError || !doc) {
                error = typeof tourError === 'object' && tourError !== null && 'message' in tourError
                    ? String(tourError.message)
                    : 'Failed to load tour';
                isLoading = false;
                return;
            }

            const creatorId = await ConvexService.getTourCreatorId(tourId);
            if (creatorId !== user.id) {
                error = "You don't have permission to edit this tour";
                isLoading = false;
                return;
            }

            // Parse the full description object
            let parsed: Record<string, any> = {};
            try {
                if (doc.description) {
                    parsed = typeof doc.description === 'string'
                        ? JSON.parse(doc.description)
                        : doc.description;
                }
            } catch (parseError) {
                console.error('Error parsing tour data:', parseError);
            }

            tourData = {
                id: tourId,
                name: parsed.name || '',
                cityId: parsed.cityId || '',
                languageTaught: parsed.languageTaught || '',
                instructionLanguage: parsed.instructionLanguage || '',
                langDifficulty: parsed.langDifficulty || '',
                description: parsed.description || '',
                imageUrl: doc.image_url || parsed.imageUrl || '',
                tourType: parsed.tourType || 'person',
                price: typeof parsed.price === 'number' ? parsed.price : 0,
                stops: Array.isArray(parsed.stops) ? parsed.stops : []
            };

            isLoading = false;
        } catch (err: any) {
            error = err.message || 'Failed to load tour';
            isLoading = false;
        }
    });

    const handleSubmit = async (event: { detail: any }) => {
        const formData = event.detail;
        isSubmitting = true;
        error = '';

        try {
            // Wrap in { description: { ... } } so updateTour takes the object path
            // which properly processes stops via processStops()
            await ConvexService.updateTour(tourId, {
                description: {
                    name: formData.name,
                    cityId: formData.cityId,
                    languageTaught: formData.languageTaught,
                    instructionLanguage: formData.instructionLanguage,
                    langDifficulty: formData.langDifficulty,
                    description: formData.description,
                    tourType: formData.tourType,
                    price: formData.price,
                    stops: formData.stops || []
                },
                imageUrl: formData.imageUrl
            });

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
        <a href="/dashboard" class="text-green-600 hover:text-green-700 inline-flex items-center">
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
            <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-400"></div>
        </div>
    {:else if tourData}
        <EditTourForm
            tour={tourData}
            on:submit={handleSubmit}
            on:cancel={handleCancel}
        />
    {:else}
        <div class="bg-red-100 p-8 rounded-lg text-center">
            <p class="text-red-600">Tour not found. Please return to the dashboard.</p>
            <a href="/dashboard" class="inline-block mt-4 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg">
                Back to Dashboard
            </a>
        </div>
    {/if}
</div>
