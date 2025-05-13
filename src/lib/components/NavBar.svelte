<script lang="ts">
  import { currentUser, SupabaseService } from '$lib/supabaseService';
  import { navbar, text, components } from '$lib/styles/DesignSystem.svelte';
  import { onMount } from 'svelte';
  
  let isMenuOpen = false;
  
  onMount(async () => {
    // Check if user is logged in on component mount
    await SupabaseService.getAccount();
  });
  
  const toggleMenu = () => {
    isMenuOpen = !isMenuOpen;
  };
</script>

<nav class={navbar.bg}>
  <div class="container mx-auto px-4">
    <div class="flex justify-between h-16">
      <div class="flex">
        <div class="flex-shrink-0 flex items-center">
          <a href="/" class={`text-xl font-semibold tracking-tight ${text.primary}`}>LangTour</a>
        </div>
        <div class="hidden sm:ml-8 sm:flex sm:space-x-8">
          <a href="/" class={`${navbar.link} ${navbar.activeLink} inline-flex items-center px-1 pt-1 text-sm font-medium`}>
            Tours
          </a>
        </div>
      </div>
      
      <div class="hidden sm:ml-6 sm:flex sm:items-center">
        {#if $currentUser}
          <div class="flex items-center space-x-4">
            <span class={`text-sm ${text.muted}`}>Hello, {$currentUser?.user_metadata?.name || $currentUser?.email}</span>
            <a href="/dashboard" class={components.button.primary}>
              Dashboard
            </a>
            <a href="/bookings" class={components.button.primary}>
              Bookings
            </a>
            <a href="/profile" class={components.button.secondary}>
              Profile
            </a>
          </div>
        {:else}
          <div class="flex items-center space-x-4">
            <a href="/login" class={components.button.secondary}>
              Login
            </a>
            <a href="/signup" class={components.button.secondary}>
              Sign Up
            </a>
          </div>
        {/if}
      </div>
      
      <!-- Mobile menu button -->
      <div class="flex items-center sm:hidden">
        <button 
          on:click={toggleMenu}
          type="button" 
          class="inline-flex items-center justify-center p-2 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500" 
          aria-expanded="false"
        >
          <span class="sr-only">Open main menu</span>
          <svg class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>
    </div>
  </div>

  <!-- Mobile menu, show/hide based on menu state -->
  {#if isMenuOpen}
    <div class={`sm:hidden ${navbar.mobileBg}`}>
      <div class="pt-2 pb-3 space-y-1">
        <a href="/" class={`${navbar.link} ${navbar.activeLink} block pl-3 pr-4 py-2 text-base font-medium`}>
          Tours
        </a>
      </div>
      <div class="pt-4 pb-3 border-t border-slate-700">
        {#if $currentUser}
          <div class="flex items-center px-4">
            <div class="ml-3">
              <div class={`text-base font-medium ${text.primary}`}>{$currentUser?.user_metadata?.name || $currentUser?.email}</div>
              <div class={`text-sm font-medium ${text.muted}`}>{$currentUser?.email}</div>
            </div>
          </div>
          <div class="mt-3 space-y-1">
            <a href="/dashboard" class={`${navbar.link} block px-4 py-2 text-base font-medium`}>
              Dashboard
            </a>
            <a href="/bookings" class={`${navbar.link} block px-4 py-2 text-base font-medium`}>
              Your Bookings
            </a>
            <a href="/profile" class={`${navbar.link} block px-4 py-2 text-base font-medium`}>
              Edit Profile
            </a>
          </div>
        {:else}
          <div class="mt-3 space-y-1">
            <a href="/login" class={`${navbar.link} block px-4 py-2 text-base font-medium`}>
              Login
            </a>
            <a href="/signup" class={`${navbar.link} block px-4 py-2 text-base font-medium`}>
              Sign Up
            </a>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</nav>
