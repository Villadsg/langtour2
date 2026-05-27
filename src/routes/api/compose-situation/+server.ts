import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dev } from '$app/environment';
import { callLlm, LlmError } from '$lib/server/llm';

interface Weather {
	description: string;
	temperatureC: number;
	apparentC: number;
	precipitationMm: number;
	isDay: boolean;
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
	weather?: Weather | null;
	instructionLanguage?: string;
	chain?: { sentence: string; translation: string }[];
}

interface Situation {
	reading: string;
	readingTranslation: string;
	suggestions: string[];
	suggestionsTranslation: string[];
}

function buildPrompt(b: {
	language: string;
	cefrLevel: string;
	placeName: string;
	address: string;
	city?: string;
	country?: string;
	timeBucket?: string;
	localTime?: string;
	weather?: Weather | null;
	instructionLanguage: string;
	chain: { sentence: string; translation: string }[];
}): string {
	const settingBits: string[] = [];
	if (b.city) settingBits.push(b.city);
	if (b.country) settingBits.push(b.country);
	if (b.localTime) settingBits.push(`local time ${b.localTime}`);
	if (b.timeBucket) settingBits.push(b.timeBucket);
	if (b.weather)
		settingBits.push(
			`${b.weather.description}, ${b.weather.temperatureC}°C` +
				(Math.abs(b.weather.apparentC - b.weather.temperatureC) >= 3
					? ` (feels like ${b.weather.apparentC}°C)`
					: '') +
				(b.weather.precipitationMm > 0 ? `, ${b.weather.precipitationMm}mm precipitation` : '')
		);
	const settingLine = settingBits.length ? `Setting: ${settingBits.join(', ')}.` : '';

	const chainLines = b.chain
		.map((c, i) => `  ${i + 1}. "${c.sentence}" — ${c.translation}`)
		.join('\n');

	return `The user is at "${b.placeName}" (${b.address}).
${settingLine}

Picks (evidence about their situation, in order):
${chainLines}

In ${b.language} at CEFR ${b.cefrLevel}, write:
  1. A short paragraph (~3-4 sentences) describing what the user is most likely doing right now and the mood/intent behind it. Be specific.
  2. 2-3 concrete suggestions for enjoying the moment more, grounded in the local context (weather, time of day, nearby events). Each suggestion should be something they could realistically act on in the next hour.

Provide ${b.instructionLanguage} translations of both.

Output ONLY minified JSON of exactly this shape:
{"reading":"...","readingTranslation":"...","suggestions":["...","..."],"suggestionsTranslation":["...","..."]}`;
}

function tryParse(content: string): Situation | null {
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
	const reading = typeof parsed?.reading === 'string' ? parsed.reading : '';
	const readingTranslation =
		typeof parsed?.readingTranslation === 'string' ? parsed.readingTranslation : '';
	const suggestions = Array.isArray(parsed?.suggestions)
		? parsed.suggestions.filter((s: unknown): s is string => typeof s === 'string')
		: [];
	const suggestionsTranslation = Array.isArray(parsed?.suggestionsTranslation)
		? parsed.suggestionsTranslation.filter((s: unknown): s is string => typeof s === 'string')
		: [];
	if (!reading || !suggestions.length) return null;
	return { reading, readingTranslation, suggestions, suggestionsTranslation };
}

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as RequestBody;

	if (!body.language || typeof body.language !== 'string') {
		throw error(400, 'Missing "language"');
	}
	const chain = Array.isArray(body.chain)
		? body.chain
				.filter(
					(c): c is { sentence: string; translation: string } =>
						!!c && typeof c.sentence === 'string' && typeof c.translation === 'string'
				)
				.slice(-10)
		: [];
	if (!chain.length) {
		throw error(400, 'Chain is empty — need at least one pick to read a situation.');
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
		weather: body.weather || null,
		instructionLanguage: body.instructionLanguage || 'English',
		chain
	};

	const prompt = buildPrompt(filled);

	const enrichLocation = filled.city || filled.country;
	const extraHeaders = enrichLocation
		? {
				'X-Enrich': 'news',
				...(filled.city ? { 'X-Location-City': encodeURIComponent(filled.city) } : {}),
				...(filled.country
					? { 'X-Location-Country': encodeURIComponent(filled.country) }
					: {})
			}
		: undefined;

	if (dev) {
		console.log('\n────── /api/compose-situation ──────');
		console.log(prompt);
		console.log('────────────────────────────────────\n');
	}

	try {
		const result = await callLlm({
			prompt,
			temperature: 0.6,
			maxTokens: 800,
			extraHeaders
		});
		const situation = tryParse(result.content);
		if (dev) {
			const ct = result.usage?.completion_tokens;
			if (!situation) {
				console.log(
					`[compose-situation] malformed JSON | llm ${result.ms}ms${
						ct !== undefined ? ` | completion ${ct} tok` : ''
					}\n${result.content.slice(0, 800)}`
				);
			} else {
				console.log(
					`[compose-situation] ✓ ${situation.suggestions.length} suggestions | llm ${result.ms}ms${
						ct !== undefined ? ` | completion ${ct} tok` : ''
					} | chain=${chain.length}`
				);
			}
		}
		if (!situation) {
			throw error(502, 'The situation reader returned an unreadable response.');
		}
		return json({ situation, generatedAt: Date.now() });
	} catch (err) {
		if (err instanceof LlmError) {
			throw error(err.status >= 400 && err.status < 600 ? err.status : 502, err.message);
		}
		throw err;
	}
};
