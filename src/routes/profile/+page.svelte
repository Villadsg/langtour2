<script lang="ts">
  import { goto } from '$app/navigation';
  import { currentUser, ConvexService } from '$lib/firebaseService';
  import { onMount } from 'svelte';
  import type { PublicProfile } from '$lib/firebase/types';

  let username = '';
  let userEmail = '';
  let bio = '';
  let languagesSpoken = '';
  let avatarUrl = '';
  let avatarStorageId = '';
  let memberSince: number | null = null;
  let avatarFile: File | null = null;
  let avatarPreview = '';
  let uploadingAvatar = false;
  let loading = false;
  let success = false;
  let error = '';

  onMount(async () => {
    const user = await ConvexService.getAccount();
    if (!user) {
      goto('/login');
    } else {
      username = user.username || '';
      userEmail = user.email || 'Logged in user';

      // Fetch full public profile
      const profile = await ConvexService.getPublicProfile(user.id);
      if (profile) {
        bio = profile.bio || '';
        languagesSpoken = (profile.languagesSpoken || []).join(', ');
        avatarUrl = profile.avatarUrl || '';
        avatarStorageId = profile.avatarStorageId || '';
        memberSince = profile.memberSince || null;
      }
    }
  });

  const handleAvatarSelect = (event: Event) => {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      avatarFile = input.files[0];
      avatarPreview = URL.createObjectURL(avatarFile);
    }
  };

  const uploadAvatarFile = async () => {
    if (!avatarFile) return;

    try {
      uploadingAvatar = true;
      error = '';

      // Delete old avatar if exists
      if (avatarStorageId) {
        try {
          await ConvexService.deleteFile(avatarStorageId);
        } catch (e) {
          console.error('Error deleting old avatar:', e);
        }
      }

      const result = await ConvexService.uploadAvatar(avatarFile);
      avatarUrl = result.url;
      avatarStorageId = result.id;

      // Save avatar to profile immediately
      await ConvexService.updatePublicProfile({
        avatarUrl,
        avatarStorageId
      });

      avatarFile = null;
      avatarPreview = '';
    } catch (err: any) {
      console.error('Error uploading avatar:', err);
      error = err.message || 'Failed to upload avatar.';
    } finally {
      uploadingAvatar = false;
    }
  };

  const updateProfile = async () => {
    if (!username.trim()) {
      error = 'Username cannot be empty';
      return;
    }

    try {
      loading = true;
      error = '';

      // Update username via existing method
      await ConvexService.updateUserProfile(username);

      // Update extended profile fields
      const langs = languagesSpoken
        .split(',')
        .map(l => l.trim())
        .filter(l => l.length > 0);

      await ConvexService.updatePublicProfile({
        bio: bio.trim(),
        languagesSpoken: langs
      });

      success = true;
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

  function formatMemberSince(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
</script>

<svelte:head>
  <title>Edit Profile - Language Learning Tours</title>
</svelte:head>

<div class="min-h-screen bg-slate-50 flex flex-col py-12 sm:px-6 lg:px-8">
  <div class="sm:mx-auto sm:w-full sm:max-w-md">
    <h2 class="mt-6 text-center text-3xl font-extrabold text-slate-800">
      Edit Profile
    </h2>
    <p class="mt-2 text-center text-sm text-slate-600">
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

      <!-- Avatar Section -->
      <div class="mb-6 pb-6 border-b border-slate-200 flex flex-col items-center">
        <div class="w-24 h-24 rounded-full overflow-hidden bg-slate-100 border-2 border-slate-200 mb-3">
          {#if avatarPreview}
            <img src={avatarPreview} alt="Avatar preview" class="w-full h-full object-cover" />
          {:else if avatarUrl}
            <img src={avatarUrl} alt="Profile avatar" class="w-full h-full object-cover" />
          {:else}
            <div class="w-full h-full flex items-center justify-center">
              <svg class="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
              </svg>
            </div>
          {/if}
        </div>

        <div class="flex items-center gap-2">
          <label class="py-1.5 px-4 rounded-lg text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 cursor-pointer transition-colors">
            Choose Photo
            <input type="file" accept="image/*" class="hidden" on:change={handleAvatarSelect} />
          </label>
          {#if avatarFile}
            <button
              on:click={uploadAvatarFile}
              disabled={uploadingAvatar}
              class="py-1.5 px-4 rounded-lg text-xs font-medium text-green-700 bg-green-100 hover:bg-green-200 border border-green-200 disabled:opacity-50 transition-colors"
            >
              {uploadingAvatar ? 'Uploading...' : 'Upload'}
            </button>
          {/if}
        </div>
      </div>

      <!-- Account Information Section -->
      <div class="mb-6 pb-6 border-b border-slate-200">
        <h3 class="text-lg font-medium text-slate-800 mb-4">Account Information</h3>

        <div class="space-y-3">
          <div>
            <span class="block text-sm font-medium text-slate-700">Email Address</span>
            <div class="mt-1 flex items-center">
              <span class="text-sm text-slate-800">{userEmail}</span>
              <span class="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                Verified
              </span>
            </div>
            <p class="mt-1 text-xs text-slate-500">Your email address is used for login and notifications.</p>
          </div>

          {#if memberSince}
            <div>
              <span class="block text-sm font-medium text-slate-700">Member Since</span>
              <p class="mt-1 text-sm text-slate-800">{formatMemberSince(memberSince)}</p>
            </div>
          {/if}
        </div>
      </div>

      <form class="space-y-6" on:submit|preventDefault={updateProfile}>
        <div>
          <label for="username" class="block text-sm font-medium text-slate-700">
            Username
          </label>
          <div class="mt-1">
            <input
              id="username"
              name="username"
              type="text"
              autocomplete="username"
              bind:value={username}
              class="appearance-none block w-full px-3 py-2 border border-slate-200 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-green-400 focus:border-green-400 sm:text-sm"
            />
          </div>
        </div>

        <div>
          <label for="bio" class="block text-sm font-medium text-slate-700">
            Bio
          </label>
          <div class="mt-1">
            <textarea
              id="bio"
              bind:value={bio}
              maxlength="300"
              rows="3"
              placeholder="Tell tour-goers about yourself..."
              class="appearance-none block w-full px-3 py-2 border border-slate-200 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-green-400 focus:border-green-400 sm:text-sm"
            ></textarea>
            <p class="mt-1 text-xs text-slate-400">{bio.length}/300</p>
          </div>
        </div>

        <div>
          <label for="languages" class="block text-sm font-medium text-slate-700">
            Languages Spoken
          </label>
          <div class="mt-1">
            <input
              id="languages"
              type="text"
              bind:value={languagesSpoken}
              placeholder="e.g. English, Spanish, French"
              class="appearance-none block w-full px-3 py-2 border border-slate-200 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-green-400 focus:border-green-400 sm:text-sm"
            />
            <p class="mt-1 text-xs text-slate-400">Separate languages with commas</p>
          </div>
        </div>

        <div class="flex justify-center">
          <button
            type="submit"
            disabled={loading}
            class="py-2.5 px-8 rounded-lg text-sm font-medium text-green-700 bg-green-100 hover:bg-green-200 border border-green-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-400 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Updating...' : 'Update Profile'}
          </button>
        </div>
      </form>

      <div class="mt-6 pt-6 border-t border-slate-200">
        <h3 class="text-lg font-medium text-slate-800">Account Actions</h3>
        <p class="mt-1 text-sm text-slate-600">Manage your account settings</p>

        <div class="mt-4 flex justify-center">
          <button
            on:click={handleLogout}
            class="py-2.5 px-8 border border-transparent rounded-lg text-sm font-medium text-white bg-red-500 hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 cursor-pointer transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  </div>
</div>
