import { vi } from 'vitest';

export function mockBlobStore() {
	let version = 0;
	const entries = new Map<string, { data: unknown; etag: string }>();
	const put = (key: string, data: unknown) => {
		const etag = String(++version);
		entries.set(key, { data: structuredClone(data), etag });
		return { modified: true, etag };
	};
	return {
		put,
		value: (key: string) => structuredClone(entries.get(key)?.data ?? null),
		get: vi.fn(async (key: string) => structuredClone(entries.get(key)?.data ?? null)),
		getWithMetadata: vi.fn(async (key: string) => structuredClone(entries.get(key) ?? null)),
		setJSON: vi.fn(async (key: string, data: unknown, options?: { onlyIfMatch?: string; onlyIfNew?: boolean }) => {
			const current = entries.get(key);
			if ((options?.onlyIfNew && current) || (options?.onlyIfMatch && options.onlyIfMatch !== current?.etag)) {
				return { modified: false };
			}
			return put(key, data);
		}),
	};
}
