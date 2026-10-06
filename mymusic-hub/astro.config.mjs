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
						{ label: 'Hardware Audio', slug: 'audio/hardware' },
						{ label: 'Software Audio', slug: 'audio/software' },
					
					],
				},
				{
					label: 'Video & Streaming', 
					items: [
						{ label: 'Hardware Video', slug: 'video/hardware' },
						{ label: 'Software Video', slug: 'video/software' },
					],
				},
			],
		}),
	],
});
