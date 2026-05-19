import type { GenerationContext } from './quickPhrasesHistory';

/**
 * Hands a just-gathered generation off from QuickPhrasesButton to the
 * /phrases/[id] page across a client-side navigation. In-memory only — it
 * survives SPA `goto()` but not a hard reload, which is fine: a reload before
 * the stream finishes simply falls back to the "not found / generate again"
 * state, same as an expired history entry.
 */
export interface PendingGeneration {
	id: string;
	/** Body to POST to /api/quick-phrases. */
	body: Record<string, unknown>;
	placeName: string;
	address: string;
	language: string;
	context: GenerationContext;
}

const pending = new Map<string, PendingGeneration>();

export function putPending(p: PendingGeneration): void {
	pending.set(p.id, p);
}

/** Returns and removes the pending generation for `id`, if any. */
export function takePending(id: string): PendingGeneration | null {
	const v = pending.get(id) ?? null;
	if (v) pending.delete(id);
	return v;
}
