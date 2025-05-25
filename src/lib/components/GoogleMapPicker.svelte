<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';

  // Props
  export let value: string = '';
  export let placeholder: string = 'Search for a location';
  export let height: string = '300px';
  export let required: boolean = false;

  // Internal state
  let mapElement: HTMLElement;
  let searchInput: HTMLInputElement;
  let map: google.maps.Map;
  let marker: google.maps.Marker;
  let geocoder: google.maps.Geocoder;
  let autocomplete: google.maps.places.Autocomplete;
  let mapInitialized = false;
  let apiLoaded = false;

  // API key from environment variables
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;
  
  // Log for debugging
  console.log('Google Maps API key available:', !!apiKey);
  
  // Initialize the address input with the value
  let addressInput = value;

  // Watch for external value changes
  $: if (value !== addressInput && mapInitialized) {
    addressInput = value;
    geocodeAddress(value);
  }

  // Function to update the location value
  function updateLocationValue(address: string) {
    addressInput = address;
    value = address;
  }

  function loadGoogleMapsAPI() {
    if (!browser || window.google?.maps || document.getElementById('google-maps-script')) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.id = 'google-maps-script';
      // Hardcoding the API key directly to troubleshoot
      const actualApiKey = 'AIzaSyCQ-BDUQSi8rItD-t6_AV2wW67KKDIFv0w';
      console.log('Using API key:', actualApiKey);
      script.src = `https://maps.googleapis.com/maps/api/js?key=${actualApiKey}&libraries=places`;
      script.async = true;
      script.defer = true;
      
      script.onload = () => {
        apiLoaded = true;
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load Google Maps API'));
      
      document.head.appendChild(script);
    });
  }

  async function initMap() {
    if (!browser || !mapElement) return;
    
    try {
      await loadGoogleMapsAPI();
      
      // Default to a central location if no value is provided
      const defaultPosition = { lat: 40.7128, lng: -74.0060 }; // New York City
      
      // Create the map
      map = new google.maps.Map(mapElement, {
        zoom: 13,
        center: defaultPosition,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false
      });
      
      // Create the marker
      marker = new google.maps.Marker({
        position: defaultPosition,
        map: map,
        draggable: true,
        animation: google.maps.Animation.DROP
      });
      
      // Initialize geocoder
      geocoder = new google.maps.Geocoder();
      
      // If we have an initial value, geocode it
      if (value) {
        geocodeAddress(value);
      }
      
      // Set up click event on map
      map.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (e.latLng) {
          marker.setPosition(e.latLng);
          reverseGeocode(e.latLng);
        }
      });
      
      // Set up marker drag event
      marker.addListener('dragend', () => {
        const position = marker.getPosition();
        if (position) {
          reverseGeocode(position);
        }
      });
      
      // Set up autocomplete
      autocomplete = new google.maps.places.Autocomplete(searchInput, {
        fields: ['formatted_address', 'geometry', 'name']
      });
      
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        
        if (!place.geometry || !place.geometry.location) {
          console.error('No geometry found for this place');
          return;
        }
        
        // Set the map to the new location
        map.setCenter(place.geometry.location);
        marker.setPosition(place.geometry.location);
        
        // Update the formatted address
        updateLocationValue(place.formatted_address || place.name || '');
      });
      
      mapInitialized = true;
    } catch (error) {
      console.error('Error initializing Google Maps:', error);
    }
  }

  // Convert address to coordinates and update map
  async function geocodeAddress(address: string) {
    if (!geocoder || !address) return;
    
    try {
      const result = await geocoder.geocode({ address });
      
      if (result.results && result.results.length > 0) {
        const location = result.results[0].geometry.location;
        
        map.setCenter(location);
        marker.setPosition(location);
        
        updateLocationValue(result.results[0].formatted_address);
      }
    } catch (error) {
      console.error('Geocoding error:', error);
    }
  }

  // Convert coordinates to address
  async function reverseGeocode(latLng: google.maps.LatLng) {
    if (!geocoder) return;
    
    try {
      const result = await geocoder.geocode({ location: latLng });
      
      if (result.results && result.results.length > 0) {
        updateLocationValue(result.results[0].formatted_address);
      }
    } catch (error) {
      console.error('Reverse geocoding error:', error);
    }
  }

  onMount(() => {
    initMap();
  });

  onDestroy(() => {
    // Clean up if needed
    if (map) {
      // Remove event listeners if necessary
    }
  });
</script>

<div class="google-map-picker">
  <div class="mb-2">
    <input
      type="text"
      bind:this={searchInput}
      bind:value={addressInput}
      {placeholder}
      {required}
      class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
      on:input={() => value = addressInput}
    />
  </div>
  
  <div bind:this={mapElement} style="width: 100%; height: {height}; border-radius: 0.375rem;" class="relative">
    {#if !apiLoaded}
      <div class="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-md">
        <div class="text-gray-500">Loading map...</div>
      </div>
    {/if}
  </div>
</div>
