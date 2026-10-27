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
									label: 'Melodie- und Harmonieleitfaden',
									slug: 'songwriting/melodie_und_harmonie_framework_theorie_referenz',
								},
								{
									label: 'Projekt: Einfacher Rocksong',
									collapsed: true,
									items: [
										{
											label: 'Einfacher Rocksong – Schritt 0: Komposition & Arrangement',
											slug: 'songwriting/rock_track_schritt_1_komposition_arrangement',
										},
										{
											label: 'Einfacher Rocksong – Schritt 1: DAW-Produktion & Einrichtung',
											slug: 'songwriting/rock_track_1_daw_production_setup_log',
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
