<script lang="ts">
  import { goto } from '$app/navigation';
  import { ConvexService } from '$lib/firebaseService';
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
    const user = await ConvexService.getAccount();
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
  let googleLoading = false;

  const signupWithGoogle = async () => {
    try {
      googleLoading = true;
      generalError = '';
      await ConvexService.loginWithGoogle();
      goto('/');
    } catch (error: any) {
      console.error('Google signup error:', error);
      generalError = error.message || 'Google sign-up failed. Please try again.';
    } finally {
      googleLoading = false;
    }
  };

  const signup = async () => {
    if (!validateForm()) return;

    try {
      loading = true;
      await ConvexService.createAccount(email, password, username);

      // Account created successfully - redirect to login
      signupSuccess = true;
      confirmationMessage = 'Your account has been created! You can now log in.';

      // Redirect to login after a short delay
      setTimeout(() => {
        goto('/login');
      }, 2000);
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

<div class="min-h-screen bg-slate-50 flex flex-col pt-24 sm:px-6 lg:px-8">
  <div class="sm:mx-auto sm:w-full sm:max-w-md">
    <h2 class={`mt-4 text-center text-3xl font-medium ${text.primary}`}>
      Create your account
    </h2>
    <p class={`mt-2 text-center text-sm ${text.secondary}`}>
      Or
      <a href="/login" class="font-medium text-slate-600 hover:text-slate-500">
        sign in to your existing account
      </a>
    </p>
  </div>

  <div class="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
    <div class="bg-white py-6 px-4 shadow sm:rounded-lg sm:px-8">
      {#if signupSuccess}
        <div class="mb-4 bg-slate-50 border border-slate-200 text-slate-600 px-4 py-3 rounded-md">
          <p class="font-normal">{confirmationMessage}</p>
          <p class="mt-2 text-sm">You can <a href="/login" class="font-normal text-slate-600 underline">login here</a> after confirming your email.</p>
        </div>
      {:else if generalError}
        <div class="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {generalError}
        </div>
      {/if}
      
      <form class="space-y-4" on:submit|preventDefault={signup}>
        <div>
          <label for="email" class={`block text-sm font-medium ${text.secondary}`}>
            Email address
          </label>
          <div class="mt-1">
            <input
              id="email"
              name="email"
              type="email"
              autocomplete="email"
              bind:value={email}
              class="appearance-none block w-full px-3 py-2.5 border border-slate-200 rounded-lg placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-300 sm:text-sm transition-colors"
            />
            {#if emailError}
              <p class="mt-1 text-sm text-red-600">{emailError}</p>
            {/if}
            {#if email}
              <p class={`mt-1 text-sm ${text.muted}`}>Your username will be: <strong>{username}</strong> (you can change this later)</p>
            {/if}
          </div>
        </div>



        <div>
          <label for="password" class={`block text-sm font-medium ${text.secondary}`}>
            Password
          </label>
          <div class="mt-1">
            <input
              id="password"
              name="password"
              type="password"
              autocomplete="new-password"
              bind:value={password}
              class="appearance-none block w-full px-3 py-2.5 border border-slate-200 rounded-lg placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-300 sm:text-sm transition-colors"
            />
            {#if passwordError}
              <p class="mt-1 text-sm text-red-600">{passwordError}</p>
            {/if}
          </div>
        </div>

        <div>
          <label for="confirmPassword" class={`block text-sm font-medium ${text.secondary}`}>
            Confirm Password
          </label>
          <div class="mt-1">
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autocomplete="new-password"
              bind:value={confirmPassword}
              class="appearance-none block w-full px-3 py-2.5 border border-slate-200 rounded-lg placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-300 sm:text-sm transition-colors"
            />
            {#if confirmPasswordError}
              <p class="mt-1 text-sm text-red-600">{confirmPasswordError}</p>
            {/if}
          </div>
        </div>

        <div class="flex justify-center">
          <button
            type="submit"
            disabled={loading}
            class={`${components.button.primary} px-8 inline-flex items-center`}
          >
            {#if loading}
              <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-slate-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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

      <!-- Divider -->
      <div class="mt-6">
        <div class="relative">
          <div class="absolute inset-0 flex items-center">
            <div class="w-full border-t border-slate-200"></div>
          </div>
          <div class="relative flex justify-center text-sm">
            <span class="px-2 bg-white text-slate-500">Or continue with</span>
          </div>
        </div>
      </div>

      <!-- Google Sign-Up Button -->
      <div class="mt-6">
        <button
          type="button"
          on:click={signupWithGoogle}
          disabled={googleLoading}
          class="w-full inline-flex justify-center items-center py-2.5 px-4 border border-slate-200 rounded-lg shadow-sm bg-white text-sm font-normal text-slate-600 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {#if googleLoading}
            <svg class="animate-spin -ml-1 mr-2 h-5 w-5 text-slate-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Signing up...
          {:else}
            <svg class="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          {/if}
        </button>
      </div>
    </div>
  </div>
</div>
