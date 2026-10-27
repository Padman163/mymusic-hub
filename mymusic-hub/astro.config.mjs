// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { unified } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// https://astro.build/config
export default defineConfig({
	markdown: {
		processor: unified({
			remarkPlugins: [remarkMath],
			rehypePlugins: [rehypeKatex],
		}),
	},
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
			customCss: ['/src/styles/sidebar.css', 'katex/dist/katex.min.css'],
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
									label: 'Projekt: Rock-Arrangement',
									collapsed: true,
									items: [
										{
											label: 'Schritt 0: Komposition',
											slug: 'songwriting/rock-komposition',
										},
										{
											label: 'Schritt 1: Produktion (Refrain)',
											slug: 'songwriting/rock-produktion',
										},
																				{
											label: 'Schritt 2: Songstruktur',
											slug: 'songwriting/rock-songstruktur',
										},
																				{
											label: 'Schritt 3: Produktion (Strophe & Vor-Refrain)',
											slug: 'songwriting/rock-produktion2',
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
