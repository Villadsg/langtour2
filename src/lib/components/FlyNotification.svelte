<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { fly } from 'svelte/transition';
    
    export let message: string = '';
    export let type: 'success' | 'error' | 'info' = 'success';
    export let duration: number = 5000; // Duration in milliseconds
    export let onClose: () => void = () => {};
    
    let visible = true;
    let timer: ReturnType<typeof setTimeout>;
    
    onMount(() => {
        // Auto-close after duration
        timer = setTimeout(() => {
            visible = false;
            onClose();
        }, duration);
    });
    
    onDestroy(() => {
        if (timer) clearTimeout(timer);
    });
    
    // Determine background color based on type
    $: bgColor = type === 'success' 
        ? 'bg-slate-100 border-slate-300 text-slate-700' 
        : type === 'error' 
            ? 'bg-red-100 border-red-400 text-red-700' 
            : 'bg-blue-100 border-blue-400 text-blue-700';
</script>

{#if visible}
    <div 
        class="fixed top-5 right-5 z-50 max-w-md"
        transition:fly={{ y: -200, duration: 500 }}
    >
        <div class={`${bgColor} px-4 py-3 rounded-lg shadow-lg border flex items-start`}>
            <div class="flex-grow">
                <p class="font-medium">{message}</p>
                {#if type === 'success'}
                    <p class="text-sm mt-1">Redirecting to homepage in {Math.ceil(duration/1000)} seconds...</p>
                {/if}
            </div>
            <button 
                class="ml-4 text-gray-500 hover:text-gray-700" 
                on:click={() => {
                    visible = false;
                    onClose();
                }}
            >
                ×
            </button>
        </div>
    </div>
{/if}
