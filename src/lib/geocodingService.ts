// Geocoding service using Nominatim API (OpenStreetMap)
// Rate limited to 1 request per second as per Nominatim usage policy
//
// Improvements over naive approach:
// - Pre-fetches city bounding box to bias all stop searches to the right area
// - Multi-strategy fallback: structured search → free-text → bounded search
// - Smart query cleaning: detects descriptions vs addresses, strips duplicates
// - Better disambiguation: scores results by city proximity + placeType match

import type { TourStopLocation, ParsedStopData } from '$lib/firebase/types';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';

const NOMINATIM_HEADERS = {
	'Accept-Language': 'en',
	'User-Agent': 'LangTour/1.0'
};

// Rate limiter - ensures 1 second between requests
let lastRequestTime = 0;

async function waitForRateLimit(): Promise<void> {
	const now = Date.now();
	const timeSinceLastRequest = now - lastRequestTime;
	if (timeSinceLastRequest < 1000) {
		await new Promise((resolve) => setTimeout(resolve, 1000 - timeSinceLastRequest));
	}
	lastRequestTime = Date.now();
}

// ── Types ──

export interface GeocodeResult {
	location: TourStopLocation;
	confidence: 'high' | 'medium' | 'low';
}

export interface GeocodeResponse {
	status: 'found' | 'not_found' | 'ambiguous';
	result?: GeocodeResult;
	alternatives?: TourStopLocation[];
}

export interface BatchGeocodeProgress {
	completed: number;
	total: number;
	currentPlace: string;
}

// ── Internal helpers ──

// Detect if text is a description rather than a usable address
function isDescriptionText(text: string): boolean {
	if (!text) return false;
	const trimmed = text.trim();
	if (trimmed.length > 100) return true;
	// Multiple sentences
	if ((trimmed.match(/\. [A-Z]/g) || []).length >= 1) return true;
	return /\b(famous|historic|located|known for|popular|beautiful|traditional|oldest|best|great|charming|vibrant|bustling|lovely|stunning|magnificent|ancient|unique|offers|features|serving|established|built in|dating|century|founded|overlooking|nestled|tucked|perfect|ideal|renowned|celebrated)\b/i.test(
		trimmed
	);
}

// Parse "City, Country" or "City" into parts
function parseCityString(contextCity: string): { city: string; country?: string } {
	const parts = contextCity
		.split(',')
		.map((p) => p.trim())
		.filter(Boolean);
	if (parts.length >= 2) {
		return { city: parts[0], country: parts[parts.length - 1] };
	}
	return { city: contextCity };
}

// Check if two strings significantly overlap (one contains the other)
function hasSignificantOverlap(a: string, b: string): boolean {
	if (!a || !b) return false;
	const aNorm = a.toLowerCase().trim();
	const bNorm = b.toLowerCase().trim();
	return aNorm.includes(bNorm) || bNorm.includes(aNorm);
}

// Haversine distance in km
function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
	const R = 6371;
	const dLat = ((lat2 - lat1) * Math.PI) / 180;
	const dLng = ((lng2 - lng1) * Math.PI) / 180;
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos((lat1 * Math.PI) / 180) *
			Math.cos((lat2 * Math.PI) / 180) *
			Math.sin(dLng / 2) ** 2;
	return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// City bounding box for viewbox biasing
interface CityBounds {
	viewbox: string; // "west,north,east,south" for Nominatim
	lat: number;
	lng: number;
	radiusKm: number;
}

const cityBoundsCache = new Map<string, CityBounds | null>();

async function fetchCityBounds(contextCity: string): Promise<CityBounds | null> {
	if (cityBoundsCache.has(contextCity)) {
		return cityBoundsCache.get(contextCity) || null;
	}

	await waitForRateLimit();

	try {
		const response = await fetch(
			`${NOMINATIM_URL}/search?format=json&q=${encodeURIComponent(contextCity)}&limit=1`,
			{ headers: NOMINATIM_HEADERS }
		);

		if (!response.ok) {
			cityBoundsCache.set(contextCity, null);
			return null;
		}

		const data = await response.json();
		if (!data?.[0]?.boundingbox) {
			cityBoundsCache.set(contextCity, null);
			return null;
		}

		const item = data[0];
		const [south, north, west, east] = item.boundingbox.map(Number);
		const latRange = north - south;
		const lngRange = east - west;
		// Expand bounds by 30% so suburbs and outskirts are included
		const expand = 0.3;

		const bounds: CityBounds = {
			viewbox: `${west - lngRange * expand},${north + latRange * expand},${east + lngRange * expand},${south - latRange * expand}`,
			lat: parseFloat(item.lat),
			lng: parseFloat(item.lon),
			radiusKm: distanceKm(south, west, north, east) / 2
		};

		cityBoundsCache.set(contextCity, bounds);
		return bounds;
	} catch (error) {
		console.error('City bounds lookup error:', error);
		cityBoundsCache.set(contextCity, null);
		return null;
	}
}

// Low-level Nominatim search with rate limiting
async function nominatimSearch(params: Record<string, string>): Promise<any[]> {
	await waitForRateLimit();

	const searchParams = new URLSearchParams({
		format: 'json',
		addressdetails: '1',
		limit: '5',
		...params
	});

	try {
		const response = await fetch(`${NOMINATIM_URL}/search?${searchParams.toString()}`, {
			headers: NOMINATIM_HEADERS
		});
		if (!response.ok) return [];
		return (await response.json()) || [];
	} catch {
		return [];
	}
}

// Convert raw Nominatim results to TourStopLocation[]
function toLocations(data: any[], fallbackName: string): TourStopLocation[] {
	return data.map((item: any) => ({
		lat: parseFloat(item.lat),
		lng: parseFloat(item.lon),
		address: item.display_name || '',
		placeName:
			item.name ||
			item.address?.amenity ||
			item.address?.shop ||
			item.address?.tourism ||
			fallbackName
	}));
}

// OSM type matching for placeType-based boosting
const PLACE_TYPE_OSM_MATCHES: Record<string, string[]> = {
	cafe: ['cafe', 'coffee_shop', 'coffee'],
	restaurant: ['restaurant', 'food_court', 'fast_food', 'bistro'],
	museum: ['museum', 'gallery', 'arts_centre'],
	market: ['marketplace', 'market', 'public_market'],
	landmark: ['attraction', 'monument', 'memorial', 'castle', 'ruins', 'archaeological_site'],
	park: ['park', 'garden', 'nature_reserve'],
	shop: ['shop', 'supermarket', 'mall', 'retail'],
	neighborhood: ['neighbourhood', 'neighborhood', 'suburb', 'quarter', 'residential'],
	station: ['station', 'halt', 'stop_position', 'bus_stop'],
	square: ['square', 'plaza', 'piazza', 'pedestrian']
};

// Score and rank results using city proximity and placeType matching
function evaluateResults(
	data: any[],
	locations: TourStopLocation[],
	cityBounds: CityBounds | null,
	placeType?: string
): GeocodeResponse {
	if (locations.length === 0) {
		return { status: 'not_found' };
	}

	const scored = locations.map((loc, i) => {
		let score = parseFloat(data[i].importance || '0');

		// Boost results within city bounds
		if (cityBounds) {
			const dist = distanceKm(loc.lat, loc.lng, cityBounds.lat, cityBounds.lng);
			if (dist < cityBounds.radiusKm) {
				score += 0.3;
			} else if (dist < cityBounds.radiusKm * 2) {
				score += 0.1;
			}
		}

		// Boost results matching placeType
		if (placeType) {
			const osmType = (data[i].type || '').toLowerCase();
			const osmClass = (data[i].class || '').toLowerCase();
			const matches = PLACE_TYPE_OSM_MATCHES[placeType] || [];
			if (matches.some((m) => osmType.includes(m) || osmClass.includes(m))) {
				score += 0.2;
			}
		}

		return { location: loc, score };
	});

	scored.sort((a, b) => b.score - a.score);
	const sortedLocations = scored.map((s) => s.location);

	// Clear winner if single result or significant score gap
	if (scored.length === 1 || scored[0].score > scored[1].score + 0.15) {
		return {
			status: 'found',
			result: {
				location: sortedLocations[0],
				confidence: scored[0].score > 0.5 ? 'high' : 'medium'
			},
			alternatives: sortedLocations.slice(1)
		};
	}

	return {
		status: 'ambiguous',
		result: { location: sortedLocations[0], confidence: 'low' },
		alternatives: sortedLocations.slice(1)
	};
}

// Multi-strategy geocoding for a single stop
async function geocodeStopWithStrategies(
	stop: ParsedStopData,
	contextCity?: string,
	cityBounds?: CityBounds | null
): Promise<GeocodeResponse> {
	const { placeName, addressOrDescription, placeType } = stop;
	const bounds = cityBounds || null;
	const viewboxParams: Record<string, string> = bounds ? { viewbox: bounds.viewbox } : {};

	// Strategy 1: Structured search — amenity + city (+ country)
	// Best for named places like "Café Central" in a known city
	if (contextCity) {
		const { city, country } = parseCityString(contextCity);
		const structuredParams: Record<string, string> = {
			amenity: placeName,
			city,
			...viewboxParams
		};
		if (country) structuredParams.country = country;

		const data = await nominatimSearch(structuredParams);
		if (data.length > 0) {
			const locations = toLocations(data, placeName);
			const result = evaluateResults(data, locations, bounds, placeType);
			if (result.status === 'found') return result;
			// If ambiguous but best result is in the city, accept it
			if (result.status === 'ambiguous' && bounds && result.result) {
				const dist = distanceKm(
					result.result.location.lat,
					result.result.location.lng,
					bounds.lat,
					bounds.lng
				);
				if (dist < bounds.radiusKm) return result;
			}
		}
	}

	// Strategy 2: Free-text "placeName, city"
	// Good general-purpose fallback
	if (contextCity) {
		const data = await nominatimSearch({
			q: `${placeName}, ${contextCity}`,
			...viewboxParams
		});
		if (data.length > 0) {
			const locations = toLocations(data, placeName);
			const result = evaluateResults(data, locations, bounds, placeType);
			if (result.status !== 'not_found') return result;
		}
	}

	// Strategy 3: Include address (only if it's actually an address, not a description)
	// Skip if address overlaps with placeName (avoids redundant "Café X, Café X")
	if (
		addressOrDescription &&
		!isDescriptionText(addressOrDescription) &&
		!hasSignificantOverlap(placeName, addressOrDescription)
	) {
		const query = contextCity
			? `${placeName}, ${addressOrDescription}, ${contextCity}`
			: `${placeName}, ${addressOrDescription}`;
		const data = await nominatimSearch({
			q: query,
			...viewboxParams
		});
		if (data.length > 0) {
			const locations = toLocations(data, placeName);
			const result = evaluateResults(data, locations, bounds, placeType);
			if (result.status !== 'not_found') return result;
		}
	}

	// Strategy 4: Just placeName bounded strictly to city area
	// Catches places that only exist locally and don't match structured/free-text
	if (bounds) {
		const data = await nominatimSearch({
			q: placeName,
			viewbox: bounds.viewbox,
			bounded: '1'
		});
		if (data.length > 0) {
			const locations = toLocations(data, placeName);
			return evaluateResults(data, locations, bounds, placeType);
		}
	}

	// Strategy 5: Just placeName globally (no city context at all)
	if (!contextCity) {
		const data = await nominatimSearch({ q: placeName });
		if (data.length > 0) {
			const locations = toLocations(data, placeName);
			return evaluateResults(data, locations, null, placeType);
		}
	}

	return { status: 'not_found' };
}

// ── Public API ──

// Geocode a single address with optional city context
// (Used by StopLocationPicker and other direct callers)
export async function geocodeAddress(
	query: string,
	contextCity?: string
): Promise<GeocodeResponse> {
	let cityBounds: CityBounds | null = null;
	if (contextCity) {
		cityBounds = await fetchCityBounds(contextCity);
	}

	const viewboxParams: Record<string, string> = cityBounds
		? { viewbox: cityBounds.viewbox }
		: {};
	const searchQuery = contextCity ? `${query}, ${contextCity}` : query;

	const data = await nominatimSearch({
		q: searchQuery,
		...viewboxParams
	});

	if (data.length === 0) return { status: 'not_found' };

	const locations = toLocations(data, query);
	return evaluateResults(data, locations, cityBounds);
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
			{ headers: NOMINATIM_HEADERS }
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

// Batch geocode multiple stops with multi-strategy approach and progress callback
export async function batchGeocode(
	stops: ParsedStopData[],
	contextCity?: string,
	onProgress?: (progress: BatchGeocodeProgress) => void
): Promise<ParsedStopData[]> {
	const results: ParsedStopData[] = [];
	const total = stops.length;

	// Pre-fetch city bounds once for all stops (saves repeated lookups)
	let cityBounds: CityBounds | null = null;
	if (contextCity) {
		cityBounds = await fetchCityBounds(contextCity);
	}

	for (let i = 0; i < stops.length; i++) {
		const stop = stops[i];

		if (onProgress) {
			onProgress({
				completed: i,
				total,
				currentPlace: stop.placeName
			});
		}

		// Use multi-strategy geocoding instead of single query
		const response = await geocodeStopWithStrategies(stop, contextCity, cityBounds);

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

	if (onProgress) {
		onProgress({
			completed: total,
			total,
			currentPlace: 'Complete'
		});
	}

	return results;
}
