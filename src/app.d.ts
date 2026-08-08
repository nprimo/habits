// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
	namespace App {
		interface Locals {
			user: { email: string; plan: 'paid' } | null;
		}
		interface Platform {
			env: Env;
			context: ExecutionContext;
			caches: CacheStorage;
		}
	}
}

export {};