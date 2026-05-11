import { writable } from 'svelte/store';

export interface UserCoords {
	lat: number;
	lng: number;
}

export const userLocation = writable<UserCoords | null>(null);

let requested = false;

export function requestUserLocation() {
	if (requested) return;
	requested = true;
	if (typeof navigator !== 'undefined' && navigator.geolocation) {
		navigator.geolocation.getCurrentPosition(
			(pos) => {
				userLocation.set({ lat: pos.coords.latitude, lng: pos.coords.longitude });
			},
			() => { /* permission denied or error — leave as null */ }
		);
	}
}

export function watchUserLocation(): number | null {
	if (typeof navigator === 'undefined' || !navigator.geolocation) return null;
	return navigator.geolocation.watchPosition(
		(pos) => userLocation.set({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
		(err) => console.warn('watchPosition error', err),
		{ enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
	);
}

export function clearUserLocationWatch(id: number | null) {
	if (id != null && typeof navigator !== 'undefined' && navigator.geolocation) {
		navigator.geolocation.clearWatch(id);
	}
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
	const R = 6371;
	const dLat = (lat2 - lat1) * Math.PI / 180;
	const dLng = (lng2 - lng1) * Math.PI / 180;
	const a = Math.sin(dLat / 2) ** 2 +
		Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
		Math.sin(dLng / 2) ** 2;
	return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function bearingDeg(lat1: number, lng1: number, lat2: number, lng2: number): number {
	const toRad = (d: number) => d * Math.PI / 180;
	const toDeg = (r: number) => r * 180 / Math.PI;
	const dLng = toRad(lng2 - lng1);
	const φ1 = toRad(lat1);
	const φ2 = toRad(lat2);
	const y = Math.sin(dLng) * Math.cos(φ2);
	const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dLng);
	return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function estimateWalkMinutes(stops: { location: { lat: number; lng: number } }[]): number {
	if (!stops || stops.length < 2) return 0;
	let totalKm = 0;
	for (let i = 1; i < stops.length; i++) {
		totalKm += haversineKm(
			stops[i - 1].location.lat,
			stops[i - 1].location.lng,
			stops[i].location.lat,
			stops[i].location.lng
		);
	}
	return Math.round((totalKm / 5) * 60);
}

export function formatDistance(km: number): string {
	if (km < 1) return `${Math.round(km * 1000)}m away`;
	if (km < 10) return `${km.toFixed(1)}km away`;
	return `${Math.round(km)}km away`;
}
