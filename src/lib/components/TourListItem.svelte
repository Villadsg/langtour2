<script lang="ts">
	import { userLocation, haversineKm } from '$lib/stores/userLocation';
	import type { TourStop } from '$lib/firebase/types';

	export type Ownership = 'own' | 'open';

	export interface TourListTour {
		id: string;
		name: string;
		cityName?: string;
		languageTaught: string;
		instructionLanguage: string;
		langDifficulty?: string;
		tourType?: string;
		stops: TourStop[];
	}

	let { tour, ownership, highlighted = false, onHover, onLeave }: {
		tour: TourListTour;
		ownership: Ownership;
		highlighted?: boolean;
		onHover?: (id: string) => void;
		onLeave?: (id: string) => void;
	} = $props();

	let startStop = $derived.by(() => {
		if (!tour.stops?.length) return null;
		return [...tour.stops].sort((a, b) => a.order - b.order)[0];
	});

	let distanceKm = $derived.by(() => {
		const loc = $userLocation;
		if (!loc || !startStop?.location) return null;
		return haversineKm(loc.lat, loc.lng, startStop.location.lat, startStop.location.lng);
	});

	let distancePill = $derived.by(() => {
		if (distanceKm === null) return null;
		let text: string;
		if (distanceKm < 1) text = `${Math.round(distanceKm * 1000)}m`;
		else if (distanceKm < 10) text = `${distanceKm.toFixed(1)}km`;
		else text = `${Math.round(distanceKm)}km`;

		let bg: string, fg: string;
		if (distanceKm < 1) { bg = '#dcfce7'; fg = '#166534'; }
		else if (distanceKm < 5) { bg = '#fef3c7'; fg = '#92400e'; }
		else { bg = '#f1f5f9'; fg = '#475569'; }
		return { text, bg, fg };
	});

	const badgeStyles: Record<Ownership, { label: string; bg: string; fg: string }> = {
		own: { label: 'YOURS', bg: '#ecfdf5', fg: '#047857' },
		open: { label: 'EXPLORE', bg: '#f8fafc', fg: '#475569' }
	};
	let badge = $derived(badgeStyles[ownership]);
	let locationName = $derived(startStop?.location?.placeName || startStop?.location?.address || tour.cityName || '');
</script>

<a
	href="/tours/{tour.id}"
	onmouseenter={() => tour.id && onHover?.(tour.id)}
	onmouseleave={() => tour.id && onLeave?.(tour.id)}
	class="tour-list-item block border-b border-slate-100 px-4 py-3 hover:bg-slate-50 transition-colors"
	class:highlighted
>
	<div class="flex items-start justify-between gap-3">
		<div class="min-w-0 flex-1">
			<div class="flex items-center gap-2 mb-1 flex-wrap">
				<span
					class="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded"
					style="background: {badge.bg}; color: {badge.fg};"
				>{badge.label}</span>
				{#if tour.tourType === 'person'}
					<span class="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">Guide</span>
				{:else if tour.tourType === 'app'}
					<span class="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded bg-purple-50 text-purple-700">App</span>
				{/if}
				{#if tour.langDifficulty}
					<span class="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{tour.langDifficulty}</span>
				{/if}
			</div>
			<h3 class="text-base font-semibold text-slate-800 truncate">{tour.name}</h3>
			<p class="text-sm text-slate-500 mt-0.5 truncate">
				{tour.languageTaught} <span class="text-slate-400">→ {tour.instructionLanguage}</span>
				{#if tour.stops?.length}<span class="text-slate-400"> · {tour.stops.length} stops</span>{/if}
				{#if locationName}<span class="text-slate-400"> · {locationName}</span>{/if}
			</p>
		</div>
		<div class="flex flex-col items-end gap-1 shrink-0">
			{#if distancePill}
				<span
					class="text-[11px] font-semibold px-2 py-0.5 rounded-full"
					style="background: {distancePill.bg}; color: {distancePill.fg};"
				>{distancePill.text}</span>
			{/if}
		</div>
	</div>
</a>

<style>
	.tour-list-item.highlighted {
		background: #f1f5f9;
		box-shadow: inset 3px 0 0 0 #10b981;
	}
</style>
