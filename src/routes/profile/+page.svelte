<script lang="ts">
  import { goto } from '$app/navigation';
  import { currentUser, ConvexService } from '$lib/convexService';
  import { onMount } from 'svelte';
  
  let username = '';
  let userEmail = '';
  let loading = false;
  let success = false;
  let error = '';
  
  onMount(async () => {
    // Check if user is logged in
    const user = await ConvexService.getAccount();
    if (!user) {
      goto('/login');
    } else {
      // Initialize username from user data
      username = user.username || '';
      // Email is stored in the auth system - we don't have direct access to it here
      // For now, show the username or a placeholder
      userEmail = 'Logged in user';
    }
  });
  
  const updateProfile = async () => {
    if (!username.trim()) {
      error = 'Username cannot be empty';
      return;
    }
    
    try {
      loading = true;
      error = '';
      
      await ConvexService.updateUserProfile(username);
      success = true;
      
      // Reset success message after 3 seconds
      setTimeout(() => {
        success = false;
      }, 3000);
    } catch (err: any) {
      console.error('Error updating profile:', err);
      error = err.message || 'Failed to update profile. Please try again.';
    } finally {
      loading = false;
    }
  };
  
  const handleLogout = async () => {
    try {
      await ConvexService.logout();
      goto('/');
    } catch (err) {
      console.error('Error logging out:', err);
      error = 'Failed to log out. Please try again.';
    }
  };
</script>

<svelte:head>
  <title>Edit Profile - Language Learning Tours</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 flex flex-col py-12 sm:px-6 lg:px-8">
  <div class="sm:mx-auto sm:w-full sm:max-w-md">
    <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
      Edit Profile
    </h2>
    <p class="mt-2 text-center text-sm text-gray-600">
      Update your profile information
    </p>
  </div>

  <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
    <div class="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
      {#if success}
        <div class="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
          <p class="font-medium">Profile updated successfully!</p>
        </div>
      {/if}
      
      {#if error}
        <div class="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      {/if}
      
      <!-- Account Information Section -->
      <div class="mb-6 pb-6 border-b border-gray-200">
        <h3 class="text-lg font-medium text-gray-900 mb-4">Account Information</h3>
        
        <div class="space-y-3">
          <div>
            <span class="block text-sm font-medium text-gray-700">Email Address</span>
            <div class="mt-1 flex items-center">
              <span class="text-sm text-gray-900">{userEmail}</span>
              <span class="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                Verified
              </span>
            </div>
            <p class="mt-1 text-xs text-gray-500">Your email address is used for login and notifications.</p>
          </div>
        </div>
      </div>
      
      <form class="space-y-6" on:submit|preventDefault={updateProfile}>
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
          </div>
        </div>

        <div>
          <button
            type="submit"
            disabled={loading}
            class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading ? 'Updating...' : 'Update Profile'}
          </button>
        </div>
      </form>
      
      <div class="mt-6 pt-6 border-t border-gray-200">
        <h3 class="text-lg font-medium text-gray-900">Account Actions</h3>
        <p class="mt-1 text-sm text-gray-600">Manage your account settings</p>
        
        <div class="mt-4">
          <button
            on:click={handleLogout}
            class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-500 hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 cursor-pointer"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  </div>
</div>
