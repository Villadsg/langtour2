<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { SupabaseService, currentUser, isAdmin } from '$lib/supabaseService';
  import NavBar from '$lib/components/NavBar.svelte';
  
  let isLoading = true;
  
  onMount(async () => {
    try {
      // Check if user is logged in
      const user = await SupabaseService.getAccount();
      
      if (!user) {
        // Redirect to login page if not logged in
        goto('/login');
        return;
      }
      
      // Check if user has admin label
      if (!$isAdmin) {
        // Redirect to home page if not admin
        goto('/');
        return;
      }
      
      isLoading = false;
    } catch (err) {
      console.error('Error checking authentication:', err);
      // Redirect to login on error
      goto('/login');
    }
  });
</script>

{#if isLoading}
  <div class="flex justify-center items-center h-screen">
    <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
  </div>
{:else}
  <NavBar />
  <slot />
{/if}
