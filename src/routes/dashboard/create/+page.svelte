<script lang="ts">
    import { goto } from '$app/navigation';
    import { onMount } from 'svelte';
    import { ConvexService } from '$lib/firebaseService';
    import AITourForm from '$lib/components/AITourForm.svelte';
    import type { Tour } from '$lib/stores/tourStore';

    
    let isSubmitting = false;
    let error = '';
    let isLoading = true;
    
    // Initialize authentication state on mount
    onMount(async () => {
        try {
            // Just check if we can access Supabase, but don't redirect yet
            await ConvexService.getAccount();
            isLoading = false;
        } catch (err) {
            // Don't redirect or show error on initial load
            // Just mark that loading is complete
            isLoading = false;
        }
    });
    
    const handleSubmit = async (event: { detail: Partial<Tour> }) => {
        const tourData = event.detail;
        isSubmitting = true;
        error = '';
        
        try {
            // Get current user if available
            let userId: string | undefined = undefined;
            try {
                const user = await ConvexService.getAccount();
                if (user) {
                    userId = user.id;
                } else {
                    // Redirect to login if not logged in
                    goto('/login');
                    return;
                }
            } catch (err: any) {
                // Redirect to login if error
                goto('/login');
                return;
            }
            
            // Create tour in Supabase
            await ConvexService.createTour(tourData, userId);
            
            // Redirect to dashboard
            goto('/dashboard');
        } catch (err: any) {
            error = err.message || 'Failed to create tour';
            isSubmitting = false;
        }
    };
    
    const handleCancel = () => {
        goto('/dashboard');
    };
</script>
    
<div class="container mx-auto px-4 py-8">
    <div class="max-w-5xl mx-auto">
        <div class="mb-8">
            <a href="/dashboard" class="text-green-600 hover:text-green-700 inline-flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clip-rule="evenodd" />
                </svg>
                Back to Dashboard
            </a>
        </div>

        <h1 class="text-3xl font-bold mb-6">Create New Tour</h1>
        
        {#if error}
            <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert">
                <p>{error}</p>
            </div>
        {/if}
        
        {#if isLoading}
            <div class="flex justify-center items-center h-64">
                <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-400"></div>
            </div>
        {:else if isSubmitting}
            <div class="flex justify-center items-center h-64">
                <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-400"></div>
            </div>
        {:else}
            <AITourForm on:submit={handleSubmit} on:cancel={handleCancel} />
        {/if}
    </div>
</div>
