import { dev } from '$app/environment';
import type { Handle, HandleServerError } from '@sveltejs/kit';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import { error } from '@sveltejs/kit';

const JWKS_CACHE = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJWKS(teamDomain: string) {
	let jwks = JWKS_CACHE.get(teamDomain);
	if (!jwks) {
		jwks = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`));
		JWKS_CACHE.set(teamDomain, jwks);
	}
	return jwks;
}

export const handle: Handle = async ({ event, resolve }) => {
	if (dev) {
		event.locals.user = null;
		return resolve(event);
	}

	const teamDomain = event.platform?.env.TEAM_DOMAIN;
	const policyAud = event.platform?.env.POLICY_AUD;
	const token = event.request.headers.get('cf-access-jwt-assertion');

	if (!teamDomain || !policyAud) {
		console.error('[hooks] auth env not configured: TEAM_DOMAIN or POLICY_AUD missing');
		throw error(500, { message: 'Server auth misconfigured' });
	}

	if (!token) {
		throw error(401, { message: 'Unauthorized' });
	}

	let payload;
	try {
		const verified = await jwtVerify(token, getJWKS(teamDomain), {
			issuer: teamDomain,
			audience: policyAud
		});
		payload = verified.payload;
	} catch (err) {
		console.error('[hooks] JWT verification failed:', err);
		throw error(401, { message: 'Unauthorized' });
	}

	const email = payload.email;
	if (typeof email === 'string' && email.length > 0) {
		event.locals.user = { email, plan: 'paid' };
	} else {
		throw error(401, { message: 'Unauthorized' });
	}

	return resolve(event);
};

export const handleError: HandleServerError = async ({ error, event }) => {
	console.error('[handleError] path=', event.url.pathname, 'error=', error);
	return {
		message: 'Internal Server Error'
	};
};