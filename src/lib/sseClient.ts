/**
 * Reads a `text/event-stream` Response body and invokes `on(event, data)` for
 * each complete `event:`/`data:` frame. Shared by the Quick Phrases callers so
 * the initial generation and topic-regenerate consume the stream identically.
 *
 * `data` is JSON-parsed; frames whose data isn't valid JSON are skipped.
 * Resolves when the stream ends.
 */
export async function readSSE(
	res: Response,
	on: (event: string, data: any) => void
): Promise<void> {
	if (!res.body) throw new Error('Response has no body to stream');
	const reader = res.body.getReader();
	const decoder = new TextDecoder();
	let buf = '';

	const dispatch = (frame: string) => {
		let event = 'message';
		const dataLines: string[] = [];
		for (const line of frame.split('\n')) {
			if (line.startsWith('event:')) event = line.slice(6).trim();
			else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
		}
		if (dataLines.length === 0) return;
		try {
			on(event, JSON.parse(dataLines.join('\n')));
		} catch {
			/* ignore non-JSON / partial frame */
		}
	};

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			buf += decoder.decode(value, { stream: true });
			let sep: number;
			while ((sep = buf.indexOf('\n\n')) !== -1) {
				const frame = buf.slice(0, sep);
				buf = buf.slice(sep + 2);
				if (frame.trim()) dispatch(frame);
			}
		}
		if (buf.trim()) dispatch(buf);
	} finally {
		reader.releaseLock();
	}
}
