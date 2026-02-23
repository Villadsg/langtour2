import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { callOllama, extractJson } from '$lib/server/ollama';
import type { StopFact } from '$lib/firebase/types';

const OLLAMA_MODEL = 'qwen2.5:1.5b';
const WIKIPEDIA_API = 'https://en.wikipedia.org/w/api.php';

interface StopInput {
  id: string;
  placeName: string;
  placeType?: string;
}

async function searchWikipedia(placeName: string, city: string): Promise<string> {
  try {
    const query = `${placeName} ${city}`;
    const searchUrl = `${WIKIPEDIA_API}?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=1&format=json&origin=*`;
    const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(5000) });
    if (!searchRes.ok) return '';
    const searchData = await searchRes.json();
    const title = searchData?.query?.search?.[0]?.title;
    if (!title) return '';

    const extractUrl = `${WIKIPEDIA_API}?action=query&titles=${encodeURIComponent(title)}&prop=extracts&exintro=true&explaintext=true&exsentences=8&format=json&origin=*`;
    const extractRes = await fetch(extractUrl, { signal: AbortSignal.timeout(5000) });
    if (!extractRes.ok) return '';
    const extractData = await extractRes.json();
    const pages = extractData?.query?.pages;
    if (!pages) return '';
    const page = Object.values(pages)[0] as any;
    return page?.extract || '';
  } catch {
    return '';
  }
}

function buildFactPrompt(
  placeName: string,
  city: string,
  languageTaught: string,
  instructionLanguage: string,
  wikiExcerpt: string
): string {
  const context = wikiExcerpt
    ? `\nWikipedia excerpt about "${placeName}":\n${wikiExcerpt}\n`
    : '';

  return `You are a tour guide creating short, interesting facts for a language-learning walking tour.
Location: "${placeName}" in ${city}
Language being taught: ${languageTaught}
Instruction language: ${instructionLanguage}
${context}
Generate exactly 2 facts about this location:
- 1 cultural fact (category: "cultural")
- 1 historical fact (category: "historical")

IMPORTANT:
- Write each fact in ${languageTaught} (the language being learned), 1-3 sentences max.
- For each fact, list 3-5 key words from the fact with their ${instructionLanguage} translations.

Respond ONLY with valid JSON in this exact format:
{"facts": [{"text": "...", "category": "cultural", "keywords": [{"word": "...", "translation": "..."}]}, {"text": "...", "category": "historical", "keywords": [{"word": "...", "translation": "..."}]}]}`;
}

function validateFacts(parsed: any): StopFact[] | null {
  if (!parsed?.facts || !Array.isArray(parsed.facts)) return null;
  const valid = parsed.facts
    .filter((f: any) => f.text && typeof f.text === 'string' && ['cultural', 'historical'].includes(f.category))
    .map((f: any) => ({
      text: f.text,
      category: f.category,
      keywords: Array.isArray(f.keywords)
        ? f.keywords.filter((k: any) => k.word && k.translation).map((k: any) => ({ word: k.word, translation: k.translation }))
        : []
    }));
  return valid.length > 0 ? valid : null;
}

export const POST: RequestHandler = async ({ request }) => {
  const { stops, languageTaught, instructionLanguage, city } = await request.json();

  if (!stops || !Array.isArray(stops) || stops.length === 0) {
    throw error(400, 'Missing or empty stops array');
  }

  // Check Ollama is reachable
  try {
    await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(3000) });
  } catch {
    throw error(503, 'Ollama is not running. Start it with: ollama serve');
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: any) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      }

      for (let i = 0; i < stops.length; i++) {
        const stop: StopInput = stops[i];
        const placeName = stop.placeName || `Stop ${i + 1}`;

        try {
          // Search phase
          send('progress', { stopId: stop.id, status: 'searching', stopIndex: i });
          const wikiExcerpt = await searchWikipedia(placeName, city);
          const hasWebContext = wikiExcerpt.length > 0;

          // Generate phase
          send('progress', { stopId: stop.id, status: 'generating', stopIndex: i });
          const prompt = buildFactPrompt(placeName, city, languageTaught, instructionLanguage, wikiExcerpt);
          const raw = await callOllama(OLLAMA_MODEL, prompt, 0.7);
          let parsed = extractJson(raw);
          let facts = validateFacts(parsed);

          // Retry once on parse failure
          if (!facts) {
            const retryRaw = await callOllama(OLLAMA_MODEL, prompt, 0.5);
            parsed = extractJson(retryRaw);
            facts = validateFacts(parsed);
          }

          if (facts) {
            send('facts', { stopId: stop.id, facts, stopIndex: i, hadWebContext: hasWebContext });
          } else {
            send('error', { stopId: stop.id, error: 'Failed to generate valid facts', stopIndex: i });
          }
        } catch (err: any) {
          send('error', { stopId: stop.id, error: err.message || 'Unknown error', stopIndex: i });
        }
      }

      send('done', {});
      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
};
