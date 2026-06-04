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
	chain?: { sentence: string; translation: string }[];
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

	// Agentic enrichment: the LLM server can search the web (SearXNG), so ask it
	// to ground the phrases in what's actually happening nearby right now. Only
	// worth it with a real place to search; "weave in if relevant, else ignore"
	// keeps a thin or irrelevant result from derailing the generation.
	const placeForSearch = [b.placeName, b.city, b.country].filter(Boolean).join(', ');
	const searchLine =
		b.city || b.country
			? `First, search the web for recent news and current or upcoming events near ${placeForSearch} — festivals, exhibitions, markets, sports, closures or works, anything notable happening now. Weave in only what is genuinely recent and relevant so the phrases reflect what is actually going on there; if nothing useful turns up, rely on the setting above.`
			: '';

	// Hypothesis-mode: each generated phrase is something the user might
	// plausibly say/think under a different guess about what they're doing.
	// Picks are evidence; the chain narrows our guess over time. Local context
	// (weather + the live search above) supplies the prior.
	const taskLine = b.chain.length
		? `We are guessing what the user is doing. Their picks so far (oldest → newest):
${b.chain.map((c, i) => `  ${i + 1}. "${c.sentence}" — ${c.translation}`).join('\n')}

Generate ${b.count} phrases in ${b.language} at CEFR level ${b.cefrLevel}. Each phrase is something the user might say or think *now* under a different hypothesis about their situation. Make the ${b.count} hypotheses meaningfully distinct and consistent with the picks above.`
		: `Generate ${b.count} phrases in ${b.language} at CEFR level ${b.cefrLevel} that the user could use near the location. Each phrase should reflect a different plausible guess about what they're doing right now, given the setting.`;

	const locationLine = `The user is at "${b.placeName}" (${b.address}).${settingLine ? `\n${settingLine}` : ''}`;

	// Search/task come first; the strict-JSON contract stays last and loud so the
	// search step can't tempt the model into prose or commentary in the output.
	const outputLine = `Reply with ONE minified JSON object, nothing else — no search results, notes, or prose. Put all ${b.count} phrases in the array "p". Each phrase has just two fields: "s" (the ${b.language} phrase) and "t" (its ${b.instructionLanguage} translation):
{"p":[{"s":"<${b.language} phrase>","t":"<${b.instructionLanguage} translation>"}]}
Example: {"p":[{"s":"¿Dónde está la salida?","t":"Where is the exit?"},{"s":"¿Me puede ayudar?","t":"Can you help me?"}]}`;

	return [locationLine, searchLine, taskLine, outputLine].filter(Boolean).join('\n\n');
}

// Splits a sentence into display tokens on whitespace, punctuation kept
// attached to its word. The per-word glosses are no longer asked of the LLM
// (too error-prone for the current small model) — they're fetched lazily by the
// client via /api/word-gloss, so each token ships with an empty meaning.
function tokenize(sentence: string): PhraseWord[] {
	return sentence
		.trim()
		.split(/\s+/)
		.filter(Boolean)
		.map((word) => ({ word, meaning: '' }));
}

// Expected shape: {"p":[{"s","t"}]}. Tolerant of the verbose {sentence,...}
// shape too. Words are derived from "s" here, not taken from the model.
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
	return { sentence, sentenceTranslation, words: tokenize(sentence) };
}

// Pull phrases out of one parsed value, whether it's the {"p":[…]} wrapper,
// the verbose {"phrases":[…]} shape, a bare phrase array, or a lone phrase.
function phrasesFromParsed(parsed: any): Phrase[] {
	const arr = Array.isArray(parsed?.p)
		? parsed.p
		: Array.isArray(parsed?.phrases)
			? parsed.phrases
			: Array.isArray(parsed)
				? parsed
				: [parsed];
	const out: Phrase[] = [];
	for (const p of arr) {
		const ph = normalizeRawPhrase(p);
		if (ph) out.push(ph);
	}
	return out;
}

// Finds each phrase object — a {…} whose first key is "s" — anywhere in the
// string, by string-aware brace matching from its opening brace. Works at the
// granularity of one phrase, so stray braces, a malformed wrapper, repeated
// wrappers, or one corrupt phrase cost at most that phrase, not the whole batch.
// Each result carries `end` (index of its closing brace) so a streamer can tell
// which objects are newly complete. Returns ordered by position.
function scanPhraseObjects(s: string): { end: number; phrase: Phrase }[] {
	const out: { end: number; phrase: Phrase }[] = [];
	for (let i = 0; i < s.length; i++) {
		if (s[i] !== '{') continue;
		let j = i + 1;
		while (j < s.length && (s[j] === ' ' || s[j] === '\n' || s[j] === '\t' || s[j] === '\r')) j++;
		// Only treat this brace as a phrase start if its first key is "s".
		if (s[j] !== '"' || s[j + 1] !== 's' || s[j + 2] !== '"') continue;
		let depth = 0;
		let inStr = false;
		let esc = false;
		let end = -1;
		for (let k = i; k < s.length; k++) {
			const c = s[k];
			if (inStr) {
				if (esc) esc = false;
				else if (c === '\\') esc = true;
				else if (c === '"') inStr = false;
				continue;
			}
			if (c === '"') inStr = true;
			else if (c === '{') depth++;
			else if (c === '}' && --depth === 0) {
				end = k;
				break;
			}
		}
		if (end === -1) break; // object still being streamed — stop, retry next push
		try {
			const ph = normalizeRawPhrase(JSON.parse(s.slice(i, end + 1)));
			if (ph) out.push({ end, phrase: ph });
		} catch {
			/* corrupt single phrase — skip it, keep the rest */
		}
		i = end;
	}
	return out;
}

function tryParsePhrases(content: string): Phrase[] | null {
	const trimmed = content.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
	// Per-phrase scan: ignores wrapper structure, so it survives stray braces,
	// repeated/duplicate "p" keys, and one corrupt phrase among good ones.
	const viaScan = scanPhraseObjects(trimmed).map((r) => r.phrase);
	// Whole-document parse: cleanest when the model gets the shape exactly right.
	// But duplicate "p" keys make JSON.parse keep only the last (1 phrase), so we
	// never let it shrink the result below what the scan recovered.
	let viaParse: Phrase[] = [];
	try {
		viaParse = phrasesFromParsed(JSON.parse(trimmed));
	} catch {
		/* not valid as a whole — rely on the scan */
	}
	const best = viaScan.length > viaParse.length ? viaScan : viaParse;
	return best.length ? best : null;
}

/**
 * Emits complete phrase objects out of a growing minified-JSON buffer as each
 * one finishes, by re-scanning the buffer (scanPhraseObjects) and returning
 * only objects that have completed since the last push. Independent of wrapper
 * structure, so it survives the same malformations tryParsePhrases() recovers.
 */
class PhraseStream {
	private buf = '';
	private emittedEnd = -1;

	push(chunk: string): Phrase[] {
		this.buf += chunk;
		const out: Phrase[] = [];
		for (const { end, phrase } of scanPhraseObjects(this.buf)) {
			if (end > this.emittedEnd) {
				out.push(phrase);
				this.emittedEnd = end;
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
		chain: Array.isArray(body.chain)
			? body.chain
					.filter(
						(c): c is { sentence: string; translation: string } =>
							!!c && typeof c.sentence === 'string' && typeof c.translation === 'string'
					)
					.slice(-10)
			: []
	};

	const prompt = buildPrompt(filled);

	// Hand location to the LLM-server enrichment proxy out-of-band so it can
	// inject recent local news without us mutating the strict-JSON prompt.
	// Every round benefits: the prior over "what is the user doing" is
	// shaped by local context, not just the initial generation. Percent-encoded:
	// header values are ASCII only, but city/country routinely aren't.
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
		console.log('\n────── /api/quick-phrases ──────');
		console.log(prompt);
		console.log('────────────────────────────────\n');
	}

	// Just {"s","t"} per phrase now (no per-word array) — ~30-60 tok/phrase. Cap
	// with headroom so a pathological run is bounded but a normal one never truncates.
	const maxTokens = Math.min(2000, 128 + filled.count * 90);
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
					{
					prompt,
					// Low temperature: this is structured-JSON generation, not creative
					// writing. Higher values make a small model sample stray tokens that
					// corrupt the JSON (unclosed arrays, a "]" leaking into a string).
					temperature: 0.3,
					maxTokens,
					extraHeaders
				},
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
					// Search verification: the prompt we sent is ~chars/4 tokens. If the
					// model ran a web search, the server feeds results back into context,
					// so the reported prompt_tokens balloons well past what we sent. A big
					// gap ⇒ search almost certainly fired; roughly equal ⇒ it did not.
					const sentApprox = Math.round(prompt.length / 4);
					const searchHint =
						pt === undefined
							? ''
							: pt > sentApprox * 1.5 && pt - sentApprox > 200
								? ` | 🔍 prompt ${pt} ≫ sent ~${sentApprox} → search likely USED`
								: ` | prompt ${pt} ≈ sent ~${sentApprox} → search likely NOT used`;
					if (!phrases) {
						console.log(
							`[quick-phrases] malformed JSON | llm ${meta.ms}ms` +
								(ct !== undefined ? ` | completion ${ct} tok (cap ${maxTokens})` : '') +
								searchHint +
								` | ${buf.length}c — truncated=${ct !== undefined && ct >= maxTokens}\n` +
								buf.slice(0, 800)
						);
					} else {
						console.log(
							`[quick-phrases] ✓ ${phrases.length} phrases (${emitted} streamed) | llm ${meta.ms}ms` +
								searchHint +
								(ct !== undefined ? ` | completion ${ct} tok` : '') +
								(tps !== undefined ? ` | ${tps} tok/s` : '') +
								(filled.chain.length ? ` | chain=${filled.chain.length}` : ' | mode=initial')
						);
						// Final count below what we streamed means the model's wrapper
						// drifted (e.g. duplicate "p" keys) — dump the buffer to see how.
						if (phrases.length < emitted) {
							console.log(`[quick-phrases] final < streamed — raw buffer:\n${buf.slice(0, 800)}`);
						}
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
