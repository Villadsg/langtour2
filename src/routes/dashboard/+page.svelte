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
						class="text-xs font-medium text-slate-600 hover:text-slate-800"
					>{editingProfile ? 'Close' : 'Edit profile'}</button>
					<button
						onclick={handleLogout}
						class="text-xs font-medium text-red-500 hover:text-red-700"
					>Log out</button>
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
						href="/dashboard/create"
						class="bg-slate-700 hover:bg-slate-800 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
					>Create New Route</a>
					<a
						href="/create-with-ai"
						class="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2 px-4 rounded-lg transition-colors text-sm"
					>Create with AI</a>
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
						<div class="flex items-stretch border-b border-slate-100 last:border-b-0">
							<div class="flex-1 min-w-0">
								<TourListItem tour={lt} ownership="own" />
							</div>
							<div class="flex flex-col justify-center gap-1 px-3 py-2 border-l border-slate-100 bg-slate-50/40">
								<a
									href="/dashboard/edit/{lt.id}"
									class="text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors whitespace-nowrap"
								>Edit</a>
								<a
									href="/dashboard/tours/{lt.id}/schedule"
									class="text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors whitespace-nowrap"
								>Schedule</a>
								<button
									class="text-xs font-medium text-red-400 hover:text-red-600 transition-colors whitespace-nowrap disabled:opacity-50 text-left"
									onclick={() => handleDeleteTour(lt.id, lt.name)}
									disabled={deletingTourId !== null}
								>{deletingTourId === lt.id ? 'Deleting...' : 'Delete'}</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Routes You Booked -->
		<div class="mb-10">
			<h2 class="text-xl font-medium text-slate-700 mb-4">Routes You Booked</h2>

			{#if userBookings.length === 0}
				<div class="bg-slate-50 p-6 rounded-lg text-center border border-slate-200">
					<p class="text-slate-600">
						You haven't booked any routes yet. <a href="/" class="text-slate-700 underline">Browse routes</a>
					</p>
				</div>
			{:else}
				<div class="border border-slate-200 rounded-lg bg-white overflow-hidden">
					{#each userBookings as booking}
						{#if booking.tour}
							{@const lt = toListTour(booking.tour)}
							<TourListItem tour={lt} ownership="open" />
						{/if}
					{/each}
				</div>
			{/if}
		</div>

		<!-- Your Scheduled Routes -->
		<div>
			<h2 class="text-xl font-medium text-slate-700 mb-4">Scheduled Routes</h2>

			{#if cancelMessage}
				<div class="bg-slate-50 border border-slate-200 text-slate-700 px-4 py-3 rounded-lg mb-4 flex justify-between items-center">
					<p class="text-sm">{cancelMessage}</p>
					<button class="text-slate-400 hover:text-slate-600" onclick={() => cancelMessage = ''}>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
					</button>
				</div>
			{/if}

			{#if upcomingScheduledTours.length === 0}
				<div class="bg-slate-50 p-6 rounded-lg text-center border border-slate-200">
					<p class="text-slate-600">No upcoming scheduled routes.</p>
				</div>
			{:else}
				<div class="overflow-x-auto border border-slate-200 rounded-lg bg-white">
					<table class="min-w-full">
						<thead class="bg-slate-50 text-slate-600 text-sm">
							<tr>
								<th class="py-3 px-4 text-left font-medium">Route</th>
								<th class="py-3 px-4 text-left font-medium">Date</th>
								<th class="py-3 px-4 text-left font-medium">Participants</th>
								<th class="py-3 px-4 text-left font-medium">Actions</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-slate-100 text-sm">
							{#each upcomingScheduledTours as schedule}
								<tr class="hover:bg-slate-50">
									<td class="py-3 px-4 text-slate-600">
										{#if schedule.tours}
											{getTourData(schedule.tours).name}
										{:else}
											<span class="text-slate-400">Unknown Route</span>
										{/if}
									</td>
									<td class="py-3 px-4 text-slate-600">{formatDate(schedule.scheduled_date || schedule.scheduledDate)}</td>
									<td class="py-3 px-4 text-slate-600">0 / {schedule.max_participants || schedule.maxParticipants}</td>
									<td class="py-3 px-4">
										<a
											href="/dashboard/schedules/{schedule.id}/manage"
											class="text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors mr-3"
										>Manage</a>
										<button
											class="text-xs font-medium text-red-400 hover:text-red-600 transition-colors disabled:opacity-50"
											onclick={() => handleCancelSchedule(schedule.id, schedule.tours ? getTourData(schedule.tours).name : 'Unknown')}
											disabled={cancellingScheduleId !== null}
										>{cancellingScheduleId === schedule.id ? 'Cancelling...' : 'Cancel'}</button>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	{/if}
</div>
