<script lang="ts">
    import { addNotification, getTourById } from '$lib/stores/tourStore';
    
    let { tourId } = $props<{ tourId: string }>();
    
    let email = $state('');
    let submitted = $state(false);
    let error = $state('');
    
    const tour = getTourById(tourId);
    
    function handleSubmit() {
        if (!email) {
            error = 'Please enter your email address';
            return;
        }
        
        if (!email.includes('@') || !email.includes('.')) {
            error = 'Please enter a valid email address';
            return;
        }
        
        // Add notification to store
        addNotification(email, tourId);
        
        // Reset form and show success message
        submitted = true;
        error = '';
    }
</script>

<div class="bg-blue-50 p-6 rounded-lg shadow-md mt-8">
    {#if submitted}
        <div class="text-center py-8">
            <h3 class="text-xl font-semibold text-green-700 mb-2">Thank you!</h3>
            <p class="text-gray-700">
                We'll notify you at <span class="font-medium">{email}</span> when this tour is scheduled.
            </p>
        </div>
    {:else}
        <h3 class="text-xl font-semibold mb-4">Get notified about this tour</h3>
        <p class="mb-4 text-gray-700">
            Enter your email address to be notified when "{tour?.name}" is scheduled.
        </p>
        
        <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4">
            <div>
                <label for="email" class="block text-sm font-medium text-gray-700 mb-1">Email address</label>
                <input
                    type="email"
                    id="email"
                    bind:value={email}
                    placeholder="your@email.com"
                    class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    required
                />
                {#if error}
                    <p class="mt-1 text-sm text-red-600">{error}</p>
                {/if}
            </div>
            
            <button
                type="submit"
                class="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
                Notify me
            </button>
        </form>
    {/if}
</div>
