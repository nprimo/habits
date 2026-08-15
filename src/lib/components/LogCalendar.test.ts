import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('$lib/db', () => ({
	getLogCountsByDate: vi.fn(() => ({})),
	logEntry: vi.fn(),
	removeLogEntriesForDate: vi.fn()
}));

import LogCalendar from './LogCalendar.svelte';
import type { Habit } from '$lib/types';

describe('LogCalendar weekly periods', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-09-10T12:00:00.000Z'));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('shows weeks overlapping the viewed month at both boundaries', () => {
		const habit: Habit = {
			id: 'weekly-habit',
			name: 'Weekly habit',
			goalCount: 1,
			goalPeriod: 'weekly',
			status: 'active',
			createdAt: '2026-07-01T12:00:00.000Z',
			sortOrder: 0
		};
		const target = document.createElement('div');
		const component = mount(LogCalendar, { target, props: { habit } });

		target.querySelector<HTMLButtonElement>('[aria-label="Previous month"]')!.click();
		flushSync();

		const ranges = [...target.querySelectorAll('.week-range')].map((node) => node.textContent);
		expect(ranges).toEqual([
			'Jul 27 – Aug 2',
			'Aug 3 – Aug 9',
			'Aug 10 – Aug 16',
			'Aug 17 – Aug 23',
			'Aug 24 – Aug 30',
			'Aug 31 – Sep 6'
		]);

		unmount(component);
	});
});
