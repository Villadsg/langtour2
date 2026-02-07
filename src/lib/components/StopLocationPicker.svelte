<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import type { Map, Marker, LeafletMouseEvent } from 'leaflet';
  import type { TourStopLocation } from '$lib/firebase/types';
  import { reverseGeocode } from '$lib/geocodingService';

  export let location: TourStopLocation | undefined = undefined;
  export let alternatives: TourStopLocation[] = [];
  export let placeName: string = '';

  const dispatch = createEventDispatcher();

  let mapContainer: HTMLElement;
  let map: Map | null = null;
  let marker: Marker | null = null;
  let alternativeMarkers: Marker[] = [];
  let L: typeof import('leaflet') | null = null;
  let mapLoaded = false;

  // Default location (Copenhagen) or use provided location
  $: defaultCenter = location
    ? [location.lat, location.lng] as [number, number]
    : [55.6761, 12.5683] as [number, number];

  onMount(async () => {
    const leaflet = await import('leaflet');
    L = leaflet.default;

    // Import Leaflet CSS
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
    if (!mapContainer || !L) return;

    map = L.map(mapContainer).setView(defaultCenter, 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    // Add main marker if location exists
    if (location) {
      addMainMarker(location);
    }

    // Add alternative markers
    if (alternatives.length > 0) {
      addAlternativeMarkers();
    }

    // Handle map clicks
    map.on('click', async (e: LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      await selectLocation(lat, lng);
    });

    mapLoaded = true;
  }

  function addMainMarker(loc: TourStopLocation) {
    if (!map || !L) return;

    if (marker) {
      marker.remove();
    }

    marker = L.marker([loc.lat, loc.lng], {
      draggable: true,
      icon: L.divIcon({
        className: 'custom-main-marker',
        html: `<div style="
          background-color: #22c55e;
          color: white;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 14px;
          border: 3px solid #166534;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        ">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 18px; height: 18px;">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
          </svg>
        </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      })
    }).addTo(map);

    marker.on('dragend', async () => {
      if (!marker) return;
      const pos = marker.getLatLng();
      await selectLocation(pos.lat, pos.lng);
    });
  }

  function addAlternativeMarkers() {
    if (!map || !L) return;

    // Clear existing alternative markers
    alternativeMarkers.forEach(m => m.remove());
    alternativeMarkers = [];

    alternatives.forEach((alt, index) => {
      const altMarker = L!.marker([alt.lat, alt.lng], {
        icon: L!.divIcon({
          className: 'custom-alt-marker',
          html: `<div style="
            background-color: #6b7280;
            color: white;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 11px;
            border: 2px solid #4b5563;
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
            cursor: pointer;
          ">${index + 1}</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        })
      }).addTo(map!);

      altMarker.on('click', () => {
        selectAlternative(index);
      });

      altMarker.bindTooltip(alt.placeName || alt.address || `Option ${index + 1}`, {
        direction: 'top',
        offset: [0, -12]
      });

      alternativeMarkers.push(altMarker);
    });
  }

  async function selectLocation(lat: number, lng: number) {
    // Reverse geocode to get address
    const result = await reverseGeocode(lat, lng);

    const newLocation: TourStopLocation = {
      lat,
      lng,
      address: result?.address || '',
      placeName: placeName || result?.placeName || 'Selected Location'
    };

    location = newLocation;
    addMainMarker(newLocation);

    dispatch('locationChange', newLocation);
  }

  function selectAlternative(index: number) {
    const alt = alternatives[index];
    if (!alt || !map) return;

    location = { ...alt, placeName: placeName || alt.placeName };
    addMainMarker(location);
    map.setView([alt.lat, alt.lng], 16);

    dispatch('locationChange', location);
  }

  function confirmLocation() {
    if (location) {
      dispatch('confirm', location);
    }
  }
</script>

<div class="stop-location-picker border border-slate-200 rounded-lg overflow-hidden">
  <div class="p-3 bg-gray-50 border-b border-slate-200">
    <div class="flex items-center justify-between">
      <div>
        <p class="text-sm font-medium text-gray-700">Select location for: {placeName || 'this stop'}</p>
        <p class="text-xs text-gray-500 mt-0.5">
          {#if alternatives.length > 0}
            Click numbered markers to select, or click anywhere on map
          {:else}
            Click on the map to place the marker, or drag it to adjust
          {/if}
        </p>
      </div>
      {#if location}
        <button
          type="button"
          on:click={confirmLocation}
          class="px-3 py-1.5 bg-green-500 text-white text-sm rounded hover:bg-green-600 transition-colors"
        >
          Confirm
        </button>
      {/if}
    </div>
  </div>

  <div
    bind:this={mapContainer}
    class="w-full"
    style="height: 250px;"
  >
    {#if !mapLoaded}
      <div class="flex items-center justify-center h-full bg-gray-100">
        <p class="text-gray-500 text-sm">Loading map...</p>
      </div>
    {/if}
  </div>

  {#if location}
    <div class="p-3 bg-white border-t border-slate-200">
      <div class="flex items-start gap-2">
        <svg class="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" />
        </svg>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-gray-900 truncate">{location.placeName || 'Selected Location'}</p>
          <p class="text-xs text-gray-500 truncate">{location.address || `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`}</p>
        </div>
      </div>
    </div>
  {/if}

  {#if alternatives.length > 0}
    <div class="p-3 bg-gray-50 border-t border-slate-200">
      <p class="text-xs font-medium text-gray-600 mb-2">Other possible locations:</p>
      <div class="space-y-1.5">
        {#each alternatives as alt, index}
          <button
            type="button"
            on:click={() => selectAlternative(index)}
            class="w-full text-left px-2 py-1.5 text-xs bg-white border border-slate-200 rounded hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <span class="w-5 h-5 bg-gray-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0">
              {index + 1}
            </span>
            <span class="truncate">{alt.placeName || alt.address || `Option ${index + 1}`}</span>
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  :global(.custom-main-marker),
  :global(.custom-alt-marker) {
    background: transparent;
    border: none;
  }
</style>
