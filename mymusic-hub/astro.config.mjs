// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	integrations: [
		starlight({
			title: 'Mein Musik-Hub',
			locales: {
				root: {
					label: 'Deutsch',
					lang: 'de',
				},
			},
			defaultLocale: 'root',
			sidebar: [
				{
					label: 'Audio & Musik',
					items: [
						{ label: 'Audio-Hardware', slug: 'audio/hardware' },
						{ label: 'Audio-Software', slug: 'audio/software' },
						{ label: 'Musiktheorie', slug: 'audio/theory' },
						{
							label: 'Songwriting',
							collapsed: true,
							items: [
								{
									label: 'Melodie & Harmonie',
									slug: 'songwriting/melodie-harmonie',
								},
								{
									label: 'Rocksong',
									collapsed: true,
									items: [
										{
											label: 'Schritt 0: Komposition',
											slug: 'songwriting/rock-komposition',
										},
										{
											label: 'Schritt 1: Produktion',
											slug: 'songwriting/rock-produktion',
										},
									],
								},
							],
						},
					],
				},
				{
					label: 'Video & Streaming',
					items: [
						{ label: 'Video-Hardware', slug: 'video/hardware' },
						{ label: 'Video-Software', slug: 'video/software' },
					],
				},
			],
		}),
	],
});
