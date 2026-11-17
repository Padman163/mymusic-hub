import { defineCollection } from "astro:content";
import { docsLoader, i18nLoader } from "@astrojs/starlight/loaders";
import { docsSchema, i18nSchema } from "@astrojs/starlight/schema";
import { z } from "astro/zod";

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      extend: z.object({
        template: z.enum(["doc", "splash", "wide-content"]).default("doc"),

        // Einordnung im Gesamtkurs
        scope: z
          .enum(["theory", "instrument", "production", "band"])
          .optional(),
        level: z.number().optional(), // z. B. 0, 100, 200, 300
        dStage: z.enum(["D1", "D2", "D3"]).optional(),

        // Instrumentenspezifische Felder (nur bei scope: 'instrument')
        instrument: z
          .enum(["gitarre", "keys", "drums", "bass", "vocals"])
          .optional(),
        theoryRef: z.string().optional(), // Slug der zugehörigen Theorie-Lektion
        prerequisites: z.array(z.string()).optional(), // Vorherige Pflicht-Lektionen

        // Gamification & Aufgaben-Gewichtung
        xpReward: z.number().default(100),
        tags: z.array(z.string()).optional(), // z. B. ['Allgemein', 'Notensystem', 'Tabulatur']
      }),
    }),
  }),
  i18n: defineCollection({
    loader: i18nLoader(),
    schema: i18nSchema(),
  }),
};
