import initSqlJs, { type Database } from 'sql.js';
import type { Habit, HabitWithProgress, LogEntry } from './types';

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
			created_at TEXT NOT NULL
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
	await persist();
}

function ensureDB(): Database {
	if (!db) throw new Error('DB not initialized. Call initDB() first.');
	return db;
}

async function persist(): Promise<void> {
	const data = db!.export();
	await saveToIndexedDB(data);
}

function getDate(date?: string): string {
	return date || new Date().toISOString().slice(0, 10);
}

export function createHabit(name: string, goalCount: number, goalPeriod: 'daily' | 'weekly'): Habit {
	const d = ensureDB();
	const id = crypto.randomUUID();
	const now = new Date().toISOString();
	d.run(
		'INSERT INTO habits (id, name, goal_count, goal_period, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
		[id, name, goalCount, goalPeriod, 'active', now]
	);
	persist();
	return { id, name, goalCount, goalPeriod, status: 'active', createdAt: now };
}

export function getActiveHabits(): Habit[] {
	const d = ensureDB();
	const rows = d.exec('SELECT id, name, goal_count, goal_period, status, created_at FROM habits WHERE status = ? ORDER BY created_at', ['active']);
	if (!rows.length) return [];
	return rows[0].values.map(mapRowToHabit);
}

export function getArchivedHabits(): Habit[] {
	const d = ensureDB();
	const rows = d.exec('SELECT id, name, goal_count, goal_period, status, created_at FROM habits WHERE status = ? ORDER BY created_at', ['archived']);
	if (!rows.length) return [];
	return rows[0].values.map(mapRowToHabit);
}

function mapRowToHabit(row: unknown[]): Habit {
	return {
		id: row[0] as string,
		name: row[1] as string,
		goalCount: row[2] as number,
		goalPeriod: row[3] as 'daily' | 'weekly',
		status: row[4] as 'active' | 'archived' | 'deleted',
		createdAt: row[5] as string
	};
}

export function updateHabit(id: string, name: string, goalCount: number, goalPeriod: 'daily' | 'weekly'): void {
	const d = ensureDB();
	d.run('UPDATE habits SET name = ?, goal_count = ?, goal_period = ? WHERE id = ?', [name, goalCount, goalPeriod, id]);
	persist();
}

export function archiveHabit(id: string): void {
	const d = ensureDB();
	d.run("UPDATE habits SET status = ? WHERE id = ?", ['archived', id]);
	persist();
}

export function unarchiveHabit(id: string): void {
	const d = ensureDB();
	d.run("UPDATE habits SET status = ? WHERE id = ?", ['active', id]);
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
	const id = crypto.randomUUID();
	const date = getDate(loggedAt);
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

function getPeriodBounds(goalPeriod: 'daily' | 'weekly'): { start: string; end: string } {
	const now = new Date();
	if (goalPeriod === 'daily') {
		const start = now.toISOString().slice(0, 10);
		return { start, end: start };
	}
	const day = now.getDay();
	const diff = day === 0 ? -6 : 1 - day;
	const monday = new Date(now);
	monday.setDate(now.getDate() + diff);
	const start = monday.toISOString().slice(0, 10);
	return { start, end: now.toISOString().slice(0, 10) };
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
	const rows = d.exec('SELECT id, name, goal_count, goal_period, status, created_at FROM habits WHERE id = ?', [id]);
	if (!rows.length) return null;
	return mapRowToHabit(rows[0].values[0]);
}

export function getHabitsWithProgress(): HabitWithProgress[] {
	const habits = getActiveHabits();
	return habits.map(h => {
		const progress = getProgress(h.id);
		return { ...h, progress, isComplete: progress >= h.goalCount };
	});
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
