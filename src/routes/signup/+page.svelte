<script lang="ts">
  import { goto } from '$app/navigation';
  import { AppwriteService } from '$lib/appwriteService';
  import { onMount } from 'svelte';
  
  let username = '';
  let email = '';
  let password = '';
  let confirmPassword = '';
  let loading = false;
  let generalError = '';
  
  let usernameError = '';
  let emailError = '';
  let passwordError = '';
  let confirmPasswordError = '';

  onMount(async () => {
    // Check if already logged in
    const user = await AppwriteService.getAccount();
    if (user) {
      goto('/');
    }
  });

  const validateForm = () => {
    let isValid = true;
    
    // Reset errors
    usernameError = '';
    emailError = '';
    passwordError = '';
    confirmPasswordError = '';
    generalError = '';
    
    // Validate username
    if (!username) {
      usernameError = 'Username is required';
      isValid = false;
    }
    
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

  const signup = async () => {
    if (!validateForm()) return;
    
    try {
      loading = true;
      await AppwriteService.createAccount(email, password, username);
      // Login after successful signup
      await AppwriteService.login(email, password);
      goto('/');
    } catch (error: any) {
      console.error('Signup error:', error);
      generalError = error.message || 'Signup failed. Please try again.';
    } finally {
      loading = false;
    }
  };
</script>

<svelte:head>
  <title>Sign Up - Language Learning Tours</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
  <div class="sm:mx-auto sm:w-full sm:max-w-md">
    <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
      Create your account
    </h2>
    <p class="mt-2 text-center text-sm text-gray-600">
      Or
      <a href="/login" class="font-medium text-blue-600 hover:text-blue-500">
        sign in to your existing account
      </a>
    </p>
  </div>

  <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
    <div class="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
      {#if generalError}
        <div class="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {generalError}
        </div>
      {/if}
      
      <form class="space-y-6" on:submit|preventDefault={signup}>
        <div>
          <label for="username" class="block text-sm font-medium text-gray-700">
            Username
          </label>
          <div class="mt-1">
            <input
              id="username"
              name="username"
              type="text"
              autocomplete="username"
              bind:value={username}
              class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
            {#if usernameError}
              <p class="mt-1 text-sm text-red-600">{usernameError}</p>
            {/if}
          </div>
        </div>

        <div>
          <label for="email" class="block text-sm font-medium text-gray-700">
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
          </div>
        </div>

        <div>
          <label for="password" class="block text-sm font-medium text-gray-700">
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
          <label for="confirmPassword" class="block text-sm font-medium text-gray-700">
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
            class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300 disabled:cursor-not-allowed"
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
