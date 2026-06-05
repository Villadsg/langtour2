import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { callLlm, LlmError } from '$lib/server/llm';

// A bare word translation never needs the web; force the non-search model so the
// local-search model's always-on search can't inject noise into a one-word gloss.
const NOSEARCH_MODEL = env.LLM_MODEL_NOSEARCH || 'local-llm';

interface RequestBody {
	word: string;
	sentence: string;
	language: string;
	instructionLanguage?: string;
}

// Strip wrapping quotes, trailing punctuation noise, and any "Word: gloss"
// preamble the model may add, then clamp length. The model is asked for a bare
// gloss; this just defends against the usual small-model embellishments.
function cleanGloss(raw: string): string {
	let g = raw.trim().split('\n')[0].trim();
	g = g.replace(/^["'`]+|["'`]+$/g, '').trim();
	const colon = g.indexOf(':');
	if (colon !== -1 && colon < 30) g = g.slice(colon + 1).trim();
	g = g.replace(/^["'`]+|["'`]+$/g, '').trim();
	return g.slice(0, 80);
}

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as RequestBody;

	const word = typeof body.word === 'string' ? body.word.trim() : '';
	const sentence = typeof body.sentence === 'string' ? body.sentence.trim() : '';
	if (!word) throw error(400, 'Missing "word"');
	if (!body.language || typeof body.language !== 'string') throw error(400, 'Missing "language"');
	const instructionLanguage =
		typeof body.instructionLanguage === 'string' && body.instructionLanguage
			? body.instructionLanguage
			: 'English';

	// Free-text answer (not JSON) — nothing to malform, so this stays reliable
	// even on a weak model. Context sentence lets the gloss reflect actual usage.
	const prompt = sentence
		? `In this ${body.language} sentence: "${sentence}"\nGive the ${instructionLanguage} meaning of the word "${word}" as used here. Reply with only the translation — a few words at most, no quotes, no explanation.`
		: `Give the ${instructionLanguage} meaning of the ${body.language} word "${word}". Reply with only the translation — a few words at most, no quotes, no explanation.`;

	try {
		const result = await callLlm({ prompt, model: NOSEARCH_MODEL, temperature: 0.2, maxTokens: 32 });
		const gloss = cleanGloss(result.content);
		if (dev) {
			console.log(`[word-gloss] "${word}" → "${gloss}" | llm ${result.ms}ms`);
		}
		if (!gloss) throw error(502, 'Empty gloss');
		return json({ gloss });
	} catch (err) {
		if (err instanceof LlmError) throw error(err.status >= 500 ? 502 : err.status, err.message);
		throw err;
	}
};
