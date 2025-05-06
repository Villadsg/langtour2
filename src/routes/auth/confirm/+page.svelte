<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { supabase } from '$lib/supabase';
  import { SupabaseService } from '$lib/supabaseService';

  let message = 'Verifying your email...';
  let status = 'loading'; // loading, success, error

  onMount(async () => {
    // Get token and type from URL
    const token = $page.url.searchParams.get('token');
    const type = $page.url.searchParams.get('type');
    
    if (!token || type !== 'email') {
      message = 'Invalid confirmation link. Please check your email and try again.';
      status = 'error';
      return;
    }

    try {
      // Verify the email
      const { error } = await supabase.auth.verifyOtp({
        token: token,
        type: 'email'
      });

      if (error) {
        console.error('Error confirming email:', error);
        message = error.message || 'Failed to verify your email. Please try again.';
        status = 'error';
        return;
      }

      // Success
      message = 'Your email has been verified successfully!';
      status = 'success';
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        goto('/login');
      }, 3000);
    } catch (err) {
      console.error('Unexpected error during confirmation:', err);
      message = 'An unexpected error occurred. Please try again.';
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
          <p class="mt-2 text-sm text-gray-500">Redirecting you to login page...</p>
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
