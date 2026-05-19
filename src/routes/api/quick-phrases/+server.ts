import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dev } from '$app/environment';
import { callLlmStream, LlmError, type CallLlmStreamMeta } from '$lib/server/llm';

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
	count?: number;
	focusSentence?: string;
	focusTranslation?: string;
}

interface PhraseWord {
	word: string;
	meaning: string;
}

interface Phrase {
	sentence: string;
	sentenceTranslation: string;
	words: PhraseWord[];
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
	weather?: Weather | null;
	instructionLanguage: string;
	count: number;
	focusSentence?: string;
	focusTranslation?: string;
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

	const focus = b.focusSentence?.trim();
	const taskLine = focus
		? `Generate ${b.count} phrases in ${b.language} at CEFR level ${b.cefrLevel} that stay on the exact same topic and situation as this phrase the learner just picked: "${focus}"${
				b.focusTranslation?.trim() ? ` (meaning: "${b.focusTranslation.trim()}")` : ''
			}. Keep that subject; vary the wording, vocabulary and sub-scenarios but do not drift to other situations. Stay consistent with the time of day and weather. Avoid duplicates and do not repeat the picked phrase verbatim.`
		: `Generate ${b.count} phrases in ${b.language} at CEFR level ${b.cefrLevel} that the learner could use near the location in the next 30 minutes. Pick sentences that match the time of day and weather. Vary the situations; avoid duplicates.`;

	return `The learner is at "${b.placeName}" (${b.address}).
${settingLine}

${taskLine}

Output ONLY minified JSON — no markdown, no code fences, no newlines, no extra spaces — of exactly this shape:
{"p":[{"s":"...","t":"...","w":[{"x":"...","g":"..."}]}]}

- "s" is the phrase in ${b.language}.
- "t" is "s" translated into ${b.instructionLanguage}.
- "w" splits "s" into its tokens in original order. Each token is an object {"x":"surface","g":"gloss"}: "x" is the exact word form as it appears in "s" (keep punctuation attached to its adjacent word); "g" is that single word's short translation into ${b.instructionLanguage} (use "" for pure punctuation).`;
}

// Compact shape: {"p":[{"s","t","w":[{"x","g"}]}]}.
// Tolerant of the older verbose shape and tuple words in case the model drifts.
function normalizeRawPhrase(p: any): Phrase | null {
	const sentence =
		typeof p?.s === 'string' ? p.s : typeof p?.sentence === 'string' ? p.sentence : '';
	if (!sentence) return null;
	const sentenceTranslation =
		typeof p?.t === 'string'
			? p.t
			: typeof p?.sentenceTranslation === 'string'
				? p.sentenceTranslation
				: '';
	const rawWords = Array.isArray(p?.w) ? p.w : Array.isArray(p?.words) ? p.words : [];
	const words: PhraseWord[] = rawWords
		.map((w: any): PhraseWord | null => {
			if (Array.isArray(w)) {
				const word = typeof w[0] === 'string' ? w[0] : '';
				if (!word) return null;
				return { word, meaning: typeof w[1] === 'string' ? w[1] : '' };
			}
			const word = typeof w?.x === 'string' ? w.x : typeof w?.word === 'string' ? w.word : '';
			if (!word) return null;
			const meaning =
				typeof w?.g === 'string' ? w.g : typeof w?.meaning === 'string' ? w.meaning : '';
			return { word, meaning };
		})
		.filter((w: PhraseWord | null): w is PhraseWord => w !== null);
	return { sentence, sentenceTranslation, words };
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
	const arr = Array.isArray(parsed?.p)
		? parsed.p
		: Array.isArray(parsed?.phrases)
			? parsed.phrases
			: null;
	if (!arr) return null;
	const cleaned: Phrase[] = [];
	for (const p of arr) {
		const ph = normalizeRawPhrase(p);
		if (ph) cleaned.push(ph);
	}
	return cleaned.length ? cleaned : null;
}

/**
 * Pulls complete phrase objects out of a growing minified-JSON buffer so they
 * can be streamed to the client as each one finishes. String-aware brace
 * matching scoped to the first array (`"p":[…]`); whatever this misses, the
 * authoritative tryParsePhrases() over the full buffer recovers at the end.
 */
class PhraseStream {
	private buf = '';
	private i = 0;
	private arrayOpen = false;
	private depth = 0;
	private inStr = false;
	private esc = false;
	private objStart = -1;

	push(chunk: string): Phrase[] {
		this.buf += chunk;
		const s = this.buf;
		const out: Phrase[] = [];
		for (; this.i < s.length; this.i++) {
			const c = s[this.i];
			if (!this.arrayOpen) {
				if (c === '[') this.arrayOpen = true;
				continue;
			}
			if (this.inStr) {
				if (this.esc) this.esc = false;
				else if (c === '\\') this.esc = true;
				else if (c === '"') this.inStr = false;
				continue;
			}
			if (c === '"') {
				this.inStr = true;
			} else if (c === '{') {
				if (this.depth === 0) this.objStart = this.i;
				this.depth++;
			} else if (c === '}') {
				this.depth--;
				if (this.depth === 0 && this.objStart !== -1) {
					const slice = s.slice(this.objStart, this.i + 1);
					this.objStart = -1;
					try {
						const ph = normalizeRawPhrase(JSON.parse(slice));
						if (ph) out.push(ph);
					} catch {
						/* partial/garbled — final parse recovers it */
					}
				}
			} else if (c === ']' && this.depth === 0) {
				break;
			}
		}
		return out;
	}
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
		weather: body.weather || null,
		instructionLanguage: body.instructionLanguage || 'English',
		count: typeof body.count === 'number' ? Math.max(3, Math.min(20, body.count)) : 4,
		focusSentence: typeof body.focusSentence === 'string' ? body.focusSentence : undefined,
		focusTranslation:
			typeof body.focusTranslation === 'string' ? body.focusTranslation : undefined
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

	// Compact minified output runs ~120-180 tok/phrase; cap with headroom so a
	// pathological run is bounded but a normal one is never truncated.
	const maxTokens = Math.min(3000, 256 + filled.count * 200);
	const encoder = new TextEncoder();

	const stream = new ReadableStream({
		async start(controller) {
			const send = (event: string, data: unknown) =>
				controller.enqueue(
					encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
				);

			const extractor = new PhraseStream();
			const meta: Partial<CallLlmStreamMeta> = {};
			let buf = '';
			let emitted = 0;

			try {
				for await (const delta of callLlmStream(
					{ prompt, system: SYSTEM_PROMPT, temperature: 0.3, maxTokens },
					meta
				)) {
					buf += delta;
					for (const phrase of extractor.push(delta)) {
						emitted++;
						send('phrase', { phrase });
					}
				}

				// Authoritative pass over the full buffer — fixes anything the
				// incremental extractor missed and is what the client persists.
				const phrases = tryParsePhrases(buf);

				if (dev) {
					const ct = meta.usage?.completion_tokens;
					const pt = meta.usage?.prompt_tokens;
					const tps = ct && meta.ms ? Math.round((ct / meta.ms) * 1000) : undefined;
					if (!phrases) {
						console.log(
							`[quick-phrases] malformed JSON | llm ${meta.ms}ms` +
								(ct !== undefined ? ` | completion ${ct} tok (cap ${maxTokens})` : '') +
								` | ${buf.length}c — truncated=${ct !== undefined && ct >= maxTokens}\n` +
								buf.slice(0, 800)
						);
					} else {
						console.log(
							`[quick-phrases] ✓ ${phrases.length} phrases (${emitted} streamed) | llm ${meta.ms}ms` +
								(pt !== undefined ? ` | prompt ${pt} tok` : '') +
								(ct !== undefined ? ` | completion ${ct} tok` : '') +
								(tps !== undefined ? ` | ${tps} tok/s` : '') +
								(filled.focusSentence ? ' | mode=topic' : ' | mode=initial')
						);
					}
				}

				if (!phrases) {
					send('error', { message: 'The phrase generator returned an unreadable response.' });
				} else {
					send('done', { phrases, generatedAt: Date.now() });
				}
			} catch (err) {
				const message =
					err instanceof LlmError
						? err.message
						: 'The phrase generator is temporarily unavailable.';
				if (dev) console.log(`[quick-phrases] stream error: ${message}`);
				send('error', { message });
			} finally {
				controller.close();
			}
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		}
	});
};
