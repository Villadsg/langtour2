import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dev } from '$app/environment';
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
	city?: string;
	country?: string;
	timeBucket?: string;
	localTime?: string;
	pois?: NearbyPoi[];
	instructionLanguage?: string;
	count?: number;
}

interface Phrase {
	sentence: string;
	sentenceTranslation: string;
}

const SYSTEM_PROMPT =
	'You produce practical phrases tied to a learner\'s immediate physical surroundings. Always reply with valid JSON only';

function buildPrompt(b: {
	language: string;
	cefrLevel: string;
	placeName: string;
	address: string;
	city?: string;
	country?: string;
	timeBucket?: string;
	localTime?: string;
	pois: NearbyPoi[];
	instructionLanguage: string;
	count: number;
}): string {
	const settingBits: string[] = [];
	if (b.city) settingBits.push(b.city);
	if (b.country) settingBits.push(b.country);
	if (b.localTime) settingBits.push(`local time ${b.localTime}`);
	if (b.timeBucket) settingBits.push(b.timeBucket);
	const settingLine = settingBits.length ? `Setting: ${settingBits.join(', ')}.` : '';

	const poiList = b.pois.length
		? b.pois.map((p) => `- ${p.name} (${p.category}, ~${p.distanceM}m)`).join('\n')
		: '- (no specific POIs nearby; rely on the address and infer typical surroundings)';

	return `The learner is at "${b.placeName}" (${b.address}).
${settingLine}
Nearby places:
${poiList}

Generate ${b.count} phrases in ${b.language} at CEFR level ${b.cefrLevel} that the learner could use near the location in the next 30 minutes. Pick sentences that match the time of day. Vary the situations; avoid duplicates.

Output strict JSON of the form:
{ "phrases": [ { "sentence": "...", "sentenceTranslation": "..." } ] }

- "sentence" is the phrase in ${b.language}.
- "sentenceTranslation" is the same sentence translated into ${b.instructionLanguage}.`;
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
		const sentence = typeof p?.sentence === 'string' ? p.sentence : '';
		if (!sentence) continue;
		cleaned.push({
			sentence,
			sentenceTranslation:
				typeof p.sentenceTranslation === 'string' ? p.sentenceTranslation : ''
		});
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
		city: body.city,
		country: body.country,
		timeBucket: body.timeBucket,
		localTime: body.localTime,
		pois: Array.isArray(body.pois) ? body.pois.slice(0, 8) : [],
		instructionLanguage: body.instructionLanguage || 'English',
		count: typeof body.count === 'number' ? Math.max(3, Math.min(20, body.count)) : 10
	};

	const prompt = buildPrompt(filled);

	if (dev) {
		console.log('\n────── /api/quick-phrases ──────');
		console.log('[system]');
		console.log(SYSTEM_PROMPT);
		console.log('\n[user]');
		console.log(prompt);
		console.log('────────────────────────────────\n');
	}

	const t0 = Date.now();
	let content = '';
	try {
		const res = await callLlm({ prompt, system: SYSTEM_PROMPT, temperature: 0.3 });
		content = res.content;
	} catch (err) {
		if (err instanceof LlmError) {
			throw error(err.status, err.message);
		}
		throw err;
	}

	const phrases = tryParsePhrases(content);
	if (!phrases) {
		if (dev) console.log(`[quick-phrases] malformed JSON in ${Date.now() - t0}ms:\n${content.slice(0, 400)}`);
		throw error(502, `LLM returned malformed JSON: ${content.slice(0, 200)}`);
	}

	if (dev) {
		console.log(`[quick-phrases] ✓ ${phrases.length} phrases in ${Date.now() - t0}ms`);
	}

	return json({ phrases, generatedAt: Date.now() });
};
