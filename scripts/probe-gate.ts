#!/usr/bin/env bun
/**
 * probe-gate.ts — inspect input/output of the manzanaresgate LLM endpoint.
 *
 * Sends a single prompt to the configured LLM_API_URL (the search-capable
 * `local-search` model by default) and prints BOTH the exact request that
 * went out AND the full raw JSON response — including anything the search
 * model returns beyond `content` (sources, citations, annotations, usage),
 * which the app's callLlm() normally discards.
 *
 * Usage:
 *   bun run scripts/probe-gate.ts "what happened in Madrid today"
 *   bun run scripts/probe-gate.ts --system "You are a news desk." "latest on X"
 *   bun run scripts/probe-gate.ts --model local-search --raw "prompt"
 *   bun run scripts/probe-gate.ts --no-think "prompt"   # keep <think> block
 *
 * Large prompts with many symbols — avoid shell quoting entirely:
 *   bun run scripts/probe-gate.ts --file prompt.txt
 *   bun run scripts/probe-gate.ts --stdin < prompt.txt
 *   pbpaste | bun run scripts/probe-gate.ts --stdin        # from clipboard
 *   bun run scripts/probe-gate.ts --stdin <<'EOF'
 *   ...paste anything here, $ ` ! " ' newlines all safe...
 *   EOF
 *   --system also accepts @file:  --system @news-desk.txt
 *
 * Flags:
 *   --file <path>     Read the USER prompt from a file (no shell escaping).
 *   --stdin           Read the USER prompt from stdin (pipe/heredoc/redirect).
 *   --system <text>   System prompt; use @<path> to read it from a file.
 *   --model <name>    Override model (default: LLM_MODEL from .env).
 *   --temp <n>        Temperature (default 0.7).
 *   --raw             Print ONLY the raw JSON response, nothing else.
 *   --no-think        Do NOT disable thinking; show the model's <think> block.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// --- Minimal .env loader (so this works under plain `node` too) -----------
function loadEnv(file: string): Record<string, string> {
	const out: Record<string, string> = {};
	let text: string;
	try {
		text = readFileSync(file, 'utf8');
	} catch {
		return out;
	}
	for (const line of text.split('\n')) {
		const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
		if (!m) continue;
		let val = m[2].trim();
		if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
			val = val.slice(1, -1);
		}
		out[m[1]] = val;
	}
	return out;
}

const fileEnv = loadEnv(resolve(ROOT, '.env'));
const ENV = { ...fileEnv, ...process.env };

// --- Arg parsing ----------------------------------------------------------
const argv = process.argv.slice(2);
let system: string | undefined;
let modelOverride: string | undefined;
let temperature = 0.7;
let rawOnly = false;
let noThink = true;
let promptFile: string | undefined;
let useStdin = false;
const promptParts: string[] = [];

for (let i = 0; i < argv.length; i++) {
	const a = argv[i];
	if (a === '--system') system = argv[++i];
	else if (a === '--model') modelOverride = argv[++i];
	else if (a === '--temp') temperature = Number(argv[++i]);
	else if (a === '--raw') rawOnly = true;
	else if (a === '--no-think') noThink = false;
	else if (a === '--file') promptFile = argv[++i];
	else if (a === '--stdin' || a === '-') useStdin = true;
	else promptParts.push(a);
}

// --system @path → read system prompt from a file too.
if (system && system.startsWith('@')) {
	system = readFileSync(resolve(process.cwd(), system.slice(1)), 'utf8');
}

async function readStdin(): Promise<string> {
	const chunks: Buffer[] = [];
	for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
	return Buffer.concat(chunks).toString('utf8');
}

// Prompt source priority: --file > --stdin > positional args.
// Only --file/--stdin preserve $ ` ! " ' and newlines unmangled by the shell.
let prompt: string;
if (promptFile) {
	prompt = readFileSync(resolve(process.cwd(), promptFile), 'utf8').trim();
} else if (useStdin) {
	prompt = (await readStdin()).trim();
} else {
	prompt = promptParts.join(' ').trim();
}

if (!prompt) {
	console.error('Usage: bun run scripts/probe-gate.ts [--file <path> | --stdin | "<prompt>"] [--system <t|@path>] [--model <m>] [--temp <n>] [--raw] [--no-think]');
	console.error('Tip: for large prompts with lots of symbols, use --file prompt.txt or --stdin < prompt.txt');
	process.exit(1);
}

const url = ENV.LLM_API_URL || 'http://localhost:8080/v1/chat/completions';
const apiKey = ENV.LLM_API_KEY;
const model = modelOverride || ENV.LLM_MODEL || 'local-llm';

const messages: { role: string; content: string }[] = [];
if (system) messages.push({ role: 'system', content: system });
messages.push({ role: 'user', content: prompt });

const body: Record<string, unknown> = { model, messages, temperature, stream: false };
if (noThink) body.chat_template_kwargs = { enable_thinking: false };

const sep = (label: string) => `\n\x1b[1;36m──── ${label} ${'─'.repeat(Math.max(0, 60 - label.length))}\x1b[0m`;

if (!rawOnly) {
	console.log(sep('REQUEST'));
	console.log(`url:   ${url}`);
	console.log(`model: ${model}`);
	console.log(`temp:  ${temperature}   noThink: ${noThink}`);
	console.log('body:');
	console.log(JSON.stringify(body, null, 2));
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
		signal: AbortSignal.timeout(600000)
	});
} catch (err) {
	console.error(`\n\x1b[1;31mRequest failed:\x1b[0m ${(err as Error).message}`);
	process.exit(1);
}

const ms = Date.now() - startedAt;
const text = await res.text();
let data: any = null;
try {
	data = JSON.parse(text);
} catch {
	/* non-JSON (e.g. HTML error page) */
}

if (rawOnly) {
	console.log(data ? JSON.stringify(data, null, 2) : text);
	process.exit(res.ok ? 0 : 1);
}

console.log(sep('RAW RESPONSE'));
console.log(`status: ${res.status} ${res.statusText}   (${ms} ms)`);
console.log(data ? JSON.stringify(data, null, 2) : text);

if (!res.ok || !data) process.exit(1);

// --- Highlight the bits that matter for "what news was found" -------------
const choice = data?.choices?.[0];
let content: string = choice?.message?.content ?? '';

// Separate any <think> reasoning from the answer.
const closeTag = content.lastIndexOf('</think>');
let thinkBlock = '';
if (closeTag !== -1) {
	const openTag = content.indexOf('<think>');
	thinkBlock = content.slice(openTag === -1 ? 0 : openTag, closeTag + '</think>'.length);
	content = content.slice(closeTag + '</think>'.length).trimStart();
}

if (thinkBlock) {
	console.log(sep('MODEL THINKING'));
	console.log(thinkBlock);
}

console.log(sep('ANSWER (content)'));
console.log(content || '(empty)');

// Surface any search/source metadata the endpoint attaches, wherever it hides.
const sourceKeys = ['sources', 'citations', 'annotations', 'search_results', 'references', 'documents', 'tool_calls'];
const found: Record<string, unknown> = {};
for (const key of sourceKeys) {
	if (choice?.message?.[key] != null) found[`message.${key}`] = choice.message[key];
	if (choice?.[key] != null) found[`choices[0].${key}`] = choice[key];
	if (data?.[key] != null) found[key] = data[key];
}
if (Object.keys(found).length) {
	console.log(sep('NEWS / SOURCE MATERIAL'));
	console.log(JSON.stringify(found, null, 2));
} else {
	console.log(sep('NEWS / SOURCE MATERIAL'));
	console.log('(no structured sources field; any citations are inline in the answer above)');
}

if (data?.usage) {
	console.log(sep('USAGE'));
	console.log(JSON.stringify(data.usage, null, 2));
}
