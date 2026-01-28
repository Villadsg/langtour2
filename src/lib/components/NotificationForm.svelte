<script lang="ts">
    import { addNotification, getTourById } from '$lib/stores/tourStore';
    import { ConvexService } from '$lib/firebaseService';
    
    let { tourId, tourName = '' } = $props<{ tourId: string, tourName?: string }>();
    
    let email = $state('');
    let submitted = $state(false);
    let error = $state('');
    let isSubmitting = $state(false);
    
    // Get tour from local store if not provided via props
    const localTour = getTourById(tourId);
    const displayName = tourName || localTour?.name || 'this tour';
    
    async function handleSubmit() {
        if (!email) {
            error = 'Please enter your email address';
            return;
        }
        
        if (!email.includes('@') || !email.includes('.')) {
            error = 'Please enter a valid email address';
            return;
        }
        
        isSubmitting = true;
        error = '';
        
        try {
            // Save to Supabase
            await ConvexService.saveNotification(tourId, email);
            
            // Also add to local store as backup
            addNotification(email, tourId);
            
            // Reset form and show success message
            submitted = true;
        } catch (err: any) {
            console.error('Error saving notification:', err);
            error = err.message || 'Failed to save notification. Please try again.';
            
            // Still add to local store if Appwrite fails
            addNotification(email, tourId);
        } finally {
            isSubmitting = false;
        }
    }
</script>

<div class="bg-orange-50 p-6 rounded-lg border border-orange-200 mt-8">
    {#if submitted}
        <div class="text-center py-8">
            <h3 class="text-xl font-semibold text-green-700 mb-2">Thank you!</h3>
            <p class="text-slate-600">
                We'll notify you at <span class="font-medium text-slate-700">{email}</span> when this tour is scheduled.
            </p>
        </div>
    {:else}
        <h3 class="text-xl font-semibold text-slate-800 mb-4">Get notified about this tour</h3>
        <p class="mb-4 text-slate-600">
            Enter your email address to be notified when "{displayName}" is scheduled.
        </p>

        <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4">
            <div>
                <label for="email" class="block text-sm font-medium text-slate-700 mb-1">Email address</label>
                <input
                    type="email"
                    id="email"
                    bind:value={email}
                    placeholder="your@email.com"
                    class="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-green-400 focus:border-green-400 transition-colors"
                    required
                />
                {#if error}
                    <p class="mt-1 text-sm text-red-600">{error}</p>
                {/if}
            </div>

            <div class="flex justify-end">
                <button
                    type="submit"
                    disabled={isSubmitting}
                    class="bg-orange-100 text-orange-700 py-2.5 px-6 rounded-lg hover:bg-orange-200 border border-orange-200 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium inline-flex items-center"
                >
                    {#if isSubmitting}
                        <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-orange-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Saving...
                    {:else}
                        Notify me
                    {/if}
                </button>
            </div>
        </form>
    {/if}
</div>
