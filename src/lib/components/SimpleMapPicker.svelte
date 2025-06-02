<script lang="ts">
  import { onMount } from 'svelte';
  
  // Props
  export let value = '';
  export let required = false;
  
  // Internal state
  let mapContainer: HTMLElement;
  let searchInput: HTMLInputElement;
  let mapLoaded = false;
  let displayAddress = ''; // Variable to store the formatted address for display
  
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
    script.id = 'google-maps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places&callback=initMap&loading=async`;
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
      // Default location (will be used as fallback)
      const defaultLocation = { lat: 40.7128, lng: -74.0060 };
      
      // Create the map with initial default location
      const map = new window.google.maps.Map(mapContainer, {
        center: defaultLocation,
        zoom: 13,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false
      });
      
      // Create a marker (using standard Marker for compatibility)
      let marker = new window.google.maps.Marker({
        position: defaultLocation,
        map: map,
        draggable: true
      });
      
      // Try to get user's current location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            // Success callback - user allowed location access
            const userLocation = {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            };
            
            // Update map and marker to user's location
            map.setCenter(userLocation);
            marker.setPosition(userLocation);
            
            // Store coordinates as the value
            value = `${userLocation.lat},${userLocation.lng}`;
            
            // Reverse geocode to get the address for display
            const geocoder = new window.google.maps.Geocoder();
            geocoder.geocode(
              { location: userLocation },
              (results: any[], status: string) => {
                if (status === 'OK' && results[0]) {
                  displayAddress = results[0].formatted_address;
                  searchInput.value = displayAddress;
                }
              }
            );
          },
          (error) => {
            // Error callback - user denied location or other error
            console.log('Geolocation error:', error.message);
            // Continue with default location (already set)
          },
          {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
          }
        );
      }
      
      // Initialize the search box with Autocomplete
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
        
        // Store coordinates as the value
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        value = `${lat},${lng}`;
        
        // Update the display address
        displayAddress = place.formatted_address || '';
        searchInput.value = displayAddress;
      });
      
      // Handle map clicks
      map.addListener('click', (e: any) => {
        marker.setPosition(e.latLng);
        
        // Store coordinates immediately
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();
        value = `${lat},${lng}`;
        
        // Reverse geocode to get the address for display
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode(
          { location: e.latLng },
          (results: any[], status: string) => {
            if (status === 'OK' && results[0]) {
              displayAddress = results[0].formatted_address;
              searchInput.value = displayAddress;
            }
          }
        );
      });
      
      // Handle marker drag
      marker.addListener('dragend', () => {
        const position = marker.getPosition();
        
        // Store coordinates immediately
        const lat = position.lat();
        const lng = position.lng();
        value = `${lat},${lng}`;
        
        // Reverse geocode to get the address for display
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode(
          { location: position },
          (results: any[], status: string) => {
            if (status === 'OK' && results[0]) {
              displayAddress = results[0].formatted_address;
              searchInput.value = displayAddress;
            }
          }
        );
      });
      
      // If we have an initial value, try to parse it as coordinates
      if (value) {
        // Check if value is in the format "lat,lng"
        const coords = value.split(',');
        if (coords.length === 2) {
          const lat = parseFloat(coords[0]);
          const lng = parseFloat(coords[1]);
          
          if (!isNaN(lat) && !isNaN(lng)) {
            const latLng = new window.google.maps.LatLng(lat, lng);
            map.setCenter(latLng);
            marker.setPosition(latLng);
            
            // Reverse geocode to get the address
            const geocoder = new window.google.maps.Geocoder();
            geocoder.geocode(
              { location: latLng },
              (results: any[], status: string) => {
                if (status === 'OK' && results[0]) {
                  displayAddress = results[0].formatted_address;
                  searchInput.value = displayAddress;
                }
              }
            );
          } else {
            // If not valid coordinates, treat as address
            const geocoder = new window.google.maps.Geocoder();
            geocoder.geocode(
              { address: value },
              (results: any[], status: string) => {
                if (status === 'OK' && results[0]) {
                  map.setCenter(results[0].geometry.location);
                  marker.setPosition(results[0].geometry.location);
                  
                  // Update value with coordinates
                  const lat = results[0].geometry.location.lat();
                  const lng = results[0].geometry.location.lng();
                  value = `${lat},${lng}`;
                  
                  displayAddress = results[0].formatted_address;
                  searchInput.value = displayAddress;
                }
              }
            );
          }
        } else {
          // If not in coordinate format, treat as address
          const geocoder = new window.google.maps.Geocoder();
          geocoder.geocode(
            { address: value },
            (results: any[], status: string) => {
              if (status === 'OK' && results[0]) {
                map.setCenter(results[0].geometry.location);
                marker.setPosition(results[0].geometry.location);
                
                // Update value with coordinates
                const lat = results[0].geometry.location.lat();
                const lng = results[0].geometry.location.lng();
                value = `${lat},${lng}`;
                
                displayAddress = results[0].formatted_address;
                searchInput.value = displayAddress;
              }
            }
          );
        }
      }
      
      mapLoaded = true;
    } catch (error) {
      console.error('Error setting up map:', error);
    }
  }
</script>

<svelte:head>
  <!-- Google Maps API is loaded dynamically in onMount -->
</svelte:head>

<div class="map-picker">
  <div class="relative mb-4">
    <input
      bind:this={searchInput}
      type="text"
      placeholder="Search for a location"
      class="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
