import { haversineKm } from '$lib/stores/userLocation';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

export interface NearbyPoi {
	name: string;
	category: string;
	distanceM: number;
}

interface OverpassElement {
	type: string;
	lat?: number;
	lon?: number;
	center?: { lat: number; lon: number };
	tags?: Record<string, string>;
}

function pickCategory(tags: Record<string, string>): string | null {
	return (
		tags.amenity ||
		tags.shop ||
		tags.tourism ||
		tags.historic ||
		tags.leisure ||
		null
	);
}

export async function fetchNearbyPois(
	lat: number,
	lng: number,
	radiusM = 250,
	limit = 15
): Promise<NearbyPoi[]> {
	const query = `
		[out:json][timeout:8];
		(
			node(around:${radiusM},${lat},${lng})[amenity];
			node(around:${radiusM},${lat},${lng})[shop];
			node(around:${radiusM},${lat},${lng})[tourism];
			node(around:${radiusM},${lat},${lng})[historic];
		);
		out body;
	`;

	let res: Response;
	try {
		res = await fetch(OVERPASS_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: 'data=' + encodeURIComponent(query),
			signal: AbortSignal.timeout(10000)
		});
	} catch {
		return [];
	}

	if (!res.ok) return [];

	const data = await res.json().catch(() => null);
	const elements: OverpassElement[] = data?.elements || [];

	const pois: NearbyPoi[] = [];
	for (const el of elements) {
		const tags = el.tags || {};
		const name = tags.name;
		if (!name) continue;
		const category = pickCategory(tags);
		if (!category) continue;
		const elat = el.lat ?? el.center?.lat;
		const elng = el.lon ?? el.center?.lon;
		if (typeof elat !== 'number' || typeof elng !== 'number') continue;
		const distanceM = Math.round(haversineKm(lat, lng, elat, elng) * 1000);
		pois.push({ name, category, distanceM });
	}

	pois.sort((a, b) => a.distanceM - b.distanceM);
	return pois.slice(0, limit);
}
