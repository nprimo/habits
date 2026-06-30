export interface Habit {
	id: string;
	name: string;
	goalCount: number;
	goalPeriod: 'daily' | 'weekly';
	status: 'active' | 'archived' | 'deleted';
	createdAt: string;
}

export interface LogEntry {
	id: string;
	habitId: string;
	loggedAt: string;
	createdAt: string;
}

export interface HabitWithProgress extends Habit {
	progress: number;
	isComplete: boolean;
}
