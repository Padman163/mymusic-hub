// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	integrations: [
		starlight({
			title: 'My Docs',
			sidebar: [
				{
					label: 'Audio & Music',
					items: [
						{ label: 'Hardware & Routing', slug: 'audio/hardware' },
						{ label: 'Software', slug: 'audio/software' },
					
					],
				},
				{
					label: 'Reference',
					items: [{ autogenerate: { directory: 'reference' } }],
				},
			],
		}),
	],
});
