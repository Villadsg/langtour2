const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';

export interface CurrentWeather {
	/** e.g. "light rain", "clear sky" */
	description: string;
	temperatureC: number;
	/** "feels like" temperature in °C */
	apparentC: number;
	precipitationMm: number;
	isDay: boolean;
}

// WMO weather interpretation codes → short human text.
// https://open-meteo.com/en/docs (WMO Weather interpretation codes)
const WMO: Record<number, string> = {
	0: 'clear sky',
	1: 'mainly clear',
	2: 'partly cloudy',
	3: 'overcast',
	45: 'fog',
	48: 'depositing rime fog',
	51: 'light drizzle',
	53: 'moderate drizzle',
	55: 'dense drizzle',
	56: 'light freezing drizzle',
	57: 'dense freezing drizzle',
	61: 'slight rain',
	63: 'moderate rain',
	65: 'heavy rain',
	66: 'light freezing rain',
	67: 'heavy freezing rain',
	71: 'slight snowfall',
	73: 'moderate snowfall',
	75: 'heavy snowfall',
	77: 'snow grains',
	80: 'slight rain showers',
	81: 'moderate rain showers',
	82: 'violent rain showers',
	85: 'slight snow showers',
	86: 'heavy snow showers',
	95: 'thunderstorm',
	96: 'thunderstorm with slight hail',
	99: 'thunderstorm with heavy hail'
};

export async function fetchCurrentWeather(
	lat: number,
	lng: number
): Promise<CurrentWeather | null> {
	const url =
		`${OPEN_METEO_URL}?latitude=${lat}&longitude=${lng}` +
		'&current=temperature_2m,apparent_temperature,precipitation,weather_code,is_day';

	let res: Response;
	try {
		res = await fetch(url, { signal: AbortSignal.timeout(8000) });
	} catch {
		return null;
	}
	if (!res.ok) return null;

	const data = await res.json().catch(() => null);
	const c = data?.current;
	if (!c || typeof c.temperature_2m !== 'number') return null;

	const code = typeof c.weather_code === 'number' ? c.weather_code : -1;
	return {
		description: WMO[code] || 'unknown conditions',
		temperatureC: Math.round(c.temperature_2m),
		apparentC: Math.round(
			typeof c.apparent_temperature === 'number' ? c.apparent_temperature : c.temperature_2m
		),
		precipitationMm: typeof c.precipitation === 'number' ? c.precipitation : 0,
		isDay: c.is_day === 1
	};
}
