import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { callLlm, LlmError } from '$lib/server/llm';

interface NearbyPoi {
	name: string;
	category: string;
	distanceM: number;
}

interface RequestBody {
	language: string;
	cefrLevel?: string;
	placeName?: string;
	address?: string;
	pois?: NearbyPoi[];
	instructionLanguage?: string;
	count?: number;
}

interface Phrase {
	word: string;
	translation: string;
	sentence: string;
	sentenceTranslation: string;
	context?: string;
}

const SYSTEM_PROMPT =
	'You are a language tutor producing concise, practical phrases tied to a learner\'s immediate physical surroundings. Always reply with valid JSON only — no prose, no markdown, no code fences.';

function buildPrompt(body: Required<Omit<RequestBody, 'placeName' | 'address'>> & { placeName: string; address: string }): string {
	const poiList = body.pois.length
		? body.pois.map((p) => `- ${p.name} (${p.category}, ~${p.distanceM}m away)`).join('\n')
		: '- (no specific POIs detected; rely on the address and infer the typical surroundings)';

	return `The learner is at "${body.placeName}" (${body.address}).
Nearby places:
${poiList}

Generate ${body.count} phrases in ${body.language} at CEFR level ${body.cefrLevel} that the learner could realistically use or encounter here in the next 30 minutes (ordering, asking directions, reading signage, small talk, paying, asking about hours). Vary the contexts across the nearby places where possible. Avoid duplicates and keep each phrase short and natural.

Output strict JSON of the form:
{ "phrases": [ { "word": "...", "translation": "...", "sentence": "...", "sentenceTranslation": "...", "context": "..." } ] }

The fields "translation" and "sentenceTranslation" must be written in ${body.instructionLanguage}. The "word" and "sentence" fields must be in ${body.language}. The "context" field should name the nearby place or situation the phrase suits (e.g. the POI name, or "ordering at a café").`;
}

function tryParsePhrases(content: string): Phrase[] | null {
	const trimmed = content.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
	let parsed: any;
	try {
		parsed = JSON.parse(trimmed);
	} catch {
		const match = trimmed.match(/\{[\s\S]*\}/);
		if (!match) return null;
		try {
			parsed = JSON.parse(match[0]);
		} catch {
			return null;
		}
	}
	const phrases = parsed?.phrases;
	if (!Array.isArray(phrases)) return null;
	const cleaned: Phrase[] = [];
	for (const p of phrases) {
		if (typeof p?.word === 'string' && typeof p?.translation === 'string') {
			cleaned.push({
				word: p.word,
				translation: p.translation,
				sentence: typeof p.sentence === 'string' ? p.sentence : '',
				sentenceTranslation:
					typeof p.sentenceTranslation === 'string' ? p.sentenceTranslation : '',
				context: typeof p.context === 'string' ? p.context : undefined
			});
		}
	}
	return cleaned.length ? cleaned : null;
}

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as RequestBody;

	if (!body.language || typeof body.language !== 'string') {
		throw error(400, 'Missing "language"');
	}

	const filled = {
		language: body.language,
		cefrLevel: body.cefrLevel || 'A2',
		placeName: body.placeName || 'an unspecified location',
		address: body.address || 'unknown address',
		pois: Array.isArray(body.pois) ? body.pois.slice(0, 15) : [],
		instructionLanguage: body.instructionLanguage || 'English',
		count: typeof body.count === 'number' ? Math.max(3, Math.min(20, body.count)) : 10
	};

	const prompt = buildPrompt(filled);

	let phrases: Phrase[] | null = null;
	let lastContent = '';

	for (const temperature of [0.5, 0.2]) {
		try {
			const { content } = await callLlm({
				prompt,
				system: SYSTEM_PROMPT,
				temperature
			});
			lastContent = content;
			phrases = tryParsePhrases(content);
			if (phrases) break;
		} catch (err) {
			if (err instanceof LlmError) {
				throw error(err.status, err.message);
			}
			throw err;
		}
	}

	if (!phrases) {
		throw error(502, `LLM returned malformed JSON: ${lastContent.slice(0, 200)}`);
	}

	return json({ phrases, generatedAt: Date.now() });
};
