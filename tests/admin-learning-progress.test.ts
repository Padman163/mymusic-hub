// @vitest-environment node
import type { Context } from '@netlify/functions';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handle from '../netlify/functions/admin-learning-progress';
import { createInitialProgress, type LearningProgressState } from '../src/lib/learning-progress';
import { mockBlobStore } from './fixtures/blob-store';
import { createModulesTestDatabase } from './fixtures/modules';

const mocks = vi.hoisted(() => ({
	getStore: vi.fn(), getUser: vi.fn(), verifyRequestOrigin: vi.fn(),
	listUsers: vi.fn(), getAccount: vi.fn(),
}));
vi.mock('@netlify/blobs', () => ({ getStore: mocks.getStore }));
vi.mock('@netlify/identity', () => ({
	AuthError: class AuthError extends Error {},
	getUser: mocks.getUser,
	verifyRequestOrigin: mocks.verifyRequestOrigin,
	admin: { listUsers: mocks.listUsers, getUser: mocks.getAccount },
}));

const id = '00000000-0000-4000-8000-000000000001';
const key = `learning-progress:${id}`;
const actor = { id: '00000000-0000-4000-8000-000000000002', roles: ['admin'] };
const context = { deploy: { id: 'preview', context: 'deploy-preview', published: false } } as Context;
const endpoint = 'https://preview.example/api/admin/learning-progress';
const target = { id, email: 'learner@example.test', roles: ['learner'] };
const db = createModulesTestDatabase();
const [first, second] = db.modules;

function request(query = '', body?: Record<string, unknown>, deploy = context) {
	return handle(new Request(endpoint + query, body && {
		method: 'POST',
		headers: { Origin: 'https://preview.example', 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	}), deploy);
}

describe('Lernstände im Admin-Bereich', () => {
	let personal: ReturnType<typeof mockBlobStore>;
	let state: LearningProgressState;
	let version: string;

	beforeEach(() => {
		vi.stubEnv('NETLIFY_DEV', '');
		vi.resetAllMocks();
		mocks.getUser.mockResolvedValue(actor);
		mocks.listUsers.mockResolvedValue([target]);
		mocks.getAccount.mockResolvedValue(target);
		const shared = mockBlobStore();
		shared.put('modules', db);
		personal = mockBlobStore();
		mocks.getStore.mockImplementation((name: string) => name === 'mymusic-hub-user-data' ? personal : shared);
		state = createInitialProgress(db.modules);
		state.totalXp = 150;
		state.spentXp = 25;
		state.inventory = [{ id: 'item', title: 'Mikrofon', description: '', unlockedAt: new Date().toISOString() }];
		state.modules[first.id].status = 'completed';
		state.modules[first.id].completedVia = 'normal';
		state.modules[first.id].bestQuizEasyScore = 1;
		state.modules[first.id].solvedQuestionIds = ['question'];
		state.modules[second.id].status = 'unlocked';
		state.modules[second.id].completedTheoryBlockIds = ['block'];
		version = personal.put(key, state).etag;
	});

	afterEach(() => vi.unstubAllEnvs());

	it('liefert nur Admins die minimierte Nutzerliste und den gewählten Lernstand', async () => {
		mocks.getUser.mockResolvedValueOnce({ roles: [] });
		expect((await request()).status).toBe(403);
		expect(mocks.listUsers).not.toHaveBeenCalled();
		const listed = await request('?page=2');
		expect(listed.headers.get('Cache-Control')).toBe('no-store');
		expect(await listed.json()).toMatchObject({ users: [{ id, email: target.email }], writable: true });
		expect(mocks.listUsers).toHaveBeenCalledWith({ page: 2, perPage: 25 });
		const detail = await request(`?id=${id}`);
		expect(await detail.json()).toMatchObject({
			version,
			progress: { totalXp: 150, availableXp: 125, spentXp: 25, inventory: [{ title: 'Mikrofon' }],
				modules: [{ id: first.id, resettable: true }, { id: second.id, resettable: true }] },
		});
	});

	it('setzt nur nach eigener Bestätigung den gesamten Lernstand des gewählten Kontos zurück', async () => {
		state.equippedInventoryItemIds = ['item'];
		state.modules[first.id].xpBeforeReset = { questions: ['earlier-question'] };
		version = personal.put(key, state).etag;
		const otherKey = `learning-progress:${actor.id}`;
		personal.put(otherKey, state);
		const body = { scope: 'all', version, confirmation: 'ALLES ZURÜCKSETZEN' };

		expect((await request(`?id=${id}`, { ...body, confirmation: 'ZURÜCKSETZEN' })).status).toBe(400);
		expect((await request(`?id=${id}`, { ...body, version: 'stale' })).status).toBe(409);
		mocks.getUser.mockResolvedValueOnce({ roles: [] });
		expect((await request(`?id=${id}`, body)).status).toBe(403);
		expect(personal.setJSON).not.toHaveBeenCalled();

		expect((await request(`?id=${id}`, body)).status).toBe(200);
		const fresh = createInitialProgress(db.modules, db.quizSettings);
		expect(personal.value(key)).toEqual({ ...fresh, updatedAt: expect.any(String) });
		expect(personal.value(otherKey)).toEqual(state);
		expect(personal.setJSON).toHaveBeenCalledWith(
			key, { ...fresh, updatedAt: expect.any(String) }, { onlyIfMatch: version },
		);
		expect(await (await request(`?id=${id}`)).json()).toMatchObject({
			user: { id, email: target.email }, progress: { totalXp: 0, spentXp: 0, inventory: [] },
		});
	});

	it('setzt im Deploy Preview nur den bestätigten Lehrgang zurück', async () => {
		const body = { version, moduleId: first.id, confirmation: 'ZURÜCKSETZEN' };
		expect((await request(`?id=${id}`, { ...body, confirmation: '' })).status).toBe(400);
		expect((await request(`?id=${id}`, body, {
			...context, deploy: { ...context.deploy, context: 'branch-deploy' },
		})).status).toBe(403);
		mocks.verifyRequestOrigin.mockImplementationOnce(() => { throw new Error('anderer Origin'); });
		expect((await request(`?id=${id}`, body)).status).toBe(403);
		expect(personal.setJSON).not.toHaveBeenCalled();
		expect((await request(`?id=${id}`, body)).status).toBe(200);
		const saved = personal.value(key) as LearningProgressState;
		expect(saved).toMatchObject({
			totalXp: 150, spentXp: 25, inventory: state.inventory,
			modules: {
				[first.id]: { status: 'unlocked', solvedQuestionIds: [], steps: { theory: 'unlocked', mittel: 'locked' } },
				[second.id]: state.modules[second.id],
			},
		});
		expect(saved.modules[first.id].bestQuizEasyScore).toBeUndefined();
		expect(saved.modules[first.id].xpBeforeReset?.questions).toEqual(['question']);
		expect(personal.setJSON).toHaveBeenCalledWith(key, saved, { onlyIfMatch: version });
		expect((await request(`?id=${id}`, body)).status).toBe(409);
		expect(personal.setJSON).toHaveBeenCalledTimes(1);
	});
});
