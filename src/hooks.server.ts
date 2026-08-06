import type { Handle } from '@sveltejs/kit';
import { jwtVerify, createRemoteJWKSet } from 'jose';

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
	const teamDomain = event.platform?.env.TEAM_DOMAIN;
	const policyAud = event.platform?.env.POLICY_AUD;
	const token = event.request.headers.get('cf-access-jwt-assertion');

	if (!teamDomain || !policyAud || !token) {
		event.locals.user = null;
		return resolve(event);
	}

	try {
		const { payload } = await jwtVerify(token, getJWKS(teamDomain), {
			issuer: teamDomain,
			audience: policyAud
		});
		const email = payload.email;
		if (typeof email === 'string' && email.length > 0) {
			event.locals.user = { email, plan: 'paid' };
		} else {
			event.locals.user = null;
		}
	} catch {
		event.locals.user = null;
	}

	return resolve(event);
};