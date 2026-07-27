import initSqlJs, { type Database } from 'sql.js';
import type { Habit, HabitWithProgress, LogEntry, PeriodBlock } from './types';

const DB_NAME = 'habits-db';
const WASM_URL = typeof window !== 'undefined'
	? '/sql-wasm.wasm'
	: new URL('../../node_modules/sql.js/dist/sql-wasm.wasm', import.meta.url).href;

let db: Database | null = null;

function openIndexedDB(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, 1);
		req.onupgradeneeded = () => req.result.createObjectStore('db', { keyPath: 'id' });
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

async function loadFromIndexedDB(): Promise<Uint8Array | null> {
	const idb = await openIndexedDB();
	return new Promise((resolve, reject) => {
		const tx = idb.transaction('db', 'readonly');
		const store = tx.objectStore('db');
		const req = store.get('main');
		req.onsuccess = () => {
			resolve(req.result?.data ?? null);
		};
		req.onerror = () => reject(req.error);
		tx.oncomplete = () => idb.close();
	});
}

async function saveToIndexedDB(data: Uint8Array): Promise<void> {
	const idb = await openIndexedDB();
	return new Promise((resolve, reject) => {
		const tx = idb.transaction('db', 'readwrite');
		const store = tx.objectStore('db');
		store.put({ id: 'main', data });
		tx.oncomplete = () => {
			idb.close();
			resolve();
		};
		tx.onerror = () => reject(tx.error);
	});
}

export async function initDB(): Promise<void> {
	const SQL = await initSqlJs({ locateFile: () => WASM_URL });
	const existing = await loadFromIndexedDB();

	if (existing && existing.length > 0) {
		db = new SQL.Database(existing);
	} else {
		db = new SQL.Database();
	}

	db.run(`
		CREATE TABLE IF NOT EXISTS habits (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			goal_count INTEGER NOT NULL DEFAULT 1,
			goal_period TEXT NOT NULL CHECK(goal_period IN ('daily', 'weekly')),
			status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'archived', 'deleted')),
			created_at TEXT NOT NULL,
			archived_at TEXT
		)
	`);
	db.run(`
		CREATE TABLE IF NOT EXISTS log_entries (
			id TEXT PRIMARY KEY,
			habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
			logged_at TEXT NOT NULL,
			created_at TEXT NOT NULL
		)
	`);
	db.run(`
		CREATE TABLE IF NOT EXISTS goals (
			id TEXT PRIMARY KEY,
			habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
			goal_count INTEGER NOT NULL,
			goal_period TEXT NOT NULL CHECK(goal_period IN ('daily', 'weekly')),
			"from" TEXT NOT NULL,
			"to" TEXT
		)
	`);
	// backfill goals for existing habits that have none
	const orphanRows = db.exec(
		'SELECT h.id, h.goal_count, h.goal_period, h.created_at FROM habits h LEFT JOIN goals g ON h.id = g.habit_id WHERE g.id IS NULL'
	);
	if (orphanRows.length > 0) {
		for (const row of orphanRows[0].values) {
			createGoal(row[0] as string, row[1] as number, row[2] as string, row[3] as string);
		}
	}
	// migrate: add archived_at if table was created before this column existed
	try { db.run("ALTER TABLE habits ADD COLUMN archived_at TEXT"); } catch { /* already exists */ }
	// migrate: add sort_order for custom habit ordering
	try { db.run("ALTER TABLE habits ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0"); } catch { /* already exists */ }
	// backfill sort_order from created_at only if no habits have a custom order yet
	const d = ensureDB();
	const soRows = d.exec('SELECT COUNT(*) FROM habits WHERE sort_order != 0');
	const alreadyCustom = soRows.length > 0 ? (soRows[0].values[0][0] as number) : 0;
	if (alreadyCustom === 0) {
		const allRows = d.exec('SELECT id FROM habits WHERE status = ? ORDER BY created_at', ['active']);
		if (allRows.length > 0) {
			allRows[0].values.forEach((row, i) => {
				d.run('UPDATE habits SET sort_order = ? WHERE id = ?', [i, row[0] as string]);
			});
		}
	}
	await persist();
}

function ensureDB(): Database {
	if (!db) throw new Error('DB not initialized. Call initDB() first.');
	return db;
}

/** @internal For testing only. Replaces the module-level database instance. */
export function setTestDB(database: Database): void {
	db = database;
}

async function persist(): Promise<void> {
	const data = db!.export();
	await saveToIndexedDB(data);
}

function createGoal(habitId: string, goalCount: number, goalPeriod: string, from: string): void {
	const d = ensureDB();
	const id = crypto.randomUUID();
	d.run(
		'INSERT INTO goals (id, habit_id, goal_count, goal_period, "from", "to") VALUES (?, ?, ?, ?, ?, NULL)',
		[id, habitId, goalCount, goalPeriod, from]
	);
}

function closeGoal(habitId: string, now: string): void {
	const d = ensureDB();
	d.run(
		'UPDATE goals SET "to" = ? WHERE habit_id = ? AND "to" IS NULL',
		[now, habitId]
	);
}

function getGoalForDate(habitId: string, dateStr: string): { goalCount: number; goalPeriod: string } {
	const d = ensureDB();
	const rows = d.exec(
		'SELECT goal_count, goal_period FROM goals WHERE habit_id = ? AND "from" <= ? AND ("to" IS NULL OR "to" > ?) LIMIT 1',
		[habitId, dateStr + 'T23:59:59', dateStr + 'T00:00:00']
	);
	if (rows.length > 0) {
		return { goalCount: rows[0].values[0][0] as number, goalPeriod: rows[0].values[0][1] as string };
	}
	const habit = getHabit(habitId);
	return { goalCount: habit?.goalCount ?? 1, goalPeriod: habit?.goalPeriod ?? 'daily' };
}

function getDate(date?: string): string {
	return date || getLocalDate();
}

export function createHabit(name: string, goalCount: number, goalPeriod: 'daily' | 'weekly'): Habit {
	const d = ensureDB();
	const id = crypto.randomUUID();
	const now = new Date().toISOString();
	const maxSORows = d.exec('SELECT COALESCE(MAX(sort_order), -1) FROM habits');
	const nextSO = (maxSORows[0].values[0][0] as number) + 1;
	d.run(
		'INSERT INTO habits (id, name, goal_count, goal_period, status, created_at, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
		[id, name, goalCount, goalPeriod, 'active', now, nextSO]
	);
	createGoal(id, goalCount, goalPeriod, now);
	persist();
	return { id, name, goalCount, goalPeriod, status: 'active', createdAt: now, sortOrder: nextSO };
}

export function getActiveHabits(): Habit[] {
	const d = ensureDB();
	const rows = d.exec('SELECT id, name, goal_count, goal_period, status, created_at, archived_at, sort_order FROM habits WHERE status = ? ORDER BY sort_order, created_at', ['active']);
	if (!rows.length) return [];
	return rows[0].values.map(mapRowToHabit);
}

export function getArchivedHabits(): HabitWithProgress[] {
	const d = ensureDB();
	const rows = d.exec('SELECT id, name, goal_count, goal_period, status, created_at, archived_at, sort_order FROM habits WHERE status = ? ORDER BY created_at', ['archived']);
	if (!rows.length) return [];
	return rows[0].values.map(mapRowToHabit).map(h => {
		const progress = Math.min(getProgress(h.id), h.goalCount);
		return { ...h, progress, isComplete: progress >= h.goalCount, score: getScore(h.id) };
	});
}

function mapRowToHabit(row: unknown[]): Habit {
	return {
		id: row[0] as string,
		name: row[1] as string,
		goalCount: row[2] as number,
		goalPeriod: row[3] as 'daily' | 'weekly',
		status: row[4] as 'active' | 'archived' | 'deleted',
		createdAt: row[5] as string,
		archivedAt: row[6] as string | undefined ?? undefined,
		sortOrder: row[7] as number
	};
}

export function updateHabit(id: string, name: string, goalCount: number, goalPeriod: 'daily' | 'weekly'): void {
	const d = ensureDB();
	const now = new Date().toISOString();
	d.run('UPDATE habits SET name = ?, goal_count = ?, goal_period = ? WHERE id = ?', [name, goalCount, goalPeriod, id]);
	closeGoal(id, now);
	createGoal(id, goalCount, goalPeriod, now);
	persist();
}

export function archiveHabit(id: string): void {
	const d = ensureDB();
	const now = new Date().toISOString();
	d.run("UPDATE habits SET status = ?, archived_at = ? WHERE id = ?", ['archived', now, id]);
	persist();
}

export function unarchiveHabit(id: string): void {
	const d = ensureDB();
	const now = new Date().toISOString();
	const maxSORows = d.exec('SELECT COALESCE(MAX(sort_order), -1) FROM habits');
	const nextSO = (maxSORows[0].values[0][0] as number) + 1;
	d.run("UPDATE habits SET status = ?, created_at = ?, archived_at = NULL, sort_order = ? WHERE id = ?", ['active', now, nextSO, id]);
	persist();
}

export function reorderHabits(orderedIds: string[]): void {
	const d = ensureDB();
	orderedIds.forEach((id, i) => {
		d.run('UPDATE habits SET sort_order = ? WHERE id = ?', [i, id]);
	});
	persist();
}

export function deleteHabit(id: string): void {
	const d = ensureDB();
	d.run('DELETE FROM log_entries WHERE habit_id = ?', [id]);
	d.run('DELETE FROM habits WHERE id = ?', [id]);
	persist();
}

export function logEntry(habitId: string, loggedAt?: string): LogEntry {
	const d = ensureDB();
	const habit = getHabit(habitId);
	if (!habit) throw new Error('Habit not found');

	const date = getDate(loggedAt);

	let periodStart: string;
	let periodEnd: string;

	if (habit.goalPeriod === 'daily') {
		periodStart = date;
		periodEnd = date;
	} else {
		const [y, m, d] = date.split('-').map(Number);
		const dt = new Date(y, m - 1, d);
		const day = dt.getDay();
		const diff = day === 0 ? -6 : 1 - day;
		const monday = new Date(dt);
		monday.setDate(dt.getDate() + diff);
		periodStart = getLocalDate(monday);
		const sunday = new Date(monday);
		sunday.setDate(monday.getDate() + 6);
		periodEnd = getLocalDate(sunday);
	}

	const rows = d.exec(
		'SELECT COUNT(*) FROM log_entries WHERE habit_id = ? AND logged_at >= ? AND logged_at <= ?',
		[habitId, periodStart, periodEnd]
	);
	const count = rows[0].values[0][0] as number;

	if (count >= habit.goalCount) {
		throw new Error(`Cap reached: habit '${habit.name}' already has ${count} entries in this period`);
	}

	const id = crypto.randomUUID();
	const now = new Date().toISOString();
	d.run(
		'INSERT INTO log_entries (id, habit_id, logged_at, created_at) VALUES (?, ?, ?, ?)',
		[id, habitId, date, now]
	);
	persist();
	return { id, habitId, loggedAt: date, createdAt: now };
}

export function removeLogEntry(id: string): void {
	const d = ensureDB();
	d.run('DELETE FROM log_entries WHERE id = ?', [id]);
	persist();
}

function getLocalDate(date?: Date): string {
	const d = date || new Date();
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

function getLocalDateAt(isoTimestamp: string): string {
	return getLocalDate(new Date(isoTimestamp));
}

function getPeriodBounds(goalPeriod: 'daily' | 'weekly'): { start: string; end: string } {
	const now = new Date();
	const today = getLocalDate(now);
	if (goalPeriod === 'daily') return { start: today, end: today };
	const day = now.getDay();
	const diff = day === 0 ? -6 : 1 - day;
	const monday = new Date(now);
	monday.setDate(now.getDate() + diff);
	return { start: getLocalDate(monday), end: today };
}

export function getProgress(habitId: string): number {
	const d = ensureDB();
	const habit = getHabit(habitId);
	if (!habit) return 0;
	const { start, end } = getPeriodBounds(habit.goalPeriod);
	const rows = d.exec(
		'SELECT COUNT(*) FROM log_entries WHERE habit_id = ? AND logged_at >= ? AND logged_at <= ?',
		[habitId, start, end]
	);
	return rows[0].values[0][0] as number;
}

export function getHabit(id: string): Habit | null {
	const d = ensureDB();
	const rows = d.exec('SELECT id, name, goal_count, goal_period, status, created_at, archived_at, sort_order FROM habits WHERE id = ?', [id]);
	if (!rows.length) return null;
	return mapRowToHabit(rows[0].values[0]);
}

export function getHabitsWithProgress(): HabitWithProgress[] {
	const habits = getActiveHabits();
	return habits.map(h => {
		const progress = Math.min(getProgress(h.id), h.goalCount);
		return { ...h, progress, isComplete: progress >= h.goalCount, score: getScore(h.id) };
	});
}

export function getScore(habitId: string): number {
	const d = ensureDB();
	const habit = getHabit(habitId);
	if (!habit || habit.status === 'deleted') return 0;

	const today = getLocalDate();
	const createdDate = getLocalDateAt(habit.createdAt);
	const cutoffDate = habit.archivedAt ? getLocalDateAt(habit.archivedAt) : today;

	const rows = d.exec(
		'SELECT substr(logged_at, 1, 10) as local_date, COUNT(*) as cnt FROM log_entries WHERE habit_id = ? AND substr(logged_at, 1, 10) < ? GROUP BY local_date',
		[habitId, cutoffDate]
	);

	const counts: Record<string, number> = {};
	if (rows.length) {
		for (const row of rows[0].values) {
			counts[row[0] as string] = row[1] as number;
		}
	}

	if (habit.goalPeriod === 'daily') {
		let score = 0;
		const [sy, sm, sd] = createdDate.split('-').map(Number);
		const [ey, em, ed] = cutoffDate.split('-').map(Number);
		const start = new Date(sy, sm - 1, sd);
		const end = new Date(ey, em - 1, ed);

		while (start < end) {
			const dateStr = getLocalDate(start);
			const goal = getGoalForDate(habitId, dateStr);
			const cnt = counts[dateStr] || 0;
			score += cnt >= goal.goalCount ? 1 : -1;
			start.setDate(start.getDate() + 1);
		}
		return score;
	} else {
		let score = 0;
		const [cy, cm, cd] = createdDate.split('-').map(Number);
		const created = new Date(cy, cm - 1, cd);
		const createdDay = created.getDay();
		const daysSinceMonday = createdDay === 0 ? 6 : createdDay - 1;
		const firstMonday = new Date(created);
		firstMonday.setDate(created.getDate() - daysSinceMonday);

		const [fy, fm, fd] = cutoffDate.split('-').map(Number);
		const cutoff = new Date(fy, fm - 1, fd);
		const cutoffDay = cutoff.getDay();
		const diff = cutoffDay === 0 ? -6 : 1 - cutoffDay;
		const thisMonday = new Date(cutoff);
		thisMonday.setDate(cutoff.getDate() + diff);

		const weekStart = new Date(firstMonday);
		while (weekStart < thisMonday) {
			const weekEnd = new Date(weekStart);
			weekEnd.setDate(weekStart.getDate() + 6);
			const weekStartStr = getLocalDate(weekStart);
			const goal = getGoalForDate(habitId, weekStartStr);

			let cnt = 0;
			const cursor = new Date(weekStart);
			while (cursor <= weekEnd) {
				cnt += counts[getLocalDate(cursor)] || 0;
				cursor.setDate(cursor.getDate() + 1);
			}
			score += cnt >= goal.goalCount ? 1 : -1;
			weekStart.setDate(weekStart.getDate() + 7);
		}
		return score;
	}
}

export function getPeriodBlocks(habitId: string, count: number = 10): PeriodBlock[] {
	const d = ensureDB();
	const habit = getHabit(habitId);
	if (!habit) return [];

	const today = getLocalDate();
	const cutoffDate = habit.archivedAt ? getLocalDateAt(habit.archivedAt) : today;
	const createdDate = getLocalDateAt(habit.createdAt);

	const rows = d.exec(
		'SELECT substr(logged_at, 1, 10) as local_date, COUNT(*) as cnt FROM log_entries WHERE habit_id = ? GROUP BY local_date',
		[habitId]
	);
	const counts: Record<string, number> = {};
	if (rows.length) {
		for (const row of rows[0].values) {
			counts[row[0] as string] = row[1] as number;
		}
	}

	const blocks: PeriodBlock[] = [];
	const msPerDay = 86400000;

	if (habit.goalPeriod === 'daily') {
		const [cy, cm, cd] = createdDate.split('-').map(Number);
		const [fy, fm, fd] = cutoffDate.split('-').map(Number);
		const created = new Date(cy, cm - 1, cd);
		const cutoff = new Date(fy, fm - 1, fd);
		const daysSinceCreation = Math.round((cutoff.getTime() - created.getTime()) / msPerDay) + 1;
		const effectiveCount = Math.min(count, Math.max(1, daysSinceCreation));

		for (let i = effectiveCount - 1; i >= 0; i--) {
			const d = new Date(cutoff);
			d.setDate(d.getDate() - i);
			const dateStr = getLocalDate(d);
			blocks.push({
				startDate: dateStr,
				complete: (counts[dateStr] || 0) >= habit.goalCount,
				isCurrent: dateStr === cutoffDate
			});
		}
	} else {
		const [cy, cm, cd] = createdDate.split('-').map(Number);
		const created = new Date(cy, cm - 1, cd);
		const createdDay = created.getDay();
		const daysSinceMonday = createdDay === 0 ? 6 : createdDay - 1;
		const firstMonday = new Date(created);
		firstMonday.setDate(created.getDate() - daysSinceMonday);

		const [fy, fm, fd] = cutoffDate.split('-').map(Number);
		const cutoff = new Date(fy, fm - 1, fd);
		const cutoffDay = cutoff.getDay();
		const diff = cutoffDay === 0 ? -6 : 1 - cutoffDay;
		const currentMonday = new Date(cutoff);
		currentMonday.setDate(cutoff.getDate() + diff);

		const weeksSinceFirst = Math.round((currentMonday.getTime() - firstMonday.getTime()) / (7 * msPerDay)) + 1;
		const effectiveCount = Math.min(count, Math.max(1, weeksSinceFirst));

		for (let i = effectiveCount - 1; i >= 0; i--) {
			const monday = new Date(currentMonday);
			monday.setDate(monday.getDate() - i * 7);
			const mondayStr = getLocalDate(monday);

			const isCurrent = mondayStr === getLocalDate(currentMonday);

			let entryCount = 0;
			const sunday = new Date(monday);
			sunday.setDate(monday.getDate() + 6);
			const cursor = new Date(monday);
			while (cursor <= sunday) {
				entryCount += counts[getLocalDate(cursor)] || 0;
				cursor.setDate(cursor.getDate() + 1);
			}

			blocks.push({
				startDate: mondayStr,
				complete: entryCount >= habit.goalCount,
				isCurrent
			});
		}
	}

	return blocks;
}

export function getLogCountsByDate(habitId: string): Record<string, number> {
	const d = ensureDB();
	const rows = d.exec(
		'SELECT substr(logged_at, 1, 10) as local_date, COUNT(*) as cnt FROM log_entries WHERE habit_id = ? GROUP BY local_date',
		[habitId]
	);
	const counts: Record<string, number> = {};
	if (rows.length) {
		for (const row of rows[0].values) {
			counts[row[0] as string] = row[1] as number;
		}
	}
	return counts;
}

export function removeLogEntriesForDate(habitId: string, date: string): void {
	const d = ensureDB();
	d.run('DELETE FROM log_entries WHERE habit_id = ? AND substr(logged_at, 1, 10) = ?', [habitId, date]);
	persist();
}

export function getLogEntries(habitId: string): LogEntry[] {
	const d = ensureDB();
	const rows = d.exec(
		'SELECT id, habit_id, logged_at, created_at FROM log_entries WHERE habit_id = ? ORDER BY logged_at DESC',
		[habitId]
	);
	if (!rows.length) return [];
	return rows[0].values.map((row: unknown[]) => ({
		id: row[0] as string,
		habitId: row[1] as string,
		loggedAt: row[2] as string,
		createdAt: row[3] as string
	}));
}
