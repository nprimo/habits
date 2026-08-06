import { json, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = ({ locals }) => {
	return json({ ok: true, user: locals.user?.email ?? null });
};