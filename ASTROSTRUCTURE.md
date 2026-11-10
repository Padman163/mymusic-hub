# Astro Web-App-Architektur nach dem Lego-Prinzip

Dieses Dokument definiert den architektonischen Standard für modulare, wartbare und skalierbare Webanwendungen auf Basis von Astro. Es erläutert das **Lego-Prinzip (Separation of Concerns & Kapselung)** und unterscheidet strikt zwischen dem minimal notwendigen Kern und optionalen Erweiterungsbausteinen.

---

## 1. Das Lego-Prinzip: Grundphilosophie

Das Lego-Prinzip besagt, dass eine Web-Applikation aus austauschbaren, in sich geschlossenen Standardbausteinen besteht:
1. **Atome (UI-Präsentation):** Reine visuelle Komponenten ohne Geschäftslogik (z. B. Badges, Buttons, Notenköpfe).
2. **Moleküle (Manager-Komponenten):** Bündeln mehrere Atome und verwalten lokalen Zustand oder Interaktion (z. B. DrumPattern, Akkorddiagramm).
3. **Domänenlogik (TypeScript-Kern):** Liegt vollständig außerhalb der UI in `src/lib/` und enthält Algorithmen, Daten-Transformationen und Berechnungen (z. B. Intervallmathematik, SVG-Pfadberechnung).
4. **Seiten & Content (Zusammenbau):** MDX-Seiten oder Astro-Pages fungieren lediglich als Bauplan, der Bausteine zusammensetzt und mit deklarativen Parametern (Props) füttert.
5. **Zero-JS-Baseline:** Standardmäßig liefert Astro $0\ \text{KB}$ Client-JavaScript aus. Interaktive Inseln (`client:load`, `client:visible`) werden gezielt nur dort aktiviert, wo Benutzerinteraktion stattfindet.

---

## 2. Minimaler Kern: Was ist zwingend nötig?

Um ein valides, lauffähiges Astro-Projekt zu betreiben, sind ausschließlich folgende Elemente unverzichtbar:

```text
mein-minimal-projekt/
├── public/
│   └── favicon.svg             # Browser-Icon
├── src/
│   ├── layouts/
│   │   └── BaseLayout.astro    # Minimales HTML-Gerüst (<html>, <head>, <body>, <slot />)
│   └── pages/
│       ├── index.astro         # Einstiegsseite (Landingpage / Route '/')
│       └── 404.astro           # Pflicht-Fehlerseite für ungültige URLs
├── astro.config.mjs            # Konfiguration mit Angabe der kanonischen 'site'-URL
├── package.json                # Skripte (dev, build, preview) und Astro-Kernpaket
└── tsconfig.json               # TypeScript-Konfiguration (mindestens "extends": "astro/tsconfigs/strict")
```

### Der minimale Konfigurations-Standard (`astro.config.mjs`)
```javascript
// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  // Zwingend erforderlich für korrekte Canonical-Tags und Sitemap-Erstellung
  site: 'https://deine-domain.de',
  output: 'static', // Reine Static Site Generation (SSG)
});
```

---

## 3. Optionale Erweiterungsbausteine (Das Baukastensystem)

Je nach Projektziel kann die Applikation modular erweitert werden, ohne die Kernarchitektur zu destabilisieren:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                          OPTIONALE LEGO-BAUSTEINE                           │
├───────────────────────┬─────────────────────────────┬───────────────────────┤
│ Content & Dokumentation│ Interaktivität & State      │ Backend & Persistenz  │
│ ├─ Starlight Doku-UI  │ ├─ Islands (client:load)    │ ├─ Serverless Funcs   │
│ ├─ Zod Content Schema │ ├─ Web Components           │ ├─ GitHub REST Store  │
│ └─ KaTeX / MathML     │ └─ Nano Stores / LocalState │ └─ SSR-Adapter (Node) │
├───────────────────────┼─────────────────────────────┼───────────────────────┤
│ Design & Assets       │ Testing & Hygiene           │ SEO & Optimierung     │
│ ├─ Design-Tokens (CSS)│ ├─ Biome Linter / Formatter │ ├─ @astrojs/sitemap   │
│ ├─ Webfonts (Bravura) │ ├─ Vitest (Unit & DOM)      │ ├─ WebP/AVIF Pipeline │
│ └─ Tailwind / Modules │ └─ Playwright (E2E & Visual)│ └─ OpenGraph Engine   │
└───────────────────────┴─────────────────────────────┴───────────────────────┘
```

### 3.1 Content Layer & Typensicherheit (Content Collections)
* **Zweck:** Verwaltung strukturierter Markdown/MDX-Inhalte mit automatischer Frontmatter-Validierung über Zod.
* **Datei:** `src/content.config.ts` (Astro 5 Content Layer API)
```typescript
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const docs = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/docs' }),
  schema: z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

export const collections = { docs };
```

### 3.2 Dokumentations-Framework (`@astrojs/starlight`)
* **Zweck:** Bietet ein responsives Navigations- und Dokumentationsgerüst mit hierarchischer Sidebar, Suche und Mehrsprachigkeit.
* **Integration:** Wird in `astro.config.mjs` eingebunden und steuert Seiten unter `src/content/docs/`.

### 3.3 Mathematische & Musikalische Notation (KaTeX / Bravura)
* **Zweck:** Rendern von Formeln, Akkordsymbolen und Notenglyphen.
* **Module:** `remark-math` und `rehype-katex` verarbeiten LaTeX-Code wie `$C_{maj7}$` direkt in HTML.
* **SMuFL-Webfonts:** Lokale Einbindung von Standard Music Font Layout (z. B. Bravura) in `public/fonts/`.

### 3.4 Serverless Backend & Persistenz (Netlify Functions)
* **Zweck:** Bereitstellung serverseitiger API-Endpunkte für dynamische Daten wie Kommentare, IssueTracker oder Formulare.
* **Verzeichnis:** `netlify/functions/` (z. B. `contributions.ts`).
* **Datenspeicher:** JSON-basierte Datenspeicherung über die GitHub REST API oder Anbindung an SQLite/PostgreSQL.

---

## 4. Standardisierte Verzeichnisstruktur

Die folgende Baumstruktur zeigt das Zusammenspiel aller Ebenen nach dem Lego-Prinzip:

```text
mein-projekt/
├── public/                     # Reine statische Assets (unverändert ausgeliefert)
│   ├── favicon.svg             # Vektor-Favicon
│   ├── robots.txt              # Suchmaschinen-Anweisung
│   └── fonts/                  # DSGVO-konforme lokale Webfonts (z. B. Bravura)
├── src/
│   ├── assets/                 # Lokale Bilder für Astros responsive Bildpipeline
│   ├── components/             # Modulare Komponenten
│   │   ├── ui/                 # Atome: Buttons, Badges, Icons, Tabs (zustandslos)
│   │   ├── features/           # Moleküle: Manager-Komponenten (Fretboard, Pattern)
│   │   └── notation/           # Spezialisierte Vektor-Notations-Bausteine
│   ├── content/                # Strukturierte Inhalte
│   │   └── docs/               # Lektionen und Dokumentationsartikel (.md, .mdx)
│   ├── content.config.ts       # Zod-Typvalidierung für Content-Sammlungen
│   ├── layouts/                # HTML-Grundgerüste (<BaseLayout.astro>)
│   ├── lib/                    # Reine Geschäftslogik (100% TypeScript, kein HTML)
│   │   ├── notation-renderer.ts# Geometrieberechnungen und SVG-Generierung
│   │   └── music-math.ts       # Frequenzen, Tonhöhen und Takteinteilung
│   ├── pages/                  # Datei-basiertes Routing (404.astro, index.astro)
│   └── styles/                 # Schichtenbasierte Stylesheets
│       ├── variables.css       # Design-Tokens (Farben, Abstände, Typografie)
│       ├── layout.css          # Struktur- und Container-Regeln
│       └── components.css      # Globale Komponentenstile
├── tests/                      # Automatisierte Testsuiten nach Pyramidenstufen
│   ├── unit/                   # Reine Logiktests (*.unit.test.ts)
│   ├── components/             # DOM- und Interaktionstests (*.comp.test.ts)
│   ├── integration/            # API- und Serverless-Mocks (*.int.test.ts)
│   └── e2e/                    # Playwright Browsertests (*.spec.ts)
├── netlify/                    # Serverless Backend
│   └── functions/              # Netlify API-Endpunkte
├── data/                       # Datendateien (z. B. contributions.json)
├── astro.config.mjs            # Zentrale Framework-Konfiguration
├── biome.json                  # Konfiguration für Linter & Formatter
├── package.json                # Skripte und Paketabhängigkeiten
└── tsconfig.json               # Strikte TypeScript-Compileroptionen
```