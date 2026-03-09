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

    const extractUrl = `${WIKIPEDIA_API}?action=query&titles=${encodeURIComponent(title)}&prop=extracts&explaintext=true&exchars=3000&format=json&origin=*`;
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

// Phase 1: Generate facts (text + category only, no keywords)
function buildFactPrompt(
  placeName: string,
  city: string,
  languageTaught: string,
  instructionLanguage: string,
  cefrLevel: string,
  wikiExcerpt: string
): string {
  const context = wikiExcerpt
    ? `\nWikipedia excerpt about "${placeName}":\n${wikiExcerpt}\n`
    : '';

  const levelHint = cefrLevel
    ? `The reader is a ${cefrLevel} level ${languageTaught} learner (native ${instructionLanguage} speaker). Use ${cefrLevel}-appropriate ${languageTaught} grammar and vocabulary.`
    : `The reader is learning ${languageTaught} and speaks ${instructionLanguage} natively. Use simple, clear ${languageTaught}.`;

  return `Write 4 interesting facts about "${placeName}" in ${city}. Write in ${languageTaught}. 1-3 sentences each.
${levelHint}
${context}
Categories: cultural, historical, linguistic (about local language/naming), geographical (area/architecture).

Example for Spanish (B1 level):
{"facts":[{"text":"Este mercado ha sido el corazón de la cultura gastronómica local desde 1882.","category":"cultural"},{"text":"El edificio fue diseñado por el arquitecto Josep Mas en 1876.","category":"historical"},{"text":"El nombre proviene de la antigua palabra latina para reunión.","category":"linguistic"},{"text":"Situado en el casco antiguo, rodeado de estrechas calles medievales.","category":"geographical"}]}

Write facts about "${placeName}" in ${languageTaught}. Respond ONLY with JSON:`;
}

// Phase 2: Generate keywords for a single fact
function buildKeywordsPrompt(
  factText: string,
  languageTaught: string,
  instructionLanguage: string,
  cefrLevel: string
): string {
  const levelHint = cefrLevel
    ? `The learner is at ${cefrLevel} level. Choose words appropriate for that level.`
    : '';

  return `Given this ${languageTaught} fact: "${factText}"

List 4 key vocabulary words from the fact in ${languageTaught} with their ${instructionLanguage} translations.
${levelHint}

Example for Spanish to English:
{"keywords":[{"word":"mercado","translation":"market"},{"word":"comida","translation":"food"},{"word":"cultura","translation":"culture"},{"word":"antiguo","translation":"ancient"}]}

Now extract ${languageTaught} words with ${instructionLanguage} translations. Respond ONLY with JSON:`;
}

const VALID_CATEGORIES = ['cultural', 'historical', 'linguistic', 'geographical'];

function validateFacts(parsed: any): StopFact[] | null {
  if (!parsed?.facts || !Array.isArray(parsed.facts)) return null;
  const valid = parsed.facts
    .filter((f: any) => f.text && typeof f.text === 'string' && VALID_CATEGORIES.includes(f.category))
    .map((f: any) => ({
      text: f.text,
      category: f.category,
      keywords: Array.isArray(f.keywords)
        ? f.keywords.filter((k: any) => k.word && k.translation).map((k: any) => ({ word: k.word, translation: k.translation }))
        : []
    }));
  return valid.length > 0 ? valid : null;
}

function validateKeywords(parsed: any): { word: string; translation: string }[] {
  if (!parsed?.keywords || !Array.isArray(parsed.keywords)) return [];
  return parsed.keywords
    .filter((k: any) => k.word && k.translation)
    .map((k: any) => ({ word: k.word, translation: k.translation }));
}

export const POST: RequestHandler = async ({ request }) => {
  const { stops, languageTaught, instructionLanguage, cefrLevel, city } = await request.json();

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
          // Phase 1: Search Wikipedia
          send('progress', { stopId: stop.id, status: 'searching', stopIndex: i });
          const wikiExcerpt = await searchWikipedia(placeName, city);
          const hasWebContext = wikiExcerpt.length > 0;

          // Phase 2: Generate facts (text + category)
          send('progress', { stopId: stop.id, status: 'generating', stopIndex: i });
          const factPrompt = buildFactPrompt(placeName, city, languageTaught, instructionLanguage, cefrLevel || '', wikiExcerpt);
          const factRaw = await callOllama(OLLAMA_MODEL, factPrompt, 0.7);
          console.log(`[generate-facts] Stop "${placeName}" facts raw:`, factRaw.substring(0, 500));
          let factsParsed = extractJson(factRaw);
          let facts = validateFacts(factsParsed);

          // Retry once on parse failure
          if (!facts) {
            const retryRaw = await callOllama(OLLAMA_MODEL, factPrompt, 0.5);
            factsParsed = extractJson(retryRaw);
            facts = validateFacts(factsParsed);
          }

          if (!facts) {
            send('error', { stopId: stop.id, error: 'Failed to generate valid facts', stopIndex: i });
            continue;
          }

          // Phase 3: Generate keywords for each fact separately
          for (let j = 0; j < facts.length; j++) {
            const fact = facts[j];
            try {
              const kwPrompt = buildKeywordsPrompt(fact.text, languageTaught, instructionLanguage, cefrLevel || '');
              const kwRaw = await callOllama(OLLAMA_MODEL, kwPrompt, 0.7);
              console.log(`[generate-facts] Stop "${placeName}" fact ${j} keywords raw:`, kwRaw.substring(0, 300));
              const kwParsed = extractJson(kwRaw);
              const keywords = validateKeywords(kwParsed);

              if (keywords.length > 0) {
                facts[j] = { ...fact, keywords };
              } else {
                // Retry once
                const kwRetry = await callOllama(OLLAMA_MODEL, kwPrompt, 0.5);
                const kwRetryParsed = extractJson(kwRetry);
                const retryKeywords = validateKeywords(kwRetryParsed);
                if (retryKeywords.length > 0) {
                  facts[j] = { ...fact, keywords: retryKeywords };
                }
              }
            } catch (kwErr: any) {
              console.error(`[generate-facts] Keywords failed for fact ${j}:`, kwErr.message);
              // Continue without keywords for this fact
            }
          }

          console.log(`[generate-facts] Stop "${placeName}" final:`, JSON.stringify(facts).substring(0, 800));
          send('facts', { stopId: stop.id, facts, stopIndex: i, hadWebContext: hasWebContext });
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
