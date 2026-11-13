// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import { unified } from "@astrojs/markdown-remark";
import remarkMath from "remark-math";
// @ts-ignore - rehype-katex liefert keine eigenen TS-Deklarationsdateien mit
import rehypeKatex from "rehype-katex";

// https://astro.build/config
export default defineConfig({
  site: "http://localhost:8888",
  output: "static",
  markdown: {
    processor: unified({
      // @ts-ignore - Behebt die Diskrepanz zwischen unist-Node und mdast-Root
      remarkPlugins: [remarkMath],
      // @ts-ignore
      rehypePlugins: [rehypeKatex],
    }),
  },
  vite: {
    build: {
      chunkSizeWarningLimit: 1500, // Erhöht das Warnlimit von 500 kB auf 1500 kB
    },
  },
  integrations: [
    starlight({
      title: "Mein Musik-Hub",
      disable404Route: true,
      locales: {
        root: {
          label: "Deutsch",
          lang: "de",
        },
      },
      defaultLocale: "root",
      customCss: ["/src/styles/sidebar.css", "katex/dist/katex.min.css"],
      sidebar: [
        {
          label: "Projektierung",
          items: [{ label: "Beiträge", slug: "projektierung/beitraege" }],
        },
        {
          label: "Audio & Musik",
          items: [
            {
              label: "Musiktheorie",
              collapsed: false,
              items: [
                {
                  label: "Level 100: Elementarlehre",
                  collapsed: false,
                  items: [{ autogenerate: { directory: "audio/theory/100" } }],
                },
                {
                  label: "Level 200: Harmonie & Akkorde",
                  collapsed: false,
                  items: [{ autogenerate: { directory: "audio/theory/200" } }],
                },
                {
                  label: "Level 300: Multi-Instrumentierung",
                  collapsed: true,
                  items: [{ autogenerate: { directory: "audio/theory/300" } }],
                },
                {
                  label: "Level 400: DAW & Produktion",
                  collapsed: true,
                  items: [{ autogenerate: { directory: "audio/theory/400" } }],
                },
                {
                  label: "Level 500: Band & Performance",
                  collapsed: true,
                  items: [{ autogenerate: { directory: "audio/theory/500" } }],
                },
              ],
            },
            {
              label: "Songwriting",
              collapsed: true,
              items: [
                {
                  label: "Projekt: Rock-Arrangement",
                  collapsed: true,
                  items: [
                    {
                      label: "Schritt 0: Komposition",
                      slug: "audio/songwriting/rock-komposition",
                    },
                    {
                      label: "Schritt 1: Produktion (Refrain)",
                      slug: "audio/songwriting/rock-produktion",
                    },
                    {
                      label: "Schritt 2: Songstruktur",
                      slug: "audio/songwriting/rock-songstruktur",
                    },
                    {
                      label: "Schritt 3: Produktion (Strophe & Vor-Refrain)",
                      slug: "audio/songwriting/rock-produktion2",
                    },
                    {
                      label:
                        "Schritt 4: Produktion (Strophe 2 & Vor-Refrain 2)",
                      slug: "audio/songwriting/rock-produktion3",
                    },
                    {
                      label: "Schritt 5: Produktion (Bridge, Finale & Intro)",
                      slug: "audio/songwriting/rock-produktion4",
                    },
                  ],
                },
              ],
            },
            {
              label: "Referenz & Werkzeuge",
              collapsed: true,
              items: [
                {
                  label: "Audio-Hardware",
                  slug: "audio/referenzen-werkzeuge/hardware",
                },
                {
                  label: "Features",
                  collapsed: true,
                  items: [
                    {
                      label: "Übersicht",
                      slug: "audio/referenzen-werkzeuge/visualisierungen-erklaert",
                    },
                    {
                      label: "Notation.astro",
                      slug: "audio/referenzen-werkzeuge/visualisierungen-erklaert/notensystem",
                    },
                    {
                      label: "NotationBuilder.astro",
                      slug: "audio/referenzen-werkzeuge/visualisierungen-erklaert/notationbuilder",
                    },
                  ],
                },
                {
                  label: "Akkordmuster",
                  slug: "audio/referenzen-werkzeuge/akkordmuster",
                },
                {
                  label: "EXP und Tags",
                  slug: "audio/referenzen-werkzeuge/exp-und-tags",
                },
              ],
            },
          ],
        },
      ],
    }),
  ],
});
