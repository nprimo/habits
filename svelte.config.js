import adapter from '@sveltejs/adapter-cloudflare';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			fallback: 'plaintext',
			platformProxy: {
				environment: undefined,
				persist: undefined
			}
		})
	}
};

export default config;
