// Geocoding service using Nominatim API (OpenStreetMap)
// Rate limited to 1 request per second as per Nominatim usage policy

import type { TourStopLocation, ParsedStopData } from '$lib/firebase/types';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';

// Rate limiter - ensures 1 second between requests
let lastRequestTime = 0;

async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < 1000) {
    await new Promise(resolve => setTimeout(resolve, 1000 - timeSinceLastRequest));
  }
  lastRequestTime = Date.now();
}

export interface GeocodeResult {
  location: TourStopLocation;
  confidence: 'high' | 'medium' | 'low';
}

export interface GeocodeResponse {
  status: 'found' | 'not_found' | 'ambiguous';
  result?: GeocodeResult;
  alternatives?: TourStopLocation[];
}

// Geocode a single address with optional city context
export async function geocodeAddress(
  query: string,
  contextCity?: string
): Promise<GeocodeResponse> {
  await waitForRateLimit();

  try {
    // Build search query with city context if available
    const searchQuery = contextCity ? `${query}, ${contextCity}` : query;

    const response = await fetch(
      `${NOMINATIM_URL}/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5&addressdetails=1`,
      {
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'LangTour/1.0'
        }
      }
    );

    if (!response.ok) {
      console.error('Nominatim API error:', response.status);
      return { status: 'not_found' };
    }

    const data = await response.json();

    if (!data || data.length === 0) {
      return { status: 'not_found' };
    }

    // Convert results to TourStopLocation format
    const locations: TourStopLocation[] = data.map((item: any) => ({
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      address: item.display_name || '',
      placeName: item.name || item.address?.amenity || item.address?.shop || item.address?.tourism || query
    }));

    // Single result with good confidence
    if (data.length === 1) {
      return {
        status: 'found',
        result: {
          location: locations[0],
          confidence: 'high'
        }
      };
    }

    // Multiple results - check if first one is significantly better
    const firstImportance = parseFloat(data[0].importance || 0);
    const secondImportance = parseFloat(data[1].importance || 0);

    if (firstImportance > secondImportance * 1.5) {
      // First result is clearly better
      return {
        status: 'found',
        result: {
          location: locations[0],
          confidence: 'high'
        },
        alternatives: locations.slice(1)
      };
    }

    // Ambiguous results
    return {
      status: 'ambiguous',
      result: {
        location: locations[0],
        confidence: 'low'
      },
      alternatives: locations.slice(1)
    };
  } catch (error) {
    console.error('Geocoding error:', error);
    return { status: 'not_found' };
  }
}

// Reverse geocode - get address from coordinates
export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<{ address: string; placeName: string } | null> {
  await waitForRateLimit();

  try {
    const response = await fetch(
      `${NOMINATIM_URL}/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'LangTour/1.0'
        }
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    const placeName =
      data.name ||
      data.address?.amenity ||
      data.address?.shop ||
      data.address?.tourism ||
      data.address?.road ||
      'Selected Location';

    return {
      address: data.display_name || '',
      placeName
    };
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
}

export interface BatchGeocodeProgress {
  completed: number;
  total: number;
  currentPlace: string;
}

// Batch geocode multiple stops with progress callback
export async function batchGeocode(
  stops: ParsedStopData[],
  contextCity?: string,
  onProgress?: (progress: BatchGeocodeProgress) => void
): Promise<ParsedStopData[]> {
  const results: ParsedStopData[] = [];
  const total = stops.length;

  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i];

    // Report progress
    if (onProgress) {
      onProgress({
        completed: i,
        total,
        currentPlace: stop.placeName
      });
    }

    // Build search query from place name and address
    const query = stop.addressOrDescription
      ? `${stop.placeName}, ${stop.addressOrDescription}`
      : stop.placeName;

    const response = await geocodeAddress(query, contextCity);

    const updatedStop: ParsedStopData = { ...stop };

    switch (response.status) {
      case 'found':
        updatedStop.geocodeStatus = 'found';
        updatedStop.location = response.result?.location;
        if (response.alternatives) {
          updatedStop.alternatives = response.alternatives;
        }
        break;

      case 'ambiguous':
        updatedStop.geocodeStatus = 'ambiguous';
        updatedStop.location = response.result?.location;
        updatedStop.alternatives = response.alternatives;
        break;

      case 'not_found':
      default:
        updatedStop.geocodeStatus = 'not_found';
        break;
    }

    results.push(updatedStop);
  }

  // Final progress report
  if (onProgress) {
    onProgress({
      completed: total,
      total,
      currentPlace: 'Complete'
    });
  }

  return results;
}
