// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	integrations: [
		starlight({
			title: 'MyMusic Hub',
			sidebar: [
				{
					label: 'Audio & Music',
					items: [
						{ label: 'Hardware Audio', slug: 'audio/hardware' },
						{ label: 'Software Audio', slug: 'audio/software' },
						{ label: 'Theory', slug: 'audio/theory' },
						{
							label: 'Songwriting',
							collapsed: true,
							items: [
								{
									label: 'Melodie & Harmonie Framework',
									slug: 'songwriting/melodie_und_harmonie_framework_theorie_referenz',
								},
								{
									label: 'Projekt: Basic Rock Track',
									collapsed: true,
									items: [
										{
											label: 'Basic Rock Track - Schritt 0: Komposition & Arrangement',
											slug: 'songwriting/rock_track_schritt_1_komposition_arrangement',
										},
										{
											label: 'Basic Rock Track - Schritt 1: DAW Produktion & Setup',
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
						{ label: 'Hardware Video', slug: 'video/hardware' },
						{ label: 'Software Video', slug: 'video/software' },
					],
				},
			],
		}),
	],
});
