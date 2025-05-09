<script>
    import { onMount } from 'svelte';
    
    let envVars = {
        mistralKey: '(not loaded)',
        mistralKeyExists: false,
        allEnvKeys: []
    };
    
    onMount(() => {
        // Check if the environment variable exists
        try {
            envVars.mistralKey = import.meta.env.PUBLIC_MISTRAL_API_KEY || '(not found)';
            envVars.mistralKeyExists = !!import.meta.env.PUBLIC_MISTRAL_API_KEY;
            
            // Get all keys from import.meta.env for debugging
            envVars.allEnvKeys = Object.keys(import.meta.env)
                .filter(key => key.startsWith('PUBLIC_'));
            
            console.log('Environment test results:', envVars);
        } catch (error) {
            console.error('Error accessing environment variables:', error);
        }
    });
</script>

<div class="container mx-auto p-6">
    <h1 class="text-2xl font-bold mb-4">Environment Variable Test</h1>
    
    <div class="bg-gray-100 p-4 rounded mb-4">
        <h2 class="font-bold">Mistral API Key Status:</h2>
        <p>Value (first 4 chars if present): 
            {envVars.mistralKey ? 
                (envVars.mistralKey === '(not found)' ? 
                    '(not found)' : 
                    envVars.mistralKey.substring(0, 4) + '***') : 
                'Loading...'}
        </p>
        <p>Exists: {envVars.mistralKeyExists ? 'Yes' : 'No'}</p>
    </div>
    
    <div class="bg-gray-100 p-4 rounded">
        <h2 class="font-bold">All PUBLIC Environment Variables:</h2>
        {#if envVars.allEnvKeys.length > 0}
            <ul class="list-disc pl-6">
                {#each envVars.allEnvKeys as key}
                    <li>{key}</li>
                {/each}
            </ul>
        {:else}
            <p>No PUBLIC environment variables found</p>
        {/if}
    </div>
</div>
