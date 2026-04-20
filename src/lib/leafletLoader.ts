let leafletPromise: Promise<typeof import('leaflet')> | null = null;
let cssInjected = false;

export async function loadLeaflet(): Promise<typeof import('leaflet')> {
	if (!cssInjected && typeof document !== 'undefined') {
		const existing = document.querySelector('link[data-leaflet-css]');
		if (!existing) {
			const link = document.createElement('link');
			link.rel = 'stylesheet';
			link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
			link.setAttribute('data-leaflet-css', 'true');
			document.head.appendChild(link);
		}
		cssInjected = true;
	}

	if (!leafletPromise) {
		leafletPromise = import('leaflet').then(m => m.default);
	}
	return leafletPromise;
}
