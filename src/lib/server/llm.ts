import { env } from '$env/dynamic/private';

const DEFAULT_URL = 'http://localhost:8080/v1/chat/completions';

export interface CallLlmOptions {
	prompt: string;
	system?: string;
	temperature?: number;
	timeoutMs?: number;
	/** Append " /no_think" to the user prompt to suppress Qwen's reasoning preamble. Default: true. */
	noThink?: boolean;
}

export interface CallLlmResult {
	content: string;
}

export class LlmError extends Error {
	constructor(public readonly status: number, message: string) {
		super(message);
		this.name = 'LlmError';
	}
}

const DEFAULT_TIMEOUT_MS = 600000;

export async function callLlm({
	prompt,
	system,
	temperature,
	timeoutMs,
	noThink = true
}: CallLlmOptions): Promise<CallLlmResult> {
	const envTimeout = Number(env.LLM_TIMEOUT_MS);
	const effectiveTimeout = timeoutMs ?? (Number.isFinite(envTimeout) && envTimeout > 0 ? envTimeout : DEFAULT_TIMEOUT_MS);
	if (!prompt || typeof prompt !== 'string') {
		throw new LlmError(400, 'Missing "prompt"');
	}

	const url = env.LLM_API_URL || DEFAULT_URL;
	const apiKey = env.LLM_API_KEY;

	const messages: { role: string; content: string }[] = [];
	if (system) messages.push({ role: 'system', content: system });
	messages.push({ role: 'user', content: prompt });

	const body: Record<string, unknown> = {
		model: env.LLM_MODEL || 'local-llm',
		messages,
		temperature: typeof temperature === 'number' ? temperature : 0.7,
		stream: false
	};
	if (noThink) {
		body.chat_template_kwargs = { enable_thinking: false };
	}

	let res: Response;
	try {
		res = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
			},
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(effectiveTimeout)
		});
	} catch (err: any) {
		throw new LlmError(503, `LLM server unreachable at ${url}: ${err.message || err}`);
	}

	if (!res.ok) {
		const bodyText = await res.text().catch(() => '');
		throw new LlmError(res.status, `LLM server error: ${bodyText.slice(0, 500)}`);
	}

	const data = await res.json().catch(() => null);
	let content: string | undefined = data?.choices?.[0]?.message?.content;
	if (!content) {
		throw new LlmError(502, 'LLM response missing choices[0].message.content');
	}

	if (noThink) {
		content = stripThinking(content);
	}

	return { content };
}

function stripThinking(text: string): string {
	const closeTag = text.lastIndexOf('</think>');
	if (closeTag !== -1) {
		return text.slice(closeTag + '</think>'.length).trimStart();
	}
	return text;
}
