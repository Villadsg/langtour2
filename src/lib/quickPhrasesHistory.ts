const KEY = 'quickPhrasesHistory';
const MAX_ENTRIES = 10;

export interface PhraseWord {
	word: string;
	meaning: string;
}

export interface QuickPhrase {
	sentence: string;
	sentenceTranslation: string;
	words: PhraseWord[];
}

export interface ContextWeather {
	description: string;
	temperatureC: number;
	apparentC: number;
	precipitationMm: number;
	isDay: boolean;
}

/**
 * The location/time/level context a phrase set was generated in. Persisted with
 * each history entry so "more on this topic" regeneration stays as
 * situationally grounded as the first generation. Optional — older entries
 * predate this field and regenerate from place + sentence only.
 */
export interface GenerationContext {
	cefrLevel?: string;
	instructionLanguage?: string;
	city?: string;
	country?: string;
	timeBucket?: string;
	localTime?: string;
	weather?: ContextWeather | null;
}

export interface HistoryEntry {
	id: string;
	placeName: string;
	address: string;
	language: string;
	generatedAt: number;
	phrases: QuickPhrase[];
	context?: GenerationContext;
}

function isBrowser(): boolean {
	return typeof localStorage !== 'undefined';
}

function normalizePhrase(p: any): QuickPhrase | null {
	if (!p || typeof p !== 'object') return null;
	const sentence = typeof p.sentence === 'string' ? p.sentence : '';
	if (!sentence) return null;
	const words: PhraseWord[] = Array.isArray(p.words)
		? p.words
				.map((w: any): PhraseWord | null => {
					const word = typeof w?.word === 'string' ? w.word : '';
					if (!word) return null;
					return { word, meaning: typeof w?.meaning === 'string' ? w.meaning : '' };
				})
				.filter((w: PhraseWord | null): w is PhraseWord => w !== null)
		: [];
	return {
		sentence,
		sentenceTranslation:
			typeof p.sentenceTranslation === 'string' ? p.sentenceTranslation : '',
		words
	};
}

export function loadHistory(): HistoryEntry[] {
	if (!isBrowser()) return [];
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed.map((entry: any) => ({
			...entry,
			phrases: Array.isArray(entry?.phrases)
				? entry.phrases
						.map(normalizePhrase)
						.filter((p: QuickPhrase | null): p is QuickPhrase => p !== null)
				: []
		}));
	} catch {
		return [];
	}
}

export function saveEntry(entry: Omit<HistoryEntry, 'id'>, id?: string): HistoryEntry {
	const entryId =
		id ||
		(typeof crypto !== 'undefined' && crypto.randomUUID
			? crypto.randomUUID()
			: `${Date.now()}-${Math.random().toString(36).slice(2)}`);
	const full: HistoryEntry = { id: entryId, ...entry };
	if (!isBrowser()) return full;
	// Drop any prior entry with the same id (re-save of a streamed generation)
	// before prepending, so deep links stay unique.
	const history = loadHistory().filter((e) => e.id !== entryId);
	history.unshift(full);
	const trimmed = history.slice(0, MAX_ENTRIES);
	try {
		localStorage.setItem(KEY, JSON.stringify(trimmed));
	} catch {
		// ignore quota errors
	}
	return full;
}

export function clearHistory(): void {
	if (!isBrowser()) return;
	try {
		localStorage.removeItem(KEY);
	} catch {
		// ignore
	}
}
