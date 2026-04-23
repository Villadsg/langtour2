<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { Map, Marker, LeafletMouseEvent } from 'leaflet';
  import { geocodeAddress, reverseGeocode } from '$lib/geocodingService';

  export let value = '';
  export let required = false;

  let mapContainer: HTMLElement;
  let searchInput: HTMLInputElement;
  let map: Map | null = null;
  let marker: Marker | null = null;
  let L: typeof import('leaflet') | null = null;
  let mapLoaded = false;
  let searching = false;

  const defaultCenter: [number, number] = [55.6761, 12.5683]; // Copenhagen

  onMount(async () => {
    const leaflet = await import('leaflet');
    L = leaflet.default;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    await new Promise((r) => setTimeout(r, 50));
    setupMap();

    // If we already have a value (e.g. prefilled default), try to locate it on the map
    if (value) {
      geocodeAndPlace(value);
    }
  });

  onDestroy(() => {
    if (map) {
      map.remove();
      map = null;
    }
  });

  function setupMap() {
    if (!mapContainer || !L) return;

    map = L.map(mapContainer).setView(defaultCenter, 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    map.on('click', async (e: LeafletMouseEvent) => {
      placeMarker(e.latlng.lat, e.latlng.lng);
      const res = await reverseGeocode(e.latlng.lat, e.latlng.lng);
      if (res) {
        value = res.address;
      }
    });

    mapLoaded = true;
  }

  function placeMarker(lat: number, lng: number) {
    if (!map || !L) return;
    if (marker) {
      marker.setLatLng([lat, lng]);
    } else {
      marker = L.marker([lat, lng], { draggable: true }).addTo(map);
      marker.on('dragend', async () => {
        if (!marker) return;
        const pos = marker.getLatLng();
        const res = await reverseGeocode(pos.lat, pos.lng);
        if (res) value = res.address;
      });
    }
    map.setView([lat, lng], 15);
  }

  async function geocodeAndPlace(query: string) {
    if (!query.trim()) return;
    searching = true;
    try {
      const res = await geocodeAddress(query);
      if (res.status === 'found' && res.result) {
        placeMarker(res.result.location.lat, res.result.location.lng);
      } else if (res.status === 'ambiguous' && res.alternatives && res.alternatives.length > 0) {
        const first = res.alternatives[0];
        placeMarker(first.lat, first.lng);
      }
    } catch (e) {
      console.error('Geocoding error:', e);
    } finally {
      searching = false;
    }
  }

  async function handleSearch(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      await geocodeAndPlace(value);
    }
  }
</script>

<div class="map-picker">
  <div class="mb-2 relative">
    <input
      type="text"
      bind:this={searchInput}
      bind:value
      on:keydown={handleSearch}
      on:blur={() => value && geocodeAndPlace(value)}
      placeholder="Search for a location (press Enter)"
      class="w-full px-3 py-2 border border-slate-200 rounded-md shadow-sm focus:outline-none focus:ring-slate-300 focus:border-slate-300"
      {required}
    />
    {#if searching}
      <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">Searching…</span>
    {/if}
  </div>

  <div
    bind:this={mapContainer}
    class="map-container rounded-md overflow-hidden"
    style="width: 100%; height: 300px;"
  >
    {#if !mapLoaded}
      <div class="flex items-center justify-center h-full bg-gray-100 rounded-md">
        <p class="text-gray-500">Loading map...</p>
      </div>
    {/if}
  </div>
</div>
