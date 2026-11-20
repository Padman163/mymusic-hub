# Astro-Architektur nach dem Lego-Prinzip

Dieser Leitfaden unterscheidet allgemeine Architekturprinzipien vom aktuellen Aufbau des Musik-Hubs. Für Einrichtung und Befehle siehe [Workspace-Setup](README_WORKSPACE_SETUP.md) und [Cheatsheet](README_CHEATSHEET.md); die Qualitätssicherung steht im [Testing-Leitfaden](README_TESTING.md).

## 1. Grundprinzipien

- **Präsentation:** Wiederverwendbare Komponenten übernehmen klar abgegrenzte Darstellungsaufgaben.
- **Zusammenbau:** Astro-Komponenten und MDX-Seiten kombinieren Bausteine über deklarative Props.
- **Logik:** Fachliche Berechnungen und Datenverarbeitung nach Möglichkeit getrennt von der Darstellung halten. In `src/lib/` liegen neben reiner Fachlogik auch bewusst clientseitige DOM-Controller und Speicherlogik.
- **Interaktivität:** Astro rendert Komponenten grundsätzlich zu HTML, ohne automatisch Framework-Komponenten zu hydratisieren. Interaktive Funktionen können gezielt über Client-Skripte oder Framework-Islands eingebunden werden. Der Musik-Hub verwendet unter anderem `<script>`-Blöcke; eine pauschale Aussage von 0 KB JavaScript pro Seite wäre daher falsch.
- **Notation:** Gemeinsame Notationselemente über den Renderer und wiederverwendbare Komponenten darstellen, statt für einzelne Seiten eigene Renderer anzulegen. Einzelheiten stehen in der [Notationsreferenz](features/README_FEAT_NOTATION.md).

## 2. Allgemeines Astro-Minimalbeispiel

Ein neues Projekt benötigt Astro als Abhängigkeit und mindestens eine Route für die gewünschte Seite. Für eine Starlight-Dokumentation kommt die Starlight-Integration hinzu. Ein eigenes Layout, `public/`, ein Favicon, eine eigene 404-Seite und eine kanonische URL sind je nach Bedarf sinnvoll, aber keine allgemeinen Voraussetzungen für ein lauffähiges Astro-Projekt.

Ein neues Starlight-Projekt kann beispielsweise so angelegt werden; für einen bestehenden Workspace stattdessen dem [Workspace-Setup](README_WORKSPACE_SETUP.md) folgen:

```bash
npm create astro@latest mein-projekt -- --template starlight
cd mein-projekt
npm install
```

Beispiel einer Konfiguration mit Platzhalter für die tatsächliche Produktionsdomain:

```javascript
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://deine-domain.netlify.app',
  integrations: [starlight({ title: 'Mein Musik-Hub' })],
});
```

Dies ist **nicht** die aktuelle Konfiguration dieses Repositories. Hier steht in `astro.config.mjs` derzeit `site: "http://localhost:8888"` und `output: "static"`. Vor einem Produktionsdeployment sollte die kanonische URL bewusst geprüft werden.

## 3. Aktueller Aufbau des Musik-Hubs

### 3.1 Content und Starlight

Starlight liefert Dokumentationslayout, Navigation und Suche. `astro.config.mjs` konfiguriert die Sidebar; die Inhalte liegen in `src/content/docs/`.

Die Sidebar gliedert sich in dieser Reihenfolge in **Admin** (Konten & Einladungen, Datenstand & Backups, Beiträge, Modul-Builder, Modularchiv und Admin-Wiki), **Bediener** (Dashboard, Lernpfad und zugehörige Bereiche) und **Sonstiges** (Wiki, bisherige Lehrgänge Level 100-500 inklusive Gitarrenlehre, Songwriting, Referenz & Werkzeuge). Beiträge und Modul-Builder liegen direkt unter Admin, nicht in einem „Projektierung“-Unterreiter. Bestehende Seiten-URLs bleiben erhalten. Die Navigation ist keine Zugriffskontrolle: Die Seiten `/admin/konten/` und `/admin/datenstand/` sind erreichbar, ihre APIs für Identity, Backups und persönliche Lernstände prüfen aber serverseitig die Admin-Rolle.

Das **Admin-Wiki** unter `/admin-wiki/` zeigt die Root-READMEs (`README*.md`) und alle Feature-READMEs (`features/README*.md`) direkt als statische Starlight-Seiten. `src/lib/admin-wiki.ts` lädt die Originaldateien beim Build; `src/pages/admin-wiki/` stellt Übersicht und Dokumentseiten bereit. Neue passende READMEs werden beim nächsten Build automatisch aufgenommen. Relative Links zwischen diesen Dokumenten führen zu den Wiki-Seiten, Inhalts- und Asset-Links zur jeweiligen Website-Route; sonstige Repository-Links verweisen auf GitHub (`main`). Das Admin-Wiki ist wie die übrige Website öffentlich und nicht zugriffsgeschützt.

Der Admin-Wiki-Renderer ergänzt zugängliche Namen für Markdown-Checkboxen aus dem jeweiligen Aufgabentext, ohne den schreibgeschützten Zustand zu ändern. Verschachtelte Aufgaben erhalten eigene Namen. Codeblöcke nutzen das kontrastreiche Shiki-Theme `github-dark-high-contrast`, damit auch Kommentare lesbar bleiben.

Die aktuelle `src/content.config.ts` nutzt Starlights `docsLoader()` und `docsSchema()` mit einem Zod-Erweiterungsschema sowie `i18nLoader()` und `i18nSchema()` für Übersetzungen. Auszug:

```typescript
import { defineCollection } from 'astro:content';
import { docsLoader, i18nLoader } from '@astrojs/starlight/loaders';
import { docsSchema, i18nSchema } from '@astrojs/starlight/schema';
import { z } from 'astro/zod';

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      extend: z.object({
        // Weitere Felder stehen in src/content.config.ts.
        level: z.number().optional(),
        xpReward: z.number().default(100),
        tags: z.array(z.string()).optional(),
      }),
    }),
  }),
  i18n: defineCollection({ loader: i18nLoader(), schema: i18nSchema() }),
};
```

Der Auszug zeigt nicht alle Projektfelder; verbindlich ist `src/content.config.ts`.

**Seitenlayout im Frontmatter (Starlight 0.42):**

| Option | Wirkung |
| :--- | :--- |
| `template: doc` (Standard) | Dokumentationsseite mit Sidebar und Inhaltsverzeichnis. |
| `template: splash` | Seite ohne Sidebar, breitere Spalte, z. B. für Startseiten; kombinierbar mit `hero`. |
| `template: wide-content` | Projekteigen: wie `doc`, aber breitere Inhaltsspalte (siehe unten). |
| `template: extra-wide-content` | Projekteigen: wie `doc`, mit besonders breiter Inhaltsspalte (siehe unten). |
| `tableOfContents: false` | Blendet das Inhaltsverzeichnis aus. |
| `tableOfContents: { minHeadingLevel, maxHeadingLevel }` | Steuert die Überschriftenebenen (Standard 2–3). |
| `sidebar: { order, label, hidden, badge, attrs }` | Position, Beschriftung, Sichtbarkeit und Badge des Sidebar-Eintrags. |
| `prev` / `next` | Überschreibt oder deaktiviert (`false`) die Seitennavigation. |
| `hero` | Hero-Bereich, vor allem mit `splash`. |
| `banner: { content }` | Banner am Seitenanfang. |
| `editUrl` | Eigene URL oder `false` für den „Seite bearbeiten“-Link. |
| `lastUpdated` | Datum oder `false` für die „Zuletzt aktualisiert“-Angabe. |
| `pagefind: false` | Nimmt die Seite aus der Suche aus. |
| `draft: true` | Seite wird im Produktions-Build nicht veröffentlicht. |
| `head`, `title`, `description` | Meta-Tags, Seitentitel und Beschreibung. |

**Templates `wide-content` und `extra-wide-content`:** Beide verhalten sich wie `doc`; das Inhaltsverzeichnis lässt sich weiterhin separat mit `tableOfContents: false` ausblenden. `wide-content` setzt `--sl-content-width: 75rem`, `extra-wide-content` erweitert auf `90rem`. Das extra-breite Template setzt zusätzlich den Wide-Content-Hook, damit bestehende Layoutanpassungen wie die volle Formularbreite erhalten bleiben. Beteiligt sind:

- `src/content.config.ts`: erweitert das `template`-Feld um beide Werte.
- `src/components/starlight/MarkdownContent.astro`: überschreibt Starlights `MarkdownContent` und setzt die CSS-Hooks `data-wide-content` und `data-extra-wide-content`.
- `src/styles/wide-content.css`: setzt die Breite; über `customCss` in `astro.config.mjs` eingebunden.
- `astro.config.mjs`: registriert den Komponenten-Override unter `components`.

### 3.2 Notation und Medien

`src/components/notation/Notation.astro` und seine internen Bausteine verwenden den gemeinsamen SVG-Renderer in `src/lib/notation-renderer.ts`. `NotationKeyboard.astro` ergänzt eine verbundene Klaviernotation; `NotationBuilder.astro` ergänzt interaktive Eingabe. `SheetMusicPlayer.astro` verwendet unabhängig davon AlphaTab für MusicXML. Bravura liegt lokal unter `public/alphatab/font/`; Partituren liegen unter `public/scores/`.

`remark-math` und `rehype-katex` verarbeiten mathematische Ausdrücke in den Dokumentationsinhalten. Notations- und Musikstyles liegen unter anderem in `src/styles/notation.css` und `src/styles/music.css`.

`DrumPattern.astro` verwendet unabhängig davon die native Web Audio API für Soundfiles. Die gemeinsame Audio-Engine, der Scheduler und der DOM-Controller liegen unter `src/lib/drum-audio.ts`, `src/lib/drum-playback.ts` und `src/lib/drum-pattern.ts`; statische MDX- und dynamische Moduldarstellungen teilen diese Bausteine. Details: [Audioplayer-Referenz](features/README_FEAT_AUDIOPLAYER.md).

### 3.3 Backend und Persistenz

`netlify/functions/contributions.ts` und `netlify/functions/modules.ts` stellen die APIs für Beiträge und Lernmodule bereit. `netlify/functions/learning-progress.ts` speichert persönliche Lernstände; `netlify/functions/admin-identity.ts` liefert Identity-Status und Einladungsfunktionen für berechtigte Admins. `netlify/functions/lib/blob-store.ts` kapselt die gemeinsamen JSON-Daten über Netlify Blobs; persönliche Lernstände liegen separat im User-Store. `public/_redirects` leitet `/api/*` auf Netlify Functions weiter.

Die Netlify Functions verwenden in Cloud-Kontexten den Blob-Store; nur Netlify Dev initialisiert fehlende gemeinsame Keys aus `data/blob-snapshot/` und aktualisiert diese Snapshots bei lokalen Schreibvorgängen. Ein Build importiert sie nicht automatisch in die Cloud. Der reine Astro-Entwicklungsserver nutzt für Module stattdessen ein Vite-Plugin mit der lokal erzeugten `data/modules.json`. Kontenfunktionen benötigen Netlify Identity und Netlify Dev; Details stehen in der [Authentifizierungs-Referenz](features/README_FEAT_AUTHENTICATION.md), zur Persistenz in der [Blob-Referenz](features/README_FEAT_NETLIFYBLOB.md).

## 4. Projektstruktur

Die folgende Übersicht zeigt vorhandene Verzeichnisse und ausgewählte Dateien, nicht jeden Baustein:

```text
public/
├── _redirects                  # API-Weiterleitung auf Netlify Functions
├── alphatab/                   # Worker und Bravura-Font
├── favicon.svg
└── scores/                     # MusicXML-Partituren
src/
├── components/                 # Fachkomponenten wie Fretboard und Pattern
│   ├── admin/                  # Admin-Oberflächen, z. B. Konten & Einladungen
│   ├── learning/               # Lernpfad und Modul-Player
│   ├── notation/               # Notationskomponenten
│   ├── project/                # Modul- und Aufgaben-Builder
│   ├── starlight/              # Überschreibungen von Starlight-Komponenten
│   └── ui/                     # Gemeinsame UI-Bausteine
├── content/
│   ├── docs/                   # MDX- und Markdown-Inhalte
│   └── i18n/                   # Übersetzungen
├── content.config.ts           # Starlight-Collections und Schemaerweiterung
├── img/                        # Projektbilder
├── lib/                        # Fachlogik, Renderer, Controller und Stores
├── pages/                      # Eigene Routen, darunter Admin und Modularchiv
└── styles/                     # Gemeinsame Stylesheets
tests/
├── *.test.mjs                  # Vitest-Tests, u. a. Notationslogik
├── documentation.test.ts       # README-Link- und Skriptprüfung
├── components/                 # DOM- und Interaktionstests
├── integration/                # Integrationstests
└── e2e/                        # Playwright-Browsertests
netlify/functions/              # API-Functions für Beiträge, Module, Lernstand und Identity
data/
├── blob-snapshot/              # Versionierte Ausgangsdaten für lokalen Netlify-Dev-Store
├── blob-archive/               # Lokale Sicherungen bei Blob-Transfers
└── modules.json                # Nur lokal erzeugter Modul-Fallback (Astro-Dev)
features/                       # Feature-Übersicht, Fachreferenzen und Handoffs
astro.config.mjs                # Astro-, Starlight- und Dev-Server-Konfiguration
biome.json                      # Linter und Formatter
package.json                    # Abhängigkeiten und Skripte
tsconfig.json                   # TypeScript-Konfiguration
vitest.config.ts                # Vitest-Auswahl und Testumgebung
```
