<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { ConvexService } from '$lib/convexService';

  let message = 'Verifying your email...';
  let status = 'loading'; // loading, success, error

  onMount(async () => {
    // Convex Auth handles email verification differently than Supabase
    // The verification happens automatically when the user clicks the link
    // This page now just confirms the user is authenticated

    try {
      // Check if user is now authenticated
      const user = await ConvexService.getAccount();

      if (user) {
        // User is authenticated - verification was successful
        message = 'Your email has been verified successfully!';
        status = 'success';

        // Redirect to home after 3 seconds
        setTimeout(() => {
          goto('/');
        }, 3000);
      } else {
        // User is not authenticated - may need to log in
        message = 'Please log in to continue.';
        status = 'success';

        // Redirect to login after 3 seconds
        setTimeout(() => {
          goto('/login');
        }, 3000);
      }
    } catch (err) {
      console.error('Unexpected error during confirmation:', err);
      message = 'An unexpected error occurred. Please try logging in.';
      status = 'error';
    }
  });
</script>

<svelte:head>
  <title>Email Confirmation - Language Learning Tours</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
  <div class="sm:mx-auto sm:w-full sm:max-w-md">
    <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
      Email Confirmation
    </h2>
  </div>

  <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
    <div class="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 text-center">
      {#if status === 'loading'}
        <div class="animate-pulse flex flex-col items-center">
          <div class="rounded-full bg-blue-400 h-12 w-12 mb-4"></div>
          <p class="text-gray-700">{message}</p>
        </div>
      {:else if status === 'success'}
        <div class="text-center">
          <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
            <svg class="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
          <p class="text-green-700 font-medium">{message}</p>
          <p class="mt-2 text-sm text-gray-500">Redirecting you...</p>
        </div>
      {:else}
        <div class="text-center">
          <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
            <svg class="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </div>
          <p class="text-red-700 font-medium">{message}</p>
          <p class="mt-4">
            <a href="/login" class="font-medium text-blue-600 hover:text-blue-500">
              Return to login
            </a>
          </p>
        </div>
      {/if}
    </div>
  </div>
</div>
