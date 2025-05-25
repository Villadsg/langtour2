import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	// Make sure Vite properly exposes environment variables
	define: {
		// Expose all environment variables that start with PUBLIC_ or VITE_
		...Object.fromEntries(
			Object.entries(process.env)
			.filter(([key]) => key.startsWith('PUBLIC_') || key.startsWith('VITE_'))
			.map(([key, val]) => [`import.meta.env.${key}`, JSON.stringify(val)])
		)
	}
});
