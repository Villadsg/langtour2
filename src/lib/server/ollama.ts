const OLLAMA_URL = 'http://localhost:11434/api/generate';

export async function callOllama(model: string, prompt: string, temperature: number): Promise<string> {
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

export function extractJson(output: string): any {
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
