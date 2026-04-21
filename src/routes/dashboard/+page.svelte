<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { ConvexService, userCreatedTours } from '$lib/firebaseService';
	import { getTourData, getStops } from '$lib/tourValidation';
	import TourListItem, { type TourListTour } from '$lib/components/TourListItem.svelte';
	import { citiesStore } from '$lib/stores/tourStore';

	let isLoading = $state(true);
	let error = $state('');
	let userId = $state<string | null>(null);
	let upcomingScheduledTours: any[] = $state([]);
	let userBookings: any[] = $state([]);

	// Profile state
	let username = $state('');
	let userEmail = $state('');
	let bio = $state('');
	let avatarUrl = $state('');
	let avatarStorageId = $state('');
	let memberSince: number | null = $state(null);
	let avatarFile: File | null = $state(null);
	let avatarPreview = $state('');
	let uploadingAvatar = $state(false);
	let savingProfile = $state(false);
	let profileSuccess = $state(false);
	let profileError = $state('');
	let editingProfile = $state(false);

	// Action state
	let deletingTourId: string | null = $state(null);
	let deleteMessage = $state('');
	let cancellingScheduleId: string | null = $state(null);
	let cancelMessage = $state('');

	let cities = $citiesStore;

	function toListTour(tour: any): TourListTour {
		const data = getTourData(tour);
		const stops = getStops(tour);
		const city = cities.find(c => c.id === data.cityId);
		return {
			id: tour.id || tour.$id || data.id,
			name: data.name,
			cityName: city ? `${city.name}, ${city.country}` : undefined,
			languageTaught: data.languageTaught || data.language,
			instructionLanguage: data.instructionLanguage,
			langDifficulty: data.langDifficulty,
			tourType: data.tourType,
			stops
		};
	}

	onMount(async () => {
		try {
			const user = await ConvexService.getAccount();
			if (!user) {
				goto('/login');
				return;
			}

			userId = user.id;
			username = user.username || '';
			userEmail = user.email || '';

			const [scheduled, bookings, profile] = await Promise.all([
				ConvexService.getUpcomingScheduledTours(),
				ConvexService.getUserBookings(user.id),
				ConvexService.getPublicProfile(user.id)
			]);

			upcomingScheduledTours = scheduled.documents || scheduled || [];
			userBookings = Array.isArray(bookings) ? bookings : (bookings as any)?.data || [];

			if (profile) {
				bio = profile.bio || '';
				avatarUrl = profile.avatarUrl || '';
				avatarStorageId = profile.avatarStorageId || '';
				memberSince = profile.memberSince || null;
			}
			isLoading = false;
		} catch (err: any) {
			error = err.message || 'Failed to load dashboard';
			isLoading = false;
		}
	});

	function handleAvatarSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files && input.files[0]) {
			avatarFile = input.files[0];
			avatarPreview = URL.createObjectURL(avatarFile);
		}
	}

	async function uploadAvatarFile() {
		if (!avatarFile) return;
		try {
			uploadingAvatar = true;
			profileError = '';
			if (avatarStorageId) {
				try { await ConvexService.deleteFile(avatarStorageId); } catch (e) { console.error(e); }
			}
			const result = await ConvexService.uploadAvatar(avatarFile);
			avatarUrl = result.url;
			avatarStorageId = result.id;
			await ConvexService.updatePublicProfile({ avatarUrl, avatarStorageId });
			avatarFile = null;
			avatarPreview = '';
		} catch (err: any) {
			profileError = err.message || 'Failed to upload avatar.';
		} finally {
			uploadingAvatar = false;
		}
	}

	async function saveProfile(e: SubmitEvent) {
		e.preventDefault();
		if (!username.trim()) {
			profileError = 'Username cannot be empty';
			return;
		}
		try {
			savingProfile = true;
			profileError = '';
			await ConvexService.updateUserProfile(username);
			await ConvexService.updatePublicProfile({ bio: bio.trim() });
			profileSuccess = true;
			setTimeout(() => profileSuccess = false, 3000);
		} catch (err: any) {
			profileError = err.message || 'Failed to update profile.';
		} finally {
			savingProfile = false;
		}
	}

	async function handleLogout() {
		try {
			await ConvexService.logout();
			goto('/');
		} catch (err) {
			console.error('Error logging out:', err);
		}
	}

	function formatMemberSince(ts: number): string {
		return new Date(ts).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
	}

	function formatDate(ts: any): string {
		if (!ts) return 'No date';
		const date = new Date(typeof ts === 'number' ? ts : ts);
		if (isNaN(date.getTime())) return 'Invalid date';
		return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	async function handleDeleteTour(tourId: string, tourName: string) {
		if (!confirm(`Delete route "${tourName}"? This cannot be undone.`)) return;
		deletingTourId = tourId;
		deleteMessage = '';
		try {
			await ConvexService.deleteTour(tourId);
			userCreatedTours.update(tours => tours.filter(t => (t.id || t.$id) !== tourId));
			deleteMessage = `Deleted: ${tourName}`;
		} catch (err: any) {
			deleteMessage = `Error: ${err?.message || 'Unknown error'}`;
		} finally {
			deletingTourId = null;
		}
	}

	async function handleCancelSchedule(scheduleId: string, tourName: string) {
		if (!confirm(`Cancel scheduled route: ${tourName || 'Unknown'}?`)) return;
		cancellingScheduleId = scheduleId;
		cancelMessage = '';
		try {
			const result = await ConvexService.cancelSchedule(scheduleId);
			if (result.error) {
				cancelMessage = `Failed to cancel: ${(result.error as any)?.message || 'Unknown'}`;
			} else {
				cancelMessage = `Cancelled: ${tourName}`;
				upcomingScheduledTours = upcomingScheduledTours.filter(s => s.id !== scheduleId);
			}
		} catch (err: any) {
			cancelMessage = `Error: ${err?.message || 'Unknown'}`;
		} finally {
			cancellingScheduleId = null;
		}
	}
</script>

<div class="container mx-auto px-4 py-8">
	<h1 class="text-3xl font-medium text-slate-700 mb-6">Dashboard</h1>

	{#if error}
		<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
			<p>{error}</p>
		</div>
	{/if}

	{#if isLoading}
		<div class="flex justify-center items-center h-64">
			<div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-slate-300"></div>
		</div>
	{:else}
		<!-- Profile header -->
		<div class="mb-8 bg-white border border-slate-200 rounded-lg overflow-hidden">
			<div class="flex items-start gap-4 p-4">
				<div class="w-16 h-16 rounded-full overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
					{#if avatarPreview}
						<img src={avatarPreview} alt="Avatar preview" class="w-full h-full object-cover" />
					{:else if avatarUrl}
						<img src={avatarUrl} alt="Profile avatar" class="w-full h-full object-cover" />
					{:else}
						<div class="w-full h-full flex items-center justify-center">
							<svg class="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
							</svg>
						</div>
					{/if}
				</div>
				<div class="flex-1 min-w-0">
					<div class="flex items-center gap-2 flex-wrap">
						<h2 class="text-lg font-medium text-slate-800 truncate">{username || 'User'}</h2>
						{#if memberSince}
							<span class="text-xs text-slate-400">· Member since {formatMemberSince(memberSince)}</span>
						{/if}
					</div>
					<p class="text-sm text-slate-500 truncate">{userEmail}</p>
					{#if bio}
						<p class="text-sm text-slate-600 mt-1">{bio}</p>
					{/if}
				</div>
				<div class="flex flex-col items-end gap-2 shrink-0">
					<button
						onclick={() => editingProfile = !editingProfile}
						class="inline-flex items-center justify-center gap-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-medium py-2 px-4 rounded-lg text-sm transition-colors whitespace-nowrap"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" />
						</svg>
						{editingProfile ? 'Close' : 'Edit profile'}
					</button>
					<button
						onclick={handleLogout}
						class="inline-flex items-center justify-center gap-1.5 bg-white hover:bg-red-50 text-red-600 border border-red-200 hover:border-red-300 font-medium py-2 px-4 rounded-lg text-sm transition-colors whitespace-nowrap"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
						</svg>
						Log out
					</button>
				</div>
			</div>

			{#if editingProfile}
				<div class="border-t border-slate-100 p-4 bg-slate-50/40">
					{#if profileSuccess}
						<div class="mb-3 bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-2 rounded text-sm">
							Profile updated.
						</div>
					{/if}
					{#if profileError}
						<div class="mb-3 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
							{profileError}
						</div>
					{/if}

					<div class="mb-4 flex items-center gap-3">
						<label class="py-1.5 px-3 rounded text-xs font-medium text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 cursor-pointer transition-colors">
							Choose photo
							<input type="file" accept="image/*" class="hidden" onchange={handleAvatarSelect} />
						</label>
						{#if avatarFile}
							<button
								onclick={uploadAvatarFile}
								disabled={uploadingAvatar}
								class="py-1.5 px-3 rounded text-xs font-medium text-white bg-slate-700 hover:bg-slate-800 disabled:opacity-50 transition-colors"
							>{uploadingAvatar ? 'Uploading...' : 'Upload'}</button>
						{/if}
					</div>

					<form onsubmit={saveProfile} class="space-y-3">
						<div>
							<label for="username" class="block text-xs font-medium text-slate-600 mb-1">Username</label>
							<input
								id="username"
								type="text"
								autocomplete="username"
								bind:value={username}
								class="block w-full px-3 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
							/>
						</div>
						<div>
							<label for="bio" class="block text-xs font-medium text-slate-600 mb-1">Bio</label>
							<textarea
								id="bio"
								bind:value={bio}
								maxlength="300"
								rows="2"
								placeholder="Tell people about yourself..."
								class="block w-full px-3 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
							></textarea>
							<p class="text-[11px] text-slate-400 mt-0.5">{bio.length}/300</p>
						</div>
						<div>
							<button
								type="submit"
								disabled={savingProfile}
								class="py-1.5 px-4 rounded text-sm font-medium text-white bg-slate-700 hover:bg-slate-800 disabled:opacity-50 transition-colors"
							>{savingProfile ? 'Saving...' : 'Save'}</button>
						</div>
					</form>
				</div>
			{/if}
		</div>

		<!-- Routes You Created -->
		<div class="mb-10">
			<div class="flex justify-between items-center mb-4 flex-wrap gap-3">
				<h2 class="text-xl font-medium text-slate-700">Routes You Created</h2>
				<div class="flex gap-2">
					<a
						href="/create-with-ai"
						class="bg-slate-700 hover:bg-slate-800 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
					>Create New Route</a>
				</div>
			</div>

			{#if deleteMessage}
				<div class="bg-slate-50 border border-slate-200 text-slate-700 px-4 py-3 rounded-lg mb-4 flex justify-between items-center">
					<p class="text-sm">{deleteMessage}</p>
					<button class="text-slate-400 hover:text-slate-600" onclick={() => deleteMessage = ''}>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
					</button>
				</div>
			{/if}

			{#if $userCreatedTours.length === 0}
				<div class="bg-slate-50 p-6 rounded-lg text-center border border-slate-200">
					<p class="text-slate-600">You haven't created any routes yet.</p>
				</div>
			{:else}
				<div class="border border-slate-200 rounded-lg bg-white overflow-hidden">
					{#each $userCreatedTours as tour}
						{@const lt = toListTour(tour)}
						<div class="flex flex-col sm:flex-row sm:items-stretch border-b-2 border-slate-200 last:border-b-0">
							<div class="flex-1 min-w-0">
								<TourListItem tour={lt} ownership="own" />
							</div>
							<div class="flex flex-row items-center justify-end gap-2 px-3 py-2">
								<a
									href="/dashboard/edit/{lt.id}"
									class="inline-flex items-center justify-center gap-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-medium py-2 px-4 rounded-lg text-sm transition-colors whitespace-nowrap"
								>
									<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" />
									</svg>
									Edit
								</a>
								<a
									href="/dashboard/tours/{lt.id}/schedule"
									class="inline-flex items-center justify-center gap-1.5 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 border border-yellow-200 font-semibold py-2 px-4 rounded-lg text-sm transition-colors whitespace-nowrap"
								>
									<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
									</svg>
									Schedule
								</a>
								<button
									class="inline-flex items-center justify-center gap-1.5 bg-white hover:bg-red-50 text-red-600 border border-red-200 hover:border-red-300 font-medium py-2 px-4 rounded-lg text-sm transition-colors whitespace-nowrap disabled:opacity-50"
									onclick={() => handleDeleteTour(lt.id, lt.name)}
									disabled={deletingTourId !== null}
								>
									<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
									</svg>
									{deletingTourId === lt.id ? 'Deleting...' : 'Delete'}
								</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Routes You Joined -->
		<div class="mb-10">
			<h2 class="text-xl font-medium text-slate-700 mb-4">Routes You Joined</h2>

			{#if userBookings.length === 0}
				<div class="bg-slate-50 p-6 rounded-lg text-center border border-slate-200">
					<p class="text-slate-600">
						You haven't joined any routes yet. <a href="/" class="text-slate-700 underline">Browse routes</a>
					</p>
				</div>
			{:else}
				<div class="border border-slate-200 rounded-lg bg-white overflow-hidden">
					{#each userBookings as booking}
						{#if booking.tour}
							{@const lt = toListTour(booking.tour)}
							<div class="border-b-2 border-slate-200 last:border-b-0">
								<TourListItem tour={lt} ownership="open" />
							</div>
						{/if}
					{/each}
				</div>
			{/if}
		</div>

	{/if}
</div>
