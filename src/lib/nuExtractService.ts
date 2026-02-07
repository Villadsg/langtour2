// NuExtract service for structured information extraction
// Uses NuExtract-1.5 Gradio Space via server-side proxy

import type { ParsedTourData, ParsedStopData } from '$lib/firebase/types';

// Template for tour extraction
const TOUR_EXTRACTION_TEMPLATE = {
  "tour_name": "",
  "language_taught": "",
  "instruction_language": "",
  "difficulty_level": "",
  "description": "",
  "tour_type": "",
  "city": "",
  "stops": [
    {
      "place_name": "",
      "address": "",
      "place_type": "",
      "description": ""
    }
  ]
};

// Call the server-side proxy endpoint
async function callNuExtractAPI(text: string): Promise<string> {
  const response = await fetch('/api/extract-tour', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      template: TOUR_EXTRACTION_TEMPLATE
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Extraction API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  if (data.generated_text) {
    return data.generated_text;
  }

  throw new Error('Unexpected response format from extraction API');
}

// Parse the JSON output from NuExtract
function parseOutput(output: string): any {
  try {
    let jsonStr = output.trim();

    // Try direct parse first
    try {
      return JSON.parse(jsonStr);
    } catch {
      // Fall through to manual extraction
    }

    // Find the first complete JSON object
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

    console.error('No JSON object found in output:', output);
    return null;
  } catch (error) {
    console.error('Error parsing NuExtract output:', error);
    console.error('Raw output:', output);
    return null;
  }
}

// Map place type strings to valid types
function normalizePlaceType(type: string): string | undefined {
  if (!type) return undefined;

  const typeMap: Record<string, string> = {
    'cafe': 'cafe',
    'café': 'cafe',
    'coffee shop': 'cafe',
    'coffeeshop': 'cafe',
    'restaurant': 'restaurant',
    'museum': 'museum',
    'market': 'market',
    'landmark': 'landmark',
    'park': 'park',
    'shop': 'shop',
    'store': 'shop',
    'neighborhood': 'neighborhood',
    'district': 'neighborhood',
    'station': 'station',
    'square': 'square',
    'plaza': 'square',
  };

  const normalized = type.toLowerCase().trim();
  return typeMap[normalized] || (normalized.length > 0 ? 'other' : undefined);
}

// Main extraction function
export async function extractTourData(text: string): Promise<ParsedTourData> {
  try {
    const output = await callNuExtractAPI(text);
    const extracted = parseOutput(output);

    if (!extracted) {
      return {
        stops: [],
        rawText: text
      };
    }

    // Convert extracted data to ParsedTourData format
    const stops: ParsedStopData[] = [];

    if (extracted.stops && Array.isArray(extracted.stops)) {
      for (const stop of extracted.stops) {
        if (stop.place_name || stop.address) {
          stops.push({
            placeName: stop.place_name || '',
            addressOrDescription: stop.address || stop.description || '',
            placeType: normalizePlaceType(stop.place_type),
            geocodeStatus: 'pending'
          });
        }
      }
    }

    return {
      name: extracted.tour_name || undefined,
      languageTaught: normalizeLanguage(extracted.language_taught),
      instructionLanguage: normalizeLanguage(extracted.instruction_language),
      langDifficulty: normalizeDifficulty(extracted.difficulty_level),
      description: extracted.description || undefined,
      tourType: normalizeTourType(extracted.tour_type),
      cityName: extracted.city || undefined,
      stops,
      rawText: text
    };
  } catch (error) {
    console.error('Error extracting tour data:', error);
    throw error;
  }
}

// Normalize language names to match the app's expected values
function normalizeLanguage(lang: string): string | undefined {
  if (!lang) return undefined;

  const langMap: Record<string, string> = {
    'english': 'English',
    'spanish': 'Spanish',
    'german': 'German',
    'french': 'French',
    'italian': 'Italian',
    'danish': 'Danish',
  };

  const normalized = lang.toLowerCase().trim();
  return langMap[normalized] || (lang.charAt(0).toUpperCase() + lang.slice(1).toLowerCase());
}

// Normalize difficulty levels to CEFR
function normalizeDifficulty(difficulty: string): string | undefined {
  if (!difficulty) return undefined;

  const upper = difficulty.toUpperCase().trim();

  // Direct CEFR matches
  if (['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(upper)) {
    return upper;
  }

  // Map common terms
  const difficultyMap: Record<string, string> = {
    'beginner': 'A1',
    'elementary': 'A2',
    'pre-intermediate': 'A2',
    'intermediate': 'B1',
    'upper-intermediate': 'B2',
    'upper intermediate': 'B2',
    'advanced': 'C1',
    'proficient': 'C2',
    'native': 'C2',
  };

  return difficultyMap[difficulty.toLowerCase().trim()];
}

// Normalize tour type
function normalizeTourType(type: string): string | undefined {
  if (!type) return undefined;

  const lower = type.toLowerCase().trim();

  if (lower.includes('app') || lower.includes('self') || lower.includes('audio')) {
    return 'app';
  }
  if (lower.includes('person') || lower.includes('guide') || lower.includes('human')) {
    return 'person';
  }

  return undefined;
}
