// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import 'fake-indexeddb/auto';
import initSqlJs from 'sql.js';
import { initDB, createHabit, getActiveHabits, getArchivedHabits, updateHabit, archiveHabit, unarchiveHabit, deleteHabit, logEntry, removeLogEntry, getProgress, getHabitsWithProgress, getHabit, getLogEntries } from './db';

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

	it('archives a habit', () => {
		const h = createHabit('To Archive', 1, 'daily');
		archiveHabit(h.id);
		const active = getActiveHabits().find(x => x.id === h.id);
		expect(active).toBeUndefined();
		const archived = getArchivedHabits().find(x => x.id === h.id);
		expect(archived).not.toBeUndefined();
		expect(archived!.status).toBe('archived');
	});

	it('unarchives a habit', () => {
		const h = createHabit('To Unarchive', 1, 'daily');
		archiveHabit(h.id);
		unarchiveHabit(h.id);
		const active = getActiveHabits().find(x => x.id === h.id);
		expect(active).not.toBeUndefined();
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
		const h = createHabit('Log Test', 1, 'daily');
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
});
