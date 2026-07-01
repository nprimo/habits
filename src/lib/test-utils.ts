import initSqlJs, { type Database } from 'sql.js';

export async function createTestDB(): Promise<Database> {
	const SQL = await initSqlJs();
	const db = new SQL.Database();

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

	return db;
}

export interface SeedHabitOpts {
	id?: string;
	name?: string;
	goalCount?: number;
	goalPeriod?: 'daily' | 'weekly';
	status?: 'active' | 'archived' | 'deleted';
	createdAt?: string;
	archivedAt?: string | null;
}

export function seedHabit(db: Database, opts: SeedHabitOpts = {}): string {
	const id = opts.id ?? crypto.randomUUID();
	const now = new Date().toISOString();

	db.run(
		`INSERT INTO habits (id, name, goal_count, goal_period, status, created_at, archived_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		[
			id,
			opts.name ?? 'Test Habit',
			opts.goalCount ?? 1,
			opts.goalPeriod ?? 'daily',
			opts.status ?? 'active',
			opts.createdAt ?? now,
			opts.archivedAt ?? null,
		]
	);

	return id;
}

export interface SeedLogEntryOpts {
	id?: string;
	habitId: string;
	loggedAt?: string;
}

export function seedLogEntry(db: Database, opts: SeedLogEntryOpts): string {
	const id = opts.id ?? crypto.randomUUID();
	const now = new Date().toISOString();

	db.run(
		`INSERT INTO log_entries (id, habit_id, logged_at, created_at)
		 VALUES (?, ?, ?, ?)`,
		[id, opts.habitId, opts.loggedAt ?? now.slice(0, 10), now]
	);

	return id;
}

export function cleanupDB(db: Database): void {
	db.close();
}
