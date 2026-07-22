// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import 'fake-indexeddb/auto';
import initSqlJs from 'sql.js';
import { initDB, createHabit, getActiveHabits, getArchivedHabits, updateHabit, archiveHabit, unarchiveHabit, deleteHabit, logEntry, removeLogEntry, getProgress, getHabitsWithProgress, getHabit, getLogEntries, getScore, getPeriodBlocks, reorderHabits } from './db';

beforeAll(async () => {
	await initDB();
});

describe('habits', () => {
	it('starts empty', () => {
		expect(getActiveHabits()).toHaveLength(0);
		expect(getArchivedHabits()).toHaveLength(0);
	});

	it('creates a daily habit', () => {
		const h = createHabit('Drink water', 1, 'daily');
		expect(h.name).toBe('Drink water');
		expect(h.goalCount).toBe(1);
		expect(h.goalPeriod).toBe('daily');
		expect(h.status).toBe('active');
		expect(h.id).toBeTruthy();
	});

	it('creates a weekly habit', () => {
		const h = createHabit('Vacuum', 2, 'weekly');
		expect(h.goalPeriod).toBe('weekly');
		expect(h.goalCount).toBe(2);
	});

	it('lists active habits ordered by creation', () => {
		const habits = getActiveHabits();
		expect(habits).toHaveLength(2);
		expect(habits[0].name).toBe('Drink water');
		expect(habits[1].name).toBe('Vacuum');
	});

	it('gets a single habit by id', () => {
		const all = getActiveHabits();
		const found = getHabit(all[0].id);
		expect(found).not.toBeNull();
		expect(found!.id).toBe(all[0].id);
	});

	it('returns null for non-existent habit', () => {
		expect(getHabit('nonexistent')).toBeNull();
	});

	it('updates a habit', () => {
		const h = createHabit('Temp', 1, 'daily');
		updateHabit(h.id, 'Drink more water', 2, 'weekly');
		const updated = getHabit(h.id)!;
		expect(updated.name).toBe('Drink more water');
		expect(updated.goalCount).toBe(2);
		expect(updated.goalPeriod).toBe('weekly');
	});

	it('archives a habit and sets archivedAt', () => {
		const h = createHabit('To Archive', 1, 'daily');
		archiveHabit(h.id);
		const archived = getArchivedHabits().find(x => x.id === h.id);
		expect(archived).not.toBeUndefined();
		expect(archived!.status).toBe('archived');
		expect(archived!.archivedAt).toBeTruthy();
	});

	it('unarchives a habit and resets createdAt', () => {
		const h = createHabit('To Unarchive', 1, 'daily');
		const originalCreatedAt = h.createdAt;

		archiveHabit(h.id);
		unarchiveHabit(h.id);
		const active = getActiveHabits().find(x => x.id === h.id);
		expect(active).not.toBeUndefined();
		expect(active!.createdAt).not.toBe(originalCreatedAt);
		expect(active!.archivedAt).toBeUndefined();
	});

	it('deletes a habit and its logs', () => {
		const h = createHabit('To Delete', 1, 'daily');
		logEntry(h.id);
		deleteHabit(h.id);
		expect(getHabit(h.id)).toBeNull();
		expect(getLogEntries(h.id)).toHaveLength(0);
	});
});

describe('log entries', () => {
	let habitId: string;

	beforeAll(() => {
		const h = createHabit('Log Test', 2, 'daily');
		habitId = h.id;
	});

	it('logs an entry', () => {
		const entry = logEntry(habitId);
		expect(entry.habitId).toBe(habitId);
		expect(entry.loggedAt).toBeTruthy();
		expect(entry.id).toBeTruthy();
	});

	it('removes a log entry', () => {
		const entry = logEntry(habitId);
		expect(getLogEntries(habitId)).toHaveLength(2);
		removeLogEntry(entry.id);
		expect(getLogEntries(habitId)).toHaveLength(1);
	});

	it('enforces cap — cannot log more than goalCount per day', () => {
		const h = createHabit('Cap Test', 1, 'daily');
		logEntry(h.id); // first one works
		expect(() => logEntry(h.id)).toThrow('Cap reached');
	});

	it('enforces cap for weekly habits', () => {
		const h = createHabit('Weekly Cap', 2, 'weekly');
		logEntry(h.id);
		logEntry(h.id); // second one works (goalCount=2)
		expect(() => logEntry(h.id)).toThrow('Cap reached');
	});
});

describe('progress', () => {
	it('returns 0 for habit with no logs', () => {
		const h = createHabit('Empty', 1, 'daily');
		expect(getProgress(h.id)).toBe(0);
	});

	it('counts log entries within the period', () => {
		const h = createHabit('Prog Test', 3, 'daily');
		logEntry(h.id);
		logEntry(h.id);
		expect(getProgress(h.id)).toBe(2);
	});

	it('marks habit complete when progress >= goal', () => {
		const h = createHabit('Complete Test', 2, 'daily');
		logEntry(h.id);
		logEntry(h.id);
		const habits = getHabitsWithProgress();
		const found = habits.find(x => x.id === h.id);
		expect(found).not.toBeUndefined();
		expect(found!.progress).toBe(2);
		expect(found!.isComplete).toBe(true);
	});

	it('caps progress at goalCount in getHabitsWithProgress', () => {
		// progress() itself can exceed, but getHabitsWithProgress caps it
		const h = createHabit('Progress Cap', 1, 'daily');
		logEntry(h.id);
		// logEntry refuses to add more, but test via getProgress still returns 1
		expect(getProgress(h.id)).toBe(1);
		const habits = getHabitsWithProgress();
		const found = habits.find(x => x.id === h.id);
		expect(found!.progress).toBe(1);
	});
});

describe('score', () => {
	it('returns 0 for a new habit with no past periods', () => {
		const h = createHabit('Score Zero', 1, 'daily');
		expect(getScore(h.id)).toBe(0);
		// also via getHabitsWithProgress
		const habits = getHabitsWithProgress();
		const found = habits.find(x => x.id === h.id);
		expect(found!.score).toBe(0);
	});
});

describe('period blocks', () => {
	it('returns 1 block for a newly created daily habit', () => {
		const h = createHabit('Blocks Daily', 1, 'daily');
		const blocks = getPeriodBlocks(h.id);
		expect(blocks).toHaveLength(1);
		expect(blocks[0].isCurrent).toBe(true);
	});

	it('blocks have correct shape', () => {
		const h = createHabit('Blocks Shape', 1, 'daily');
		const blocks = getPeriodBlocks(h.id);
		for (const b of blocks) {
			expect(b).toHaveProperty('startDate');
			expect(b).toHaveProperty('complete');
			expect(b).toHaveProperty('isCurrent');
		}
	});

	it('marks a period as complete when goal met', () => {
		const h = createHabit('Block Complete', 1, 'daily');
		logEntry(h.id);
		const blocks = getPeriodBlocks(h.id);
		const today = new Date().toISOString().slice(0, 10);
		const todayBlock = blocks.find(b => b.startDate === today);
		expect(todayBlock).not.toBeUndefined();
		expect(todayBlock!.complete).toBe(true);
	});
});

describe('reorder', () => {
	it('reorders habits by updating sort_order', () => {
		const habits = getActiveHabits();
		expect(habits.length).toBeGreaterThanOrEqual(2);

		const ids = habits.map(h => h.id);
		const reversed = [...ids].reverse();
		reorderHabits(reversed);

		const reordered = getActiveHabits();
		expect(reordered[0].id).toBe(ids[ids.length - 1]);
		expect(reordered[reordered.length - 1].id).toBe(ids[0]);
	});

	it('creates new habit at the end', () => {
		const before = getActiveHabits();
		const h = createHabit('At End', 1, 'daily');
		const after = getActiveHabits();
		expect(after).toHaveLength(before.length + 1);
		expect(after[after.length - 1].id).toBe(h.id);
	});

	it('unarchived habit goes to the end', () => {
		const h = createHabit('To Unarchive Reorder', 1, 'daily');
		archiveHabit(h.id);
		unarchiveHabit(h.id);
		const after = getActiveHabits();
		expect(after[after.length - 1].id).toBe(h.id);
	});
});
