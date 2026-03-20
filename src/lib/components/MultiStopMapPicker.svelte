<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import type { Map, Marker, Polyline, LeafletMouseEvent, DivIcon } from 'leaflet';
  import type { TourStop, TourStopLocation } from '$lib/firebase/types';

  // Props
  export let stops: TourStop[] = [];
  export let required = false;

  const dispatch = createEventDispatcher();

  // Internal state
  let mapContainer: HTMLElement;
  let searchInput: HTMLInputElement;
  let mapLoaded = false;
  let map: Map | null = null;
  let markers: { stopId: string; marker: Marker }[] = [];
  let polyline: Polyline | null = null;
  let L: typeof import('leaflet') | null = null;

  // Nominatim API for geocoding (free, no API key needed)
  const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';

  // Generate unique ID for stops
  function generateStopId(): string {
    return `stop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Create a numbered marker icon
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

  // Update polyline to connect all stops
  function updatePolyline() {
    if (!map || !L) return;

    // Remove existing polyline
    if (polyline) {
      polyline.remove();
      polyline = null;
    }

    if (stops.length < 2) return;

    // Create path from stops
    const path = stops
      .sort((a, b) => a.order - b.order)
      .map(stop => [stop.location.lat, stop.location.lng] as [number, number]);

    // Create new polyline
    polyline = L.polyline(path, {
      color: '#22c55e',
      weight: 3,
      opacity: 0.8
    }).addTo(map);
  }

  // Update all marker icons after reorder
  function updateMarkerIcons() {
    const sortedStops = [...stops].sort((a, b) => a.order - b.order);
    markers.forEach(markerObj => {
      const stop = sortedStops.find(s => s.id === markerObj.stopId);
      if (stop && markerObj.marker && L) {
        const newIndex = sortedStops.indexOf(stop) + 1;
        const icon = createNumberedIcon(newIndex);
        if (icon) markerObj.marker.setIcon(icon);
      }
    });
  }

  // Reverse geocode using Nominatim
  async function reverseGeocode(lat: number, lng: number): Promise<{ address: string; placeName: string }> {
    try {
      const response = await fetch(
        `${NOMINATIM_URL}/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await response.json();

      // Extract a short place name from the address
      const placeName = data.name ||
        data.address?.amenity ||
        data.address?.shop ||
        data.address?.tourism ||
        data.address?.road ||
        `Stop ${stops.length + 1}`;

      return {
        address: data.display_name || '',
        placeName: placeName
      };
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return { address: '', placeName: `Stop ${stops.length + 1}` };
    }
  }

  // Forward geocode (search) using Nominatim
  async function searchLocation(query: string) {
    if (!query.trim() || !map || !L) return;

    try {
      const response = await fetch(
        `${NOMINATIM_URL}/search?format=json&q=${encodeURIComponent(query)}&limit=1&addressdetails=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await response.json();

      if (data && data.length > 0) {
        const result = data[0];
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);

        // Center map on result
        map.setView([lat, lng], 15);

        // Extract place name
        const placeName = result.name ||
          result.address?.amenity ||
          result.address?.shop ||
          result.address?.tourism ||
          query;

        // Add as a new stop
        addStop(lat, lng, result.display_name, placeName);

        // Clear search input
        searchInput.value = '';
      }
    } catch (error) {
      console.error('Search error:', error);
    }
  }

  // Add a new stop at given position
  function addStop(lat: number, lng: number, address: string = '', placeName: string = '') {
    const newStop: TourStop = {
      id: generateStopId(),
      order: stops.length,
      location: {
        lat,
        lng,
        address,
        placeName: placeName || `Stop ${stops.length + 1}`,
        placeType: ''
      }
    };

    stops = [...stops, newStop];
    createMarkerForStop(newStop);
    updatePolyline();
    dispatch('stopsChange', stops);
  }

  // Remove a stop
  export function removeStop(stopId: string) {
    // Find and remove the marker
    const markerIndex = markers.findIndex(m => m.stopId === stopId);
    if (markerIndex !== -1) {
      markers[markerIndex].marker.remove();
      markers.splice(markerIndex, 1);
    }

    // Remove from stops and reorder
    stops = stops
      .filter(s => s.id !== stopId)
      .map((s, index) => ({ ...s, order: index }));

    updateMarkerIcons();
    updatePolyline();
    dispatch('stopsChange', stops);
  }

  // Reorder stops
  export function reorderStops(newStops: TourStop[]) {
    stops = newStops.map((s, index) => ({ ...s, order: index }));
    updateMarkerIcons();
    updatePolyline();
    dispatch('stopsChange', stops);
  }

  // Update a stop's location info
  export function updateStopLocation(stopId: string, updates: Partial<TourStopLocation>) {
    stops = stops.map(s =>
      s.id === stopId
        ? { ...s, location: { ...s.location, ...updates } }
        : s
    );
    dispatch('stopsChange', stops);
  }

  // Create marker for a stop
  function createMarkerForStop(stop: TourStop) {
    if (!map || !L) return;

    const sortedStops = [...stops].sort((a, b) => a.order - b.order);
    const stopIndex = sortedStops.findIndex(s => s.id === stop.id) + 1;
    const icon = createNumberedIcon(stopIndex);

    const marker = L.marker([stop.location.lat, stop.location.lng], {
      draggable: true,
      icon: icon || undefined
    }).addTo(map);

    // Handle marker drag
    marker.on('dragend', async () => {
      const position = marker.getLatLng();
      const lat = position.lat;
      const lng = position.lng;

      // Reverse geocode to get the new address
      const { address } = await reverseGeocode(lat, lng);

      stops = stops.map(s =>
        s.id === stop.id
          ? { ...s, location: { ...s.location, lat, lng, address } }
          : s
      );

      updatePolyline();
      dispatch('stopsChange', stops);
    });

    markers.push({ stopId: stop.id, marker });
  }

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

  function setupMap() {
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

      // Try to get user's current location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const userLocation: [number, number] = [
              position.coords.latitude,
              position.coords.longitude
            ];
            map?.setView(userLocation, 13);
          },
          (error) => {
            console.log('Geolocation error:', error.message);
          },
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
      }

      // Handle map clicks - add new stop
      map.on('click', async (e: LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;

        // Reverse geocode to get the address
        const { address, placeName } = await reverseGeocode(lat, lng);
        addStop(lat, lng, address, placeName);
      });

      // Recreate markers for existing stops
      if (stops.length > 0) {
        // Center on first stop
        const firstStop = stops.sort((a, b) => a.order - b.order)[0];
        map.setView([firstStop.location.lat, firstStop.location.lng], 13);

        // Create markers
        stops.forEach(stop => createMarkerForStop(stop));
        updatePolyline();

        // Fit bounds if multiple stops
        if (stops.length > 1) {
          const bounds = L.latLngBounds(
            stops.map(stop => [stop.location.lat, stop.location.lng] as [number, number])
          );
          map.fitBounds(bounds, { padding: [50, 50] });
        }
      }

      mapLoaded = true;
    } catch (error) {
      console.error('Error setting up map:', error);
    }
  }

  // Handle search input
  function handleSearchKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      searchLocation(searchInput.value);
    }
  }

  // Watch for external stop changes and sync markers
  $: if (mapLoaded && stops && L) {
    const stopIds = stops.map(s => s.id);
    const markerStopIds = markers.map(m => m.stopId);

    // Remove markers for deleted stops
    markers = markers.filter(m => {
      if (!stopIds.includes(m.stopId)) {
        m.marker.remove();
        return false;
      }
      return true;
    });

    // Add markers for new stops
    stops.forEach(stop => {
      if (!markerStopIds.includes(stop.id)) {
        createMarkerForStop(stop);
      }
    });

    updateMarkerIcons();
    updatePolyline();
  }
</script>

<div class="multi-stop-map-picker">
  <div class="mb-2 text-sm text-gray-600">
    Click on the map or search to add stops. Drag markers to reposition.
  </div>

  <div class="relative mb-4">
    <input
      bind:this={searchInput}
      type="text"
      placeholder="Search to add a stop and press Enter..."
      class="w-full p-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-300 focus:border-transparent"
      on:keydown={handleSearchKeydown}
      {required}
    />
  </div>

  <div
    bind:this={mapContainer}
    class="map-container rounded-md border border-slate-200"
    style="width: 100%; height: 400px;"
  >
    {#if !mapLoaded}
      <div class="flex items-center justify-center h-full bg-gray-100 rounded-md">
        <p class="text-gray-500">Loading map...</p>
      </div>
    {/if}
  </div>

  {#if stops.length > 0}
    <div class="mt-2 text-sm text-gray-500">
      {stops.length} stop{stops.length !== 1 ? 's' : ''} added
    </div>
  {/if}
</div>

<style>
  :global(.leaflet-container) {
    font-family: inherit;
  }

  :global(.custom-numbered-marker) {
    background: transparent;
    border: none;
  }
</style>
