import { defineCollection } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { z } from 'astro:content';

export const collections = {
	docs: defineCollection({
		loader: docsLoader(),
		schema: docsSchema({
			extend: z.object({
				tags: z.array(z.string()).optional(),
				difficulty: z.enum(['Basis', 'Mittel', 'Fortgeschritten', 'Master']).optional(),
				dLevel: z.enum(['D1', 'D2', 'D3', 'Produktion']).optional(),
				xpReward: z.number().optional(),
			}),
		}),
	}),
};
