<script lang="ts">
  import { currentUser, SupabaseService } from '$lib/supabaseService';
  import { onMount } from 'svelte';
  
  let isMenuOpen = false;
  
  onMount(async () => {
    // Check if user is logged in on component mount
    await SupabaseService.getAccount();
  });
  
  const handleLogout = async function logout() {
    try {
      await SupabaseService.logout();
      window.location.href = '/';
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };
  
  const toggleMenu = () => {
    isMenuOpen = !isMenuOpen;
  };
</script>

<nav class="bg-white shadow">
  <div class="container mx-auto px-4">
    <div class="flex justify-between h-16">
      <div class="flex">
        <div class="flex-shrink-0 flex items-center">
          <a href="/" class="text-xl font-bold text-blue-600">LangTour</a>
        </div>
        <div class="hidden sm:ml-6 sm:flex sm:space-x-8">
          <a href="/" class="border-blue-500 text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
            Tours
          </a>
        </div>
      </div>
      
      <div class="hidden sm:ml-6 sm:flex sm:items-center">
        {#if $currentUser}
          <div class="flex items-center space-x-4">
            <span class="text-sm text-gray-700">Hello, {$currentUser?.user_metadata?.name || $currentUser?.email}</span>
            <a href="/dashboard" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md text-sm font-medium">
              Dashboard
            </a>
            <a href="/bookings" class="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-md text-sm font-medium">
              Bookings
            </a>
            <button 
              on:click={handleLogout}
              class="text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium"
            >
              Logout
            </button>
          </div>
        {:else}
          <div class="flex items-center space-x-4">
            <a href="/login" class="text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium">
              Login
            </a>
            <a href="/signup" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md text-sm font-medium">
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
          class="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500" 
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
    <div class="sm:hidden">
      <div class="pt-2 pb-3 space-y-1">
        <a href="/" class="bg-blue-50 border-blue-500 text-blue-700 block pl-3 pr-4 py-2 border-l-4 text-base font-medium">
          Tours
        </a>
      </div>
      <div class="pt-4 pb-3 border-t border-gray-200">
        {#if $currentUser}
          <div class="flex items-center px-4">
            <div class="ml-3">
              <div class="text-base font-medium text-gray-800">{$currentUser?.user_metadata?.name || $currentUser?.email}</div>
              <div class="text-sm font-medium text-gray-500">{$currentUser?.email}</div>
            </div>
          </div>
          <div class="mt-3 space-y-1">
            <a href="/dashboard" class="block px-4 py-2 text-base font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100">
              Dashboard
            </a>
            <a href="/bookings" class="block px-4 py-2 text-base font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100">
              Your Bookings
            </a>
            <a href="/dashboard/create" class="block px-4 py-2 text-base font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100">
              Add Tour
            </a>
            <button 
              on:click={handleLogout}
              class="block w-full text-left px-4 py-2 text-base font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100"
            >
              Logout
            </button>
          </div>
        {:else}
          <div class="mt-3 space-y-1">
            <a href="/login" class="block px-4 py-2 text-base font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100">
              Login
            </a>
            <a href="/signup" class="block px-4 py-2 text-base font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100">
              Sign Up
            </a>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</nav>
