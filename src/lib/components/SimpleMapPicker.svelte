<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { Map, Marker, LeafletMouseEvent } from 'leaflet';

  // Props
  export let value = '';
  export let required = false;

  // Internal state
  let mapContainer: HTMLElement;
  let searchInput: HTMLInputElement;
  let mapLoaded = false;
  let map: Map | null = null;
  let marker: Marker | null = null;
  let displayAddress = '';
  let L: typeof import('leaflet') | null = null;

  // Nominatim API for geocoding (free, no API key needed)
  const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';

  onMount(async () => {
    // Dynamically import Leaflet (client-side only)
    const leaflet = await import('leaflet');
    L = leaflet.default;

    // Import Leaflet CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    // Wait for CSS to load
    await new Promise(resolve => setTimeout(resolve, 100));

    setupMap();
  });

  onDestroy(() => {
    if (map) {
      map.remove();
      map = null;
    }
  });

  async function setupMap() {
    if (!mapContainer || !L) return;

    try {
      // Default location (Copenhagen)
      const defaultLocation: [number, number] = [55.6761, 12.5683];

      // Create the map
      map = L.map(mapContainer).setView(defaultLocation, 13);

      // Add OpenStreetMap tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);

      // Create a draggable marker
      marker = L.marker(defaultLocation, { draggable: true }).addTo(map);

      // Try to get user's current location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const userLocation: [number, number] = [
              position.coords.latitude,
              position.coords.longitude
            ];

            map?.setView(userLocation, 13);
            marker?.setLatLng(userLocation);

            // Store coordinates
            value = `${userLocation[0]},${userLocation[1]}`;

            // Reverse geocode
            const address = await reverseGeocode(userLocation[0], userLocation[1]);
            if (address) {
              displayAddress = address;
              if (searchInput) searchInput.value = address;
            }
          },
          (error) => {
            console.log('Geolocation error:', error.message);
          },
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
      }

      // Handle map clicks
      map.on('click', async (e: LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        marker?.setLatLng([lat, lng]);
        value = `${lat},${lng}`;

        const address = await reverseGeocode(lat, lng);
        if (address) {
          displayAddress = address;
          if (searchInput) searchInput.value = address;
        }
      });

      // Handle marker drag
      marker.on('dragend', async () => {
        const position = marker?.getLatLng();
        if (position) {
          value = `${position.lat},${position.lng}`;

          const address = await reverseGeocode(position.lat, position.lng);
          if (address) {
            displayAddress = address;
            if (searchInput) searchInput.value = address;
          }
        }
      });

      // If we have an initial value, parse and display it
      if (value) {
        const coords = value.split(',');
        if (coords.length === 2) {
          const lat = parseFloat(coords[0]);
          const lng = parseFloat(coords[1]);

          if (!isNaN(lat) && !isNaN(lng)) {
            map.setView([lat, lng], 13);
            marker.setLatLng([lat, lng]);

            const address = await reverseGeocode(lat, lng);
            if (address) {
              displayAddress = address;
              if (searchInput) searchInput.value = address;
            }
          }
        }
      }

      mapLoaded = true;
    } catch (error) {
      console.error('Error setting up map:', error);
    }
  }

  // Reverse geocode using Nominatim
  async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
    try {
      const response = await fetch(
        `${NOMINATIM_URL}/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await response.json();
      return data.display_name || null;
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return null;
    }
  }

  // Forward geocode (search) using Nominatim
  async function searchLocation(query: string) {
    if (!query.trim() || !map || !marker || !L) return;

    try {
      const response = await fetch(
        `${NOMINATIM_URL}/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await response.json();

      if (data && data.length > 0) {
        const result = data[0];
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);

        map.setView([lat, lng], 15);
        marker.setLatLng([lat, lng]);
        value = `${lat},${lng}`;
        displayAddress = result.display_name;
        searchInput.value = displayAddress;
      }
    } catch (error) {
      console.error('Search error:', error);
    }
  }

  // Handle search input
  function handleSearchKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      searchLocation(searchInput.value);
    }
  }
</script>

<div class="map-picker">
  <div class="relative mb-4">
    <input
      bind:this={searchInput}
      type="text"
      placeholder="Search for a location and press Enter"
      class="w-full p-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
      on:keydown={handleSearchKeydown}
      {required}
    />
  </div>

  <div
    bind:this={mapContainer}
    class="map-container rounded-md border border-slate-200"
    style="width: 100%; height: 350px;"
  >
    {#if !mapLoaded}
      <div class="flex items-center justify-center h-full bg-gray-100 rounded-md">
        <p class="text-gray-500">Loading map...</p>
      </div>
    {/if}
  </div>
</div>

<style>
  :global(.leaflet-container) {
    font-family: inherit;
  }
</style>
