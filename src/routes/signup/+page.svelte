<script lang="ts">
  import { goto } from '$app/navigation';
  import { SupabaseService } from '$lib/supabaseService';
  import { onMount } from 'svelte';
  import { components, text, gradients } from '$lib/styles/DesignSystem.svelte';
  
  let email = '';
  let password = '';
  let confirmPassword = '';
  let loading = false;
  let generalError = '';
  
  let emailError = '';
  let passwordError = '';
  let confirmPasswordError = '';
  
  // Auto-generate username from email
  $: username = email ? email.split('@')[0] : '';

  onMount(async () => {
    // Check if already logged in
    const user = await SupabaseService.getAccount();
    if (user) {
      goto('/');
    }
  });

  const validateForm = () => {
    let isValid = true;
    
    // Reset errors
    emailError = '';
    passwordError = '';
    confirmPasswordError = '';
    generalError = '';
    
    // Validate email
    if (!email) {
      emailError = 'Email is required';
      isValid = false;
    } else if (!/^\S+@\S+\.\S+$/.test(email)) {
      emailError = 'Please enter a valid email address';
      isValid = false;
    }
    
    // Validate password
    if (!password) {
      passwordError = 'Password is required';
      isValid = false;
    } else if (password.length < 8) {
      passwordError = 'Password must be at least 8 characters';
      isValid = false;
    }
    
    // Validate confirm password
    if (!confirmPassword) {
      confirmPasswordError = 'Please confirm your password';
      isValid = false;
    } else if (password !== confirmPassword) {
      confirmPasswordError = 'Passwords do not match';
      isValid = false;
    }
    
    return isValid;
  };

  let signupSuccess = false;
  let confirmationMessage = '';

  const signup = async () => {
    if (!validateForm()) return;
    
    try {
      loading = true;
      const result = await SupabaseService.createAccount(email, password, username);
      
      // Check if signup was successful
      if (result) {
        signupSuccess = true;
        confirmationMessage = 'Your account has been created! Please check your email to verify your account before logging in.';
      }
    } catch (error: any) {
      console.error('Signup error:', error);
      
      // If the error is about email confirmation, show a friendly message instead
      if (error.message && error.message.includes('Email not confirmed')) {
        signupSuccess = true;
        confirmationMessage = 'Your account has been created! Please check your email to verify your account before logging in.';
      } else {
        generalError = error.message || 'Signup failed. Please try again.';
      }
    } finally {
      loading = false;
    }
  };
</script>

<svelte:head>
  <title>Sign Up - Language Learning Tours</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 flex flex-col pt-24 sm:px-6 lg:px-8">
  <div class="sm:mx-auto sm:w-full sm:max-w-md">
    <h2 class="mt-4 text-center text-3xl font-extrabold ${text.primary}">
      Create your account
    </h2>
    <p class="mt-2 text-center text-sm ${text.secondary}">
      Or
      <a href="/login" class="font-medium text-indigo-600 hover:text-indigo-500">
        sign in to your existing account
      </a>
    </p>
  </div>

  <div class="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
    <div class="bg-white py-6 px-4 shadow sm:rounded-lg sm:px-8">
      {#if signupSuccess}
        <div class="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md">
          <p class="font-medium">{confirmationMessage}</p>
          <p class="mt-2 text-sm">You can <a href="/login" class="font-medium text-green-700 underline">login here</a> after confirming your email.</p>
        </div>
      {:else if generalError}
        <div class="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {generalError}
        </div>
      {/if}
      
      <form class="space-y-4" on:submit|preventDefault={signup}>
        <div>
          <label for="email" class="block text-sm font-medium ${text.secondary}">
            Email address
          </label>
          <div class="mt-1">
            <input
              id="email"
              name="email"
              type="email"
              autocomplete="email"
              bind:value={email}
              class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
            {#if emailError}
              <p class="mt-1 text-sm text-red-600">{emailError}</p>
            {/if}
            {#if email}
              <p class="mt-1 text-sm ${text.muted}">Your username will be: <strong>{username}</strong> (you can change this later)</p>
            {/if}
          </div>
        </div>



        <div>
          <label for="password" class="block text-sm font-medium ${text.secondary}">
            Password
          </label>
          <div class="mt-1">
            <input
              id="password"
              name="password"
              type="password"
              autocomplete="new-password"
              bind:value={password}
              class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
            {#if passwordError}
              <p class="mt-1 text-sm text-red-600">{passwordError}</p>
            {/if}
          </div>
        </div>

        <div>
          <label for="confirmPassword" class="block text-sm font-medium ${text.secondary}">
            Confirm Password
          </label>
          <div class="mt-1">
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autocomplete="new-password"
              bind:value={confirmPassword}
              class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
            {#if confirmPasswordError}
              <p class="mt-1 text-sm text-red-600">{confirmPasswordError}</p>
            {/if}
          </div>
        </div>

        <div>
          <button
            type="submit"
            disabled={loading}
            class={`${components.button.primary} w-full disabled:opacity-70 disabled:cursor-not-allowed`}
          >
            {#if loading}
              <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Creating account...
            {:else}
              Sign up
            {/if}
          </button>
        </div>
      </form>
    </div>
  </div>
</div>
