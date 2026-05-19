import { env } from '$env/dynamic/private';

const DEFAULT_URL = 'http://localhost:8080/v1/chat/completions';

export interface ChatMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

export interface CallLlmOptions {
	prompt?: string;
	system?: string;
	messages?: ChatMessage[];
	temperature?: number;
	/** Hard cap on generated tokens (OpenAI `max_tokens`). Omit for no cap. */
	maxTokens?: number;
	timeoutMs?: number;
	/** Append " /no_think" to the user prompt to suppress Qwen's reasoning preamble. Default: true. */
	noThink?: boolean;
}

export interface CallLlmUsage {
	prompt_tokens?: number;
	completion_tokens?: number;
	total_tokens?: number;
}

export interface CallLlmResult {
	content: string;
	/** Token accounting from the OpenAI-compatible endpoint, if it reports it. */
	usage?: CallLlmUsage;
	/** Wall-clock ms spent on the upstream LLM fetch (request → parsed body). */
	ms: number;
	/** Diagnostic: raw content length before <think> stripping, and how much was stripped. */
	diag: { rawChars: number; strippedChars: number; thinkingChars: number };
}

/** Metadata filled in by {@link callLlmStream} once the upstream stream ends. */
export interface CallLlmStreamMeta {
	usage?: CallLlmUsage;
	ms: number;
	rawChars: number;
	strippedChars: number;
}

export class LlmError extends Error {
	constructor(public readonly status: number, message: string) {
		super(message);
		this.name = 'LlmError';
	}
}

const DEFAULT_TIMEOUT_MS = 600000;

function resolveConfig() {
	const url = env.LLM_API_URL || DEFAULT_URL;
	const apiKey = env.LLM_API_KEY;
	const model = env.LLM_MODEL || 'local-llm';
	const envTimeout = Number(env.LLM_TIMEOUT_MS);
	return { url, apiKey, model, envTimeout };
}

function buildMessages(
	prompt: string | undefined,
	system: string | undefined,
	providedMessages: ChatMessage[] | undefined
): { role: string; content: string }[] {
	const messages: { role: string; content: string }[] = [];
	if (Array.isArray(providedMessages)) {
		if (system && !providedMessages.some((m) => m.role === 'system')) {
			messages.push({ role: 'system', content: system });
		}
		messages.push(...providedMessages);
		if (messages.length === 0) {
			throw new LlmError(400, 'Missing "prompt" or "messages"');
		}
	} else {
		if (!prompt || typeof prompt !== 'string') {
			throw new LlmError(400, 'Missing "prompt" or "messages"');
		}
		if (system) messages.push({ role: 'system', content: system });
		messages.push({ role: 'user', content: prompt });
	}
	return messages;
}

/**
 * Removes a leading `<think>…</think>` block from a streamed delta sequence.
 * In the common case (enable_thinking:false) no tag appears and the very first
 * delta passes straight through, so streaming stays immediate.
 */
class ThinkStripper {
	private resolved = false;
	private buf = '';

	push(delta: string): string {
		if (this.resolved) return delta;
		this.buf += delta;
		const lead = this.buf.replace(/^\s+/, '');
		const close = this.buf.indexOf('</think>');
		if (close !== -1) {
			this.resolved = true;
			const out = this.buf.slice(close + '</think>'.length).replace(/^\s+/, '');
			this.buf = '';
			return out;
		}
		// Still ambiguous only while the buffer could be the start of "<think>".
		if (lead === '' || '<think>'.startsWith(lead.slice(0, 7)) || lead.startsWith('<think>')) {
			return '';
		}
		this.resolved = true;
		const out = this.buf;
		this.buf = '';
		return out;
	}
}

export async function callLlm({
	prompt,
	system,
	messages: providedMessages,
	temperature,
	maxTokens,
	timeoutMs,
	noThink = true
}: CallLlmOptions): Promise<CallLlmResult> {
	const { url, apiKey, model, envTimeout } = resolveConfig();
	const effectiveTimeout = timeoutMs ?? (Number.isFinite(envTimeout) && envTimeout > 0 ? envTimeout : DEFAULT_TIMEOUT_MS);

	const messages = buildMessages(prompt, system, providedMessages);

	const body: Record<string, unknown> = {
		model,
		messages,
		temperature: typeof temperature === 'number' ? temperature : 0.7,
		stream: false
	};
	if (typeof maxTokens === 'number' && maxTokens > 0) {
		body.max_tokens = maxTokens;
	}
	if (noThink) {
		body.chat_template_kwargs = { enable_thinking: false };
	}

	const startedAt = Date.now();
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

	const rawChars = content.length;
	if (noThink) {
		content = stripThinking(content);
	}
	const strippedChars = content.length;

	const usage: CallLlmUsage | undefined =
		data?.usage && typeof data.usage === 'object'
			? {
					prompt_tokens: data.usage.prompt_tokens,
					completion_tokens: data.usage.completion_tokens,
					total_tokens: data.usage.total_tokens
				}
			: undefined;

	return {
		content,
		usage,
		ms: Date.now() - startedAt,
		diag: { rawChars, strippedChars, thinkingChars: rawChars - strippedChars }
	};
}

/**
 * Streaming counterpart to {@link callLlm}. Yields think-stripped content
 * deltas as they arrive from the OpenAI-compatible endpoint. When the upstream
 * stream ends, `meta` (if passed) is populated with usage + timing so callers
 * can keep the existing dev diagnostics. `callLlm` is left untouched for the
 * non-streaming endpoints that still use it.
 */
export async function* callLlmStream(
	{
		prompt,
		system,
		messages: providedMessages,
		temperature,
		maxTokens,
		timeoutMs,
		noThink = true
	}: CallLlmOptions,
	meta?: Partial<CallLlmStreamMeta>
): AsyncGenerator<string, void, unknown> {
	const { url, apiKey, model, envTimeout } = resolveConfig();
	const effectiveTimeout =
		timeoutMs ?? (Number.isFinite(envTimeout) && envTimeout > 0 ? envTimeout : DEFAULT_TIMEOUT_MS);

	const messages = buildMessages(prompt, system, providedMessages);

	const body: Record<string, unknown> = {
		model,
		messages,
		temperature: typeof temperature === 'number' ? temperature : 0.7,
		stream: true,
		stream_options: { include_usage: true }
	};
	if (typeof maxTokens === 'number' && maxTokens > 0) {
		body.max_tokens = maxTokens;
	}
	if (noThink) {
		body.chat_template_kwargs = { enable_thinking: false };
	}

	const startedAt = Date.now();
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

	if (!res.ok || !res.body) {
		const bodyText = await res.text().catch(() => '');
		throw new LlmError(res.status || 502, `LLM server error: ${bodyText.slice(0, 500)}`);
	}

	const reader = res.body.getReader();
	const decoder = new TextDecoder();
	const stripper = new ThinkStripper();
	let sseBuf = '';
	let rawChars = 0;
	let strippedChars = 0;

	const emitFrame = (payload: string): string | null => {
		if (payload === '[DONE]') return null;
		let json: any;
		try {
			json = JSON.parse(payload);
		} catch {
			return null;
		}
		if (json?.usage && typeof json.usage === 'object') {
			(meta ?? (meta = {})).usage = {
				prompt_tokens: json.usage.prompt_tokens,
				completion_tokens: json.usage.completion_tokens,
				total_tokens: json.usage.total_tokens
			};
		}
		const delta: string | undefined = json?.choices?.[0]?.delta?.content;
		return typeof delta === 'string' ? delta : '';
	};

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			sseBuf += decoder.decode(value, { stream: true });
			let nl: number;
			while ((nl = sseBuf.indexOf('\n')) !== -1) {
				const line = sseBuf.slice(0, nl).trim();
				sseBuf = sseBuf.slice(nl + 1);
				if (!line || !line.startsWith('data:')) continue;
				const raw = emitFrame(line.slice(5).trim());
				if (raw === null || raw === '') continue;
				rawChars += raw.length;
				const out = stripper.push(raw);
				if (out) {
					strippedChars += out.length;
					yield out;
				}
			}
		}
	} finally {
		reader.releaseLock();
		if (meta) {
			meta.ms = Date.now() - startedAt;
			meta.rawChars = rawChars;
			meta.strippedChars = strippedChars;
		}
	}
}

function stripThinking(text: string): string {
	const closeTag = text.lastIndexOf('</think>');
	if (closeTag !== -1) {
		return text.slice(closeTag + '</think>'.length).trimStart();
	}
	return text;
}
