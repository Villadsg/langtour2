import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { callLlm, LlmError } from '$lib/server/llm';

export const POST: RequestHandler = async ({ request }) => {
	const { prompt, system, messages, temperature } = await request.json();

	try {
		const { content } = await callLlm({ prompt, system, messages, temperature });
		return json({ content });
	} catch (err) {
		if (err instanceof LlmError) {
			throw error(err.status, err.message);
		}
		throw err;
	}
};
