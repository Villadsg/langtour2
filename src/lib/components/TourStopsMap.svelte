<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { Map, Marker, Polyline, DivIcon } from 'leaflet';
  import type { TourStop } from '$lib/firebase/types';

  export let stops: TourStop[] = [];

  let mapContainer: HTMLElement;
  let mapLoaded = false;
  let map: Map | null = null;
  let markers: Marker[] = [];
  let polyline: Polyline | null = null;
  let L: typeof import('leaflet') | null = null;

  function createNumberedIcon(number: number): DivIcon | null {
    if (!L) return null;
    return L.divIcon({
      className: 'custom-numbered-marker',
      html: `<div style="
        background-color: #22c55e;
        color: white;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 12px;
        border: 2px solid #166534;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      ">${number}</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });
  }

  onMount(async () => {
    const leaflet = await import('leaflet');
    L = leaflet.default;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    await new Promise(resolve => setTimeout(resolve, 100));
    setupMap();
  });

  onDestroy(() => {
    if (map) {
      map.remove();
      map = null;
    }
  });

  function setupMap() {
    if (!mapContainer || !L || stops.length === 0) return;

    const sorted = [...stops].sort((a, b) => a.order - b.order);

    map = L.map(mapContainer, { scrollWheelZoom: false }).setView(
      [sorted[0].location.lat, sorted[0].location.lng],
      13
    );

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    // Add markers with popups
    sorted.forEach((stop, i) => {
      if (!map || !L) return;
      const icon = createNumberedIcon(i + 1);
      const marker = L.marker([stop.location.lat, stop.location.lng], {
        icon: icon || undefined
      }).addTo(map);

      const name = stop.location.placeName || `Stop ${i + 1}`;
      marker.bindPopup(`<strong>${i + 1}. ${name}</strong>${stop.location.address ? `<br><span style="font-size:12px;color:#666">${stop.location.address}</span>` : ''}`);

      markers.push(marker);
    });

    // Draw polyline
    if (sorted.length >= 2) {
      const path = sorted.map(s => [s.location.lat, s.location.lng] as [number, number]);
      polyline = L.polyline(path, {
        color: '#22c55e',
        weight: 3,
        opacity: 0.8
      }).addTo(map);
    }

    // Fit bounds
    if (sorted.length > 1) {
      const bounds = L.latLngBounds(
        sorted.map(s => [s.location.lat, s.location.lng] as [number, number])
      );
      map.fitBounds(bounds, { padding: [40, 40] });
    }

    mapLoaded = true;
  }
</script>

<div class="tour-stops-map">
  <div
    bind:this={mapContainer}
    class="rounded-lg border border-slate-200"
    style="width: 100%; height: 350px;"
  >
    {#if !mapLoaded}
      <div class="flex items-center justify-center h-full bg-gray-50 rounded-lg">
        <p class="text-gray-400">Loading map...</p>
      </div>
    {/if}
  </div>

  {#if stops.length > 0}
    <div class="mt-3 space-y-1">
      {#each [...stops].sort((a, b) => a.order - b.order) as stop, i}
        <div class="flex items-center gap-2 text-sm text-slate-600">
          <span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-500 text-white text-xs font-bold shrink-0">{i + 1}</span>
          <span>{stop.location.placeName || `Stop ${i + 1}`}</span>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  :global(.custom-numbered-marker) {
    background: transparent;
    border: none;
  }
</style>
