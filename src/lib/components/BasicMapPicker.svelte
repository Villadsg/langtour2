<script>
  import { onMount } from 'svelte';
  
  // Props
  export let value = '';
  export let required = false;
  
  // Internal state
  let mapContainer;
  let searchInput;
  let mapLoaded = false;
  
  // Direct API key reference
  const API_KEY = 'AIzaSyCQ-BDUQSi8rItD-t6_AV2wW67KKDIFv0w';
  
  // Script loading status
  let scriptLoaded = false;
  let scriptLoading = false;
  
  function loadGoogleMapsScript() {
    if (scriptLoaded || scriptLoading) return Promise.resolve();
    
    scriptLoading = true;
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.id = 'google-maps-script';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places`;
      script.async = true;
      script.defer = true;
      
      script.onload = () => {
        scriptLoaded = true;
        scriptLoading = false;
        resolve();
      };
      
      script.onerror = () => {
        scriptLoading = false;
        reject(new Error('Failed to load Google Maps API'));
      };
      
      document.head.appendChild(script);
    });
  }
  
  async function initMap() {
    if (!mapContainer) return;
    
    try {
      await loadGoogleMapsScript();
      
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
        searchInput.value = value;
      });
      
      // Handle map clicks
      map.addListener('click', (e) => {
        marker.setPosition(e.latLng);
        
        // Reverse geocode
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode(
          { location: e.latLng },
          (results, status) => {
            if (status === 'OK' && results[0]) {
              value = results[0].formatted_address;
              searchInput.value = value;
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
          (results, status) => {
            if (status === 'OK' && results[0]) {
              value = results[0].formatted_address;
              searchInput.value = value;
            }
          }
        );
      });
      
      // If we have an initial value, geocode it
      if (value) {
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode(
          { address: value },
          (results, status) => {
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
  
  onMount(() => {
    initMap();
    
    return () => {
      // Cleanup on component destruction
      const existingScript = document.getElementById('google-maps-script');
      if (existingScript) {
        existingScript.remove();
      }
    };
  });
</script>

<div class="map-picker">
  <div class="mb-2">
    <input
      type="text"
      bind:this={searchInput}
      value={value}
      on:input={(e) => value = e.currentTarget.value}
      placeholder="Search for a location"
      class="w-full px-3 py-2 border border-slate-200 rounded-md shadow-sm focus:outline-none focus:ring-green-400 focus:border-green-400"
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
