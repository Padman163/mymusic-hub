import { getStore } from '@netlify/blobs';

export const progressReadOptions = { type: 'json', consistency: 'strong' } as const;

export function progressStore() {
	return getStore('mymusic-hub-user-data');
}

export function progressKey(userId: string): string {
	return `learning-progress:${userId}`;
}
