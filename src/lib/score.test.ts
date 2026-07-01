// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Database } from 'sql.js';
import { getScore, getHabitsWithProgress, setTestDB } from './db';
import { createTestDB, seedHabit, seedLogEntry, cleanupDB } from './test-utils';

function setNow(iso: string) {
	vi.useFakeTimers();
	vi.setSystemTime(new Date(iso));
}

describe('getScore — daily', () => {
	let db: Database;

	beforeEach(async () => {
		db = await createTestDB();
		setTestDB(db);
	});

	afterEach(() => {
		cleanupDB(db);
		vi.useRealTimers();
	});

	it('returns 0 for new habit with no completed periods', () => {
		setNow('2026-01-15T12:00:00.000Z');
		const id = seedHabit(db, { createdAt: '2026-01-15T10:00:00.000Z' });
		expect(getScore(id)).toBe(0);
	});

	it('returns 0 via getHabitsWithProgress for new habit', () => {
		setNow('2026-01-15T12:00:00.000Z');
		seedHabit(db, { id: 'h1', createdAt: '2026-01-15T10:00:00.000Z' });
		const habits = getHabitsWithProgress();
		expect(habits.find(h => h.id === 'h1')!.score).toBe(0);
	});

	it('scores +1 when creation day had goal met and next day arrived', () => {
		setNow('2026-01-02T12:00:00.000Z');
		const id = seedHabit(db, { createdAt: '2026-01-01T10:00:00.000Z', goalCount: 1 });
		seedLogEntry(db, { habitId: id, loggedAt: '2026-01-01' });
		expect(getScore(id)).toBe(1);
	});

	it('scores -1 when creation day missed goal and next day arrived', () => {
		setNow('2026-01-02T12:00:00.000Z');
		const id = seedHabit(db, { createdAt: '2026-01-01T10:00:00.000Z', goalCount: 1 });
		expect(getScore(id)).toBe(-1);
	});

	it('accumulates across multiple completed days', () => {
		setNow('2026-01-05T12:00:00.000Z');
		const id = seedHabit(db, { createdAt: '2026-01-01T10:00:00.000Z', goalCount: 1 });
		seedLogEntry(db, { habitId: id, loggedAt: '2026-01-01' });
		seedLogEntry(db, { habitId: id, loggedAt: '2026-01-02' });
		seedLogEntry(db, { habitId: id, loggedAt: '2026-01-03' });
		expect(getScore(id)).toBe(2);
	});

	it('excludes today (current period) from scoring', () => {
		setNow('2026-01-05T12:00:00.000Z');
		const id = seedHabit(db, { createdAt: '2026-01-01T10:00:00.000Z', goalCount: 1 });
		seedLogEntry(db, { habitId: id, loggedAt: '2026-01-01' });
		seedLogEntry(db, { habitId: id, loggedAt: '2026-01-02' });
		seedLogEntry(db, { habitId: id, loggedAt: '2026-01-03' });
		seedLogEntry(db, { habitId: id, loggedAt: '2026-01-05' });
		expect(getScore(id)).toBe(2);
	});

	it('scores correctly with goalCount > 1', () => {
		setNow('2026-01-03T12:00:00.000Z');
		const id = seedHabit(db, { createdAt: '2026-01-01T10:00:00.000Z', goalCount: 3 });
		seedLogEntry(db, { habitId: id, loggedAt: '2026-01-01' });
		seedLogEntry(db, { habitId: id, loggedAt: '2026-01-01' });
		seedLogEntry(db, { habitId: id, loggedAt: '2026-01-01' });
		seedLogEntry(db, { habitId: id, loggedAt: '2026-01-02' });
		seedLogEntry(db, { habitId: id, loggedAt: '2026-01-02' });
		expect(getScore(id)).toBe(0);
	});

	it('freezes score on archive — entries after archive ignored', () => {
		setNow('2026-01-10T12:00:00.000Z');
		const id = seedHabit(db, {
			createdAt: '2026-01-01T10:00:00.000Z',
			status: 'archived',
			archivedAt: '2026-01-05T12:00:00.000Z',
		});
		seedLogEntry(db, { habitId: id, loggedAt: '2026-01-01' });
		seedLogEntry(db, { habitId: id, loggedAt: '2026-01-02' });
		seedLogEntry(db, { habitId: id, loggedAt: '2026-01-04' });
		seedLogEntry(db, { habitId: id, loggedAt: '2026-01-07' });
		expect(getScore(id)).toBe(2);
	});

	it('returns 0 for deleted habit', () => {
		setNow('2026-01-05T12:00:00.000Z');
		const id = seedHabit(db, {
			createdAt: '2026-01-01T10:00:00.000Z',
			status: 'deleted',
		});
		seedLogEntry(db, { habitId: id, loggedAt: '2026-01-01' });
		expect(getScore(id)).toBe(0);
	});

	it('resets score to 0 on unarchive (createdAt = now, fresh start)', () => {
		setNow('2026-01-10T12:00:00.000Z');
		const id = seedHabit(db, { createdAt: '2026-01-10T10:00:00.000Z', goalCount: 1 });
		seedLogEntry(db, { habitId: id, loggedAt: '2026-01-10' });
		expect(getScore(id)).toBe(0);
	});
});

describe('getScore — weekly', () => {
	let db: Database;

	beforeEach(async () => {
		db = await createTestDB();
		setTestDB(db);
	});

	afterEach(() => {
		cleanupDB(db);
		vi.useRealTimers();
	});

	it('returns 0 for new habit in same week', () => {
		setNow('2026-01-08T12:00:00.000Z');
		const id = seedHabit(db, {
			createdAt: '2026-01-08T10:00:00.000Z',
			goalPeriod: 'weekly',
		});
		expect(getScore(id)).toBe(0);
	});

	it('scores +1 when creation week (partial) met goal and next Monday arrived', () => {
		setNow('2026-01-12T12:00:00.000Z');
		const id = seedHabit(db, {
			createdAt: '2026-01-08T10:00:00.000Z',
			goalCount: 1,
			goalPeriod: 'weekly',
		});
		seedLogEntry(db, { habitId: id, loggedAt: '2026-01-08' });
		expect(getScore(id)).toBe(1);
	});

	it('scores -1 when creation week missed goal', () => {
		setNow('2026-01-12T12:00:00.000Z');
		const id = seedHabit(db, {
			createdAt: '2026-01-08T10:00:00.000Z',
			goalCount: 1,
			goalPeriod: 'weekly',
		});
		expect(getScore(id)).toBe(-1);
	});

	it('scores creation week when created on Monday', () => {
		setNow('2026-01-12T12:00:00.000Z');
		const id = seedHabit(db, {
			createdAt: '2026-01-05T10:00:00.000Z',
			goalCount: 1,
			goalPeriod: 'weekly',
		});
		seedLogEntry(db, { habitId: id, loggedAt: '2026-01-05' });
		expect(getScore(id)).toBe(1);
	});

	it('accumulates across multiple completed weeks', () => {
		setNow('2026-01-26T12:00:00.000Z');
		const id = seedHabit(db, {
			createdAt: '2026-01-06T10:00:00.000Z',
			goalCount: 2,
			goalPeriod: 'weekly',
		});
		seedLogEntry(db, { habitId: id, loggedAt: '2026-01-06' });
		seedLogEntry(db, { habitId: id, loggedAt: '2026-01-10' });
		seedLogEntry(db, { habitId: id, loggedAt: '2026-01-13' });
		seedLogEntry(db, { habitId: id, loggedAt: '2026-01-14' });
		seedLogEntry(db, { habitId: id, loggedAt: '2026-01-20' });
		seedLogEntry(db, { habitId: id, loggedAt: '2026-01-21' });
		expect(getScore(id)).toBe(3);
	});

	it('excludes current week from scoring', () => {
		setNow('2026-01-26T12:00:00.000Z');
		const id = seedHabit(db, {
			createdAt: '2026-01-06T10:00:00.000Z',
			goalCount: 1,
			goalPeriod: 'weekly',
		});
		seedLogEntry(db, { habitId: id, loggedAt: '2026-01-07' });
		seedLogEntry(db, { habitId: id, loggedAt: '2026-01-14' });
		seedLogEntry(db, { habitId: id, loggedAt: '2026-01-22' });
		expect(getScore(id)).toBe(3);
	});

	it('freezes score on archive across week boundary', () => {
		setNow('2026-01-26T12:00:00.000Z');
		const id = seedHabit(db, {
			createdAt: '2026-01-06T10:00:00.000Z',
			goalCount: 1,
			goalPeriod: 'weekly',
			status: 'archived',
			archivedAt: '2026-01-19T12:00:00.000Z',
		});
		seedLogEntry(db, { habitId: id, loggedAt: '2026-01-07' });
		seedLogEntry(db, { habitId: id, loggedAt: '2026-01-14' });
		expect(getScore(id)).toBe(2);
	});
});
