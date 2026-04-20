<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { Map as LMap, Marker, LatLngBounds } from 'leaflet';
	import { loadLeaflet } from '$lib/leafletLoader';
	import { userLocation, requestUserLocation, haversineKm } from '$lib/stores/userLocation';
	import TourListItem, { type Ownership, type TourListTour } from './TourListItem.svelte';

	let { tours, currentUserId, ownedTourIds, highlightTourId }: {
		tours: TourListTour[];
		currentUserId: string | null;
		ownedTourIds: Set<string>;
		highlightTourId?: string | null;
	} = $props();

	let mapContainer: HTMLElement;
	let map: LMap | null = null;
	let L: typeof import('leaflet') | null = null;
	let mapReady = $state(false);
	let visibleIds: Set<string> = $state(new Set());
	let hoveredId = $state<string | null>(null);
	let mobileView = $state<'map' | 'list'>('map');
	let searchQuery = $state('');
	const markers = new Map<string, Marker>();

	function ownership(t: TourListTour): Ownership {
		return currentUserId && ownedTourIds.has(t.id) ? 'own' : 'open';
	}

	function startLocation(t: TourListTour): { lat: number; lng: number } | null {
		if (!t.stops?.length) return null;
		const s = [...t.stops].sort((a, b) => a.order - b.order)[0];
		if (!s?.location?.lat || !s?.location?.lng) return null;
		return { lat: s.location.lat, lng: s.location.lng };
	}

	const COLOR = '#10b981';

	function pinHtml(own: Ownership): string {
		const path = 'M14 0 C6.27 0 0 6.27 0 14 C0 24.5 14 38 14 38 C14 38 28 24.5 28 14 C28 6.27 21.73 0 14 0 Z';
		let inner = `<circle cx="14" cy="14" r="4.5" fill="white"/>`;
		if (own === 'own') inner += `<circle cx="14" cy="14" r="2" fill="${COLOR}"/>`;
		return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="38" viewBox="0 0 28 38" style="filter: drop-shadow(0 2px 3px rgba(0,0,0,0.3));">
			<path d="${path}" fill="${COLOR}" stroke="white" stroke-width="2"/>
			${inner}
		</svg>`;
	}

	function userHtml(): string {
		return `<div style="width:22px;height:22px;border-radius:50%;background:#2563eb;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>`;
	}

	function recomputeVisible() {
		if (!map) return;
		const b: LatLngBounds = map.getBounds();
		const next = new Set<string>();
		for (const t of tours) {
			const loc = startLocation(t);
			if (!loc) continue;
			if (b.contains([loc.lat, loc.lng])) next.add(t.id);
		}
		visibleIds = next;
	}

	function refreshMarkers() {
		if (!map || !L) return;
		for (const m of markers.values()) m.remove();
		markers.clear();

		for (const t of tours) {
			const loc = startLocation(t);
			if (!loc) continue;
			const own = ownership(t);
			const marker = L.marker([loc.lat, loc.lng], {
				icon: L.divIcon({
					className: 'tour-pin',
					html: pinHtml(own),
					iconSize: [28, 38],
					iconAnchor: [14, 38],
					tooltipAnchor: [0, -32]
				})
			}).addTo(map);
			marker.bindTooltip(t.name, { direction: 'top', offset: [0, -10] });
			marker.on('mouseover', () => hoveredId = t.id);
			marker.on('mouseout', () => { if (hoveredId === t.id) hoveredId = null; });
			marker.on('click', () => {
				window.location.href = `/tours/${t.id}`;
			});
			markers.set(t.id, marker);
		}
		recomputeVisible();
	}

	function flyToTour(id: string) {
		const m = markers.get(id);
		if (m && map) map.flyTo(m.getLatLng(), Math.max(map.getZoom(), 14), { duration: 0.6 });
	}

	function showAll() {
		if (!map || !L || markers.size === 0) return;
		const pts: [number, number][] = [];
		for (const t of tours) {
			const loc = startLocation(t);
			if (loc) pts.push([loc.lat, loc.lng]);
		}
		if (pts.length === 0) return;
		map.fitBounds(L.latLngBounds(pts), { padding: [40, 40] });
	}

	let userMarker: Marker | null = null;
	function updateUserMarker() {
		if (!map || !L) return;
		const loc = $userLocation;
		if (!loc) return;
		if (userMarker) { userMarker.setLatLng([loc.lat, loc.lng]); return; }
		userMarker = L.marker([loc.lat, loc.lng], {
			icon: L.divIcon({
				className: 'user-pin',
				html: userHtml(),
				iconSize: [22, 22],
				iconAnchor: [11, 11]
			}),
			zIndexOffset: 500
		}).addTo(map);
	}

	onMount(async () => {
		requestUserLocation();
		L = await loadLeaflet();
		await new Promise(r => setTimeout(r, 50));
		if (!mapContainer) return;

		const initial: [number, number] = $userLocation
			? [$userLocation.lat, $userLocation.lng]
			: [48.8566, 2.3522];
		map = L.map(mapContainer, { zoomControl: true }).setView(initial, 5);
		L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
		}).addTo(map);

		map.on('moveend', recomputeVisible);
		mapReady = true;
		refreshMarkers();
		updateUserMarker();

		if (!$userLocation && tours.length > 0) showAll();
	});

	onDestroy(() => {
		if (map) { map.remove(); map = null; }
	});

	$effect(() => {
		if (mapReady) { void tours; void ownedTourIds; void currentUserId; refreshMarkers(); }
	});
	$effect(() => {
		if (mapReady) { void $userLocation; updateUserMarker(); }
	});
	$effect(() => {
		if (mapReady && highlightTourId) flyToTour(highlightTourId);
	});

	function matchesSearch(t: TourListTour): boolean {
		if (!searchQuery.trim()) return true;
		const q = searchQuery.toLowerCase();
		return (
			t.name.toLowerCase().includes(q) ||
			(t.cityName?.toLowerCase().includes(q) ?? false) ||
			t.languageTaught.toLowerCase().includes(q) ||
			t.instructionLanguage.toLowerCase().includes(q) ||
			(t.stops?.some(s => s.location?.placeName?.toLowerCase().includes(q) || s.location?.address?.toLowerCase().includes(q)) ?? false)
		);
	}

	let listed = $derived.by(() => {
		const filtered = tours.filter(t => visibleIds.has(t.id) && matchesSearch(t));
		const loc = $userLocation;
		if (!loc) return filtered;
		return [...filtered].sort((a, b) => {
			const la = startLocation(a); const lb = startLocation(b);
			const da = la ? haversineKm(loc.lat, loc.lng, la.lat, la.lng) : Infinity;
			const db = lb ? haversineKm(loc.lat, loc.lng, lb.lat, lb.lng) : Infinity;
			return da - db;
		});
	});
</script>

<div class="tour-map-view border border-slate-200 rounded-lg overflow-hidden bg-white">
	<div class="md:hidden flex border-b border-slate-200 bg-slate-50">
		<button
			onclick={() => mobileView = 'map'}
			class="flex-1 py-2 text-sm font-medium transition-colors"
			class:active-toggle={mobileView === 'map'}
		>Map</button>
		<button
			onclick={() => mobileView = 'list'}
			class="flex-1 py-2 text-sm font-medium transition-colors"
			class:active-toggle={mobileView === 'list'}
		>List ({listed.length})</button>
	</div>

	<div class="flex flex-col md:flex-row" style="min-height: 520px;">
		<div
			class="relative flex-1"
			class:hidden-mobile={mobileView !== 'map'}
			style="min-height: 280px;"
		>
			<div bind:this={mapContainer} class="absolute inset-0" style="z-index: 0;">
				{#if !mapReady}
					<div class="flex items-center justify-center h-full bg-slate-50">
						<p class="text-sm text-slate-500">Loading map...</p>
					</div>
				{/if}
			</div>
		</div>

		<aside
			class="md:w-[360px] md:border-l border-slate-200 flex flex-col"
			class:hidden-mobile={mobileView !== 'list'}
		>
			<div class="p-3 border-b border-slate-100">
				<div class="flex gap-2">
					<input
						type="text"
						bind:value={searchQuery}
						placeholder="Search route, city, language..."
						class="flex-1 min-w-0 text-sm border border-slate-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-300"
					/>
					{#if currentUserId}
						<a
							href="/create-with-ai"
							class="shrink-0 px-3 py-1.5 bg-slate-800 text-white text-xs font-medium rounded-md shadow-sm hover:bg-slate-900 flex items-center"
						>+ Create</a>
					{/if}
				</div>
				<p class="text-[11px] text-slate-500 mt-2">
					{listed.length} of {tours.length} in view
					{#if tours.length > listed.length}
						<button onclick={showAll} class="ml-1 text-slate-700 underline">Show all</button>
					{/if}
				</p>
			</div>
			<div class="flex-1 overflow-y-auto" style="max-height: 520px;">
				{#if listed.length === 0}
					<div class="px-4 py-10 text-center text-sm text-slate-500">
						{#if tours.length === 0}
							No routes yet.
						{:else}
							No routes in view. <button onclick={showAll} class="text-slate-700 underline">Show all</button>
						{/if}
					</div>
				{:else}
					{#each listed as t (t.id)}
						<TourListItem
							tour={t}
							ownership={ownership(t)}
							highlighted={hoveredId === t.id}
							onHover={(id) => { hoveredId = id; flyToTour(id); }}
							onLeave={() => hoveredId = null}
						/>
					{/each}
				{/if}
			</div>

			<div class="px-3 py-2 border-t border-slate-100 text-[11px] text-slate-500 flex gap-4 flex-wrap items-center">
				<span class="flex items-center gap-1.5">
					<svg width="10" height="14" viewBox="0 0 28 38"><path d="M14 0 C6.27 0 0 6.27 0 14 C0 24.5 14 38 14 38 C14 38 28 24.5 28 14 C28 6.27 21.73 0 14 0 Z" fill="#10b981"/></svg>
					Route start
				</span>
			</div>
		</aside>
	</div>
</div>

<style>
	:global(.tour-pin) { background: transparent; border: none; }
	:global(.user-pin) { background: transparent; border: none; }
	.active-toggle { background: white; color: #0f172a; box-shadow: inset 0 -2px 0 0 #0f172a; }
	.hidden-mobile { display: none; }
	@media (min-width: 768px) {
		.hidden-mobile { display: flex; }
	}
</style>
