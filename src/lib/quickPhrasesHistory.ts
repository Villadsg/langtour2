const KEY = 'quickPhrasesHistory';
const MAX_ENTRIES = 10;

export interface QuickPhrase {
	word: string;
	translation: string;
	sentence: string;
	sentenceTranslation: string;
	context?: string;
}

export interface HistoryEntry {
	id: string;
	placeName: string;
	address: string;
	language: string;
	generatedAt: number;
	phrases: QuickPhrase[];
}

function isBrowser(): boolean {
	return typeof localStorage !== 'undefined';
}

export function loadHistory(): HistoryEntry[] {
	if (!isBrowser()) return [];
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

export function saveEntry(entry: Omit<HistoryEntry, 'id'>): HistoryEntry {
	const id =
		typeof crypto !== 'undefined' && crypto.randomUUID
			? crypto.randomUUID()
			: `${Date.now()}-${Math.random().toString(36).slice(2)}`;
	const full: HistoryEntry = { id, ...entry };
	if (!isBrowser()) return full;
	const history = loadHistory();
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
