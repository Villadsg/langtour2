import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const OLLAMA_URL = 'http://localhost:11434/api/generate';
const NUEXTRACT_MODEL = 'iodose/nuextract-v1.5';
const FALLBACK_MODEL = 'qwen2.5:1.5b';

async function callOllama(model: string, prompt: string, temperature: number): Promise<string> {
  const response = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: { temperature }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Ollama error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return data.response ?? '';
}

function extractJson(output: string): any {
  try {
    let jsonStr = output.trim();

    try {
      return JSON.parse(jsonStr);
    } catch {
      // Fall through to brace-counting
    }

    let braceCount = 0;
    let jsonStart = -1;
    let jsonEnd = 0;
    let inString = false;
    let escapeNext = false;

    for (let i = 0; i < jsonStr.length; i++) {
      const char = jsonStr[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      if (char === '\\') {
        escapeNext = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (char === '{') {
          if (jsonStart === -1) jsonStart = i;
          braceCount++;
        }
        if (char === '}') {
          braceCount--;
          if (braceCount === 0) {
            jsonEnd = i + 1;
            break;
          }
        }
      }
    }

    if (jsonStart >= 0 && jsonEnd > 0) {
      return JSON.parse(jsonStr.substring(jsonStart, jsonEnd));
    }

    return null;
  } catch {
    return null;
  }
}

function buildNamePrompt(text: string, extracted: any): string {
  const truncated = text.slice(0, 500);
  let context = '';
  if (extracted.city) context += `City: ${extracted.city}. `;
  if (extracted.language_taught) context += `Language: ${extracted.language_taught}. `;
  if (extracted.stops?.length) {
    const names = extracted.stops.map((s: any) => s.place_name).filter(Boolean).join(', ');
    if (names) context += `Stops: ${names}. `;
  }

  return `Create a short, catchy tour name (max 8 words) based on this tour description. ${context}Reply with ONLY the tour name, no quotes, no explanation.

Text: ${truncated}`;
}

function buildDescriptionPrompt(text: string, extracted: any): string {
  const truncated = text.slice(0, 500);
  let context = '';
  if (extracted.city) context += `City: ${extracted.city}. `;
  if (extracted.language_taught) context += `Language: ${extracted.language_taught}. `;
  if (extracted.stops?.length) {
    const names = extracted.stops.map((s: any) => s.place_name).filter(Boolean).join(', ');
    if (names) context += `Stops: ${names}. `;
  }

  return `Write a 1-2 sentence description for a language-learning walking tour based on this text. ${context}Reply with ONLY the description, no quotes, no explanation.

Text: ${truncated}`;
}

function stripQuotes(s: string): string {
  const trimmed = s.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

export const POST: RequestHandler = async ({ request }) => {
  const { text, template } = await request.json();

  if (!text || !template) {
    throw error(400, 'Missing text or template');
  }

  const templateStr = typeof template === 'string' ? template : JSON.stringify(template, null, 4);

  try {
    // Step 1: Call NuExtract
    const nuextractPrompt = `<|input|>\n### Template:\n${templateStr}\n### Text:\n${text}\n\n<|output|>`;
    const rawOutput = await callOllama(NUEXTRACT_MODEL, nuextractPrompt, 0);
    const extracted = extractJson(rawOutput) ?? {};

    // Step 2: Check for missing tour_name / description and fill via fallback
    const needsName = !extracted.tour_name;
    const needsDescription = !extracted.description;

    if (needsName || needsDescription) {
      const fallbackPromises: Promise<void>[] = [];

      if (needsName) {
        fallbackPromises.push(
          callOllama(FALLBACK_MODEL, buildNamePrompt(text, extracted), 0.7)
            .then(result => { extracted.tour_name = stripQuotes(result); })
            .catch(err => { console.error('Fallback name generation failed:', err); })
        );
      }

      if (needsDescription) {
        fallbackPromises.push(
          callOllama(FALLBACK_MODEL, buildDescriptionPrompt(text, extracted), 0.7)
            .then(result => { extracted.description = stripQuotes(result); })
            .catch(err => { console.error('Fallback description generation failed:', err); })
        );
      }

      await Promise.all(fallbackPromises);
    }

    return json({ generated_text: JSON.stringify(extracted) });
  } catch (err: any) {
    if (err?.status) throw err;
    console.error('Ollama API error:', err);
    if (err?.cause?.code === 'ECONNREFUSED') {
      throw error(503, 'Ollama is not running. Start it with: ollama serve');
    }
    throw error(500, err?.message || 'Failed to call Ollama');
  }
};
