<script lang="ts">
  import { onMount } from 'svelte';
  
  // Props
  export let value = '';
  export let required = false;
  
  // Internal state
  let mapContainer: HTMLElement;
  let searchInput: HTMLInputElement;
  let mapLoaded = false;
  
  // Direct API key reference - this is a temporary solution
  const API_KEY = 'AIzaSyCQ-BDUQSi8rItD-t6_AV2wW67KKDIFv0w';
  
  // TypeScript workaround for Google Maps API
  // We'll use any type for simplicity
  type GoogleMapsWindow = Window & {
    initMap: () => void;
    google: any;
  };
  
  const win = window as GoogleMapsWindow;
  
  onMount(() => {
    // Create and append the script
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places&callback=initMap`;
    script.async = true;
    script.defer = true;
    
    // Define the callback function globally
    win.initMap = () => {
      console.log('Map initialized');
      setupMap();
    };
    
    // Add the script to the document
    document.head.appendChild(script);
    
    return () => {
      // Cleanup on component destruction
      const existingScript = document.getElementById('google-maps-script');
      if (existingScript) {
        existingScript.remove();
      }
    };
  });
  
  function setupMap() {
    if (!mapContainer) return;
    
    try {
      // Default location (New York City)
      const defaultLocation = { lat: 40.7128, lng: -74.0060 };
      
      // Create the map
      const map = new window.google.maps.Map(mapContainer, {
        center: defaultLocation,
        zoom: 13,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false
      });
      
      // Create a marker
      const marker = new window.google.maps.Marker({
        position: defaultLocation,
        map: map,
        draggable: true
      });
      
      // Initialize the search box
      const autocomplete = new window.google.maps.places.Autocomplete(searchInput);
      
      // We'll skip setting bounds as it's causing TypeScript errors
      // This won't affect basic functionality
      
      // Handle place selection
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        
        if (!place.geometry || !place.geometry.location) {
          console.error('No geometry found for this place');
          return;
        }
        
        // Update map and marker
        map.setCenter(place.geometry.location);
        marker.setPosition(place.geometry.location);
        
        // Update the value
        value = place.formatted_address || '';
      });
      
      // Handle map clicks
      map.addListener('click', (e: any) => {
        marker.setPosition(e.latLng);
        
        // Reverse geocode
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode(
          { location: e.latLng },
          (results: any[], status: string) => {
            if (status === 'OK' && results[0]) {
              value = results[0].formatted_address;
              searchInput.value = results[0].formatted_address;
            }
          }
        );
      });
      
      // Handle marker drag
      marker.addListener('dragend', () => {
        const position = marker.getPosition();
        
        // Reverse geocode
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode(
          { location: position },
          (results: any[], status: string) => {
            if (status === 'OK' && results[0]) {
              value = results[0].formatted_address;
              searchInput.value = results[0].formatted_address;
            }
          }
        );
      });
      
      // If we have an initial value, geocode it
      if (value) {
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode(
          { address: value },
          (results: any[], status: string) => {
            if (status === 'OK' && results[0]) {
              map.setCenter(results[0].geometry.location);
              marker.setPosition(results[0].geometry.location);
            }
          }
        );
      }
      
      mapLoaded = true;
    } catch (error) {
      console.error('Error setting up map:', error);
    }
  }
</script>

<svelte:head>
  <!-- Add any additional styles or scripts here -->
</svelte:head>

<div class="map-picker">
  <div class="mb-2">
    <input
      type="text"
      bind:this={searchInput}
      value={value}
      on:input={(e) => value = e.currentTarget.value}
      placeholder="Search for a location"
      class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
      {required}
    />
  </div>
  
  <div 
    bind:this={mapContainer} 
    class="map-container rounded-md" 
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
  /* Add any component-specific styles here */
</style>
