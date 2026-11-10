# [Projektname] – Modulare Web- & Dokumentationsplattform

> Offizieller Architektur-Standard, Entwickler-Handbuch, Testing-Plan und Release-Leitfaden für moderne Webanwendungen und Dokumentationsplattformen auf Basis von Astro, TypeScript, Serverless Functions und automatisierter Qualitätssicherung.

---

## Inhaltsverzeichnis

1. [TEIL 1: Daily Workflow & Cheatsheet](#teil-1-daily-workflow--cheatsheet)
   * [1.1 Der Standard-Entwicklungszyklus (4-Stufen-Workflow)](#11-der-standard-entwicklungszyklus-4-stufen-workflow)
   * [1.2 Tägliches Befehls-Cheatsheet (Terminal & npm run)](#12-tägliches-befehls-cheatsheet-terminal--npm-run)
   * [1.3 Git-Alltags-Workflows, Branch-Management & Notfall-Fixes](#13-git-alltags-workflows-branch-management--notfall-fixes)
   * [1.4 Workspace-Initialisierung (Lokal vs. Fullstack mit Netlify)](#14-workspace-initialisierung-lokal-vs-fullstack-mit-netlify)
2. [TEIL 2: Chronologischer Projekt-Aufbau (Scaffolding-Standard)](#teil-2-chronologischer-projekt-aufbau-scaffolding-standard)
   * [2.1 Verzeichnisarchitektur nach dem Lego-Prinzip](#21-verzeichnisarchitektur-nach-dem-lego-prinzip)
   * [2.2 Core-Konfigurationen (astro.config.mjs, tsconfig.json, package.json)](#22-core-konfigurationen-astroconfigmjs-tsconfigjson-packagejson)
   * [2.3 Design-Tokens, globale CSS-Ebenen & Webfonts](#23-design-tokens-globale-css-ebenen--webfonts)
   * [2.4 Typensicherer Content Layer mit Zod-Validierung](#24-typensicherer-content-layer-mit-zod-validierung)
   * [2.5 Serverless Backend, GitHub REST API & Deploy Previews](#25-serverless-backend-github-rest-api--deploy-previews)
3. [TEIL 3: Die Testpyramide & Stufenweiser Testing-Plan](#teil-3-die-testpyramide--stufenweiser-testing-plan)
   * [3.1 Architektur der Pyramide & das 80/20-Prinzip](#31-architektur-der-pyramide--das-8020-prinzip)
   * [3.2 Stufe 0: Statische Code-Analyse & Hygiene (Fundament)](#32-stufe-0-statische-code-analyse--hygiene-fundament)
   * [3.3 Stufe 1: Unit Tests (Mathematik, Algorithmen, Datenlogik)](#33-stufe-1-unit-tests-mathematik-algorithmen-datenlogik)
   * [3.4 Stufe 2: Component Tests (Astro-Container & UI-Isolierung)](#34-stufe-2-component-tests-astro-container--ui-isolierung)
   * [3.5 Stufe 3: Integration Tests (Serverless Functions & Schnittstellen)](#35-stufe-3-integration-tests-serverless-functions--schnittstellen)
   * [3.6 Stufe 4: End-to-End (E2E) & Visual Regression (Browser-Simulation)](#36-stufe-4-end-to-end-e2e--visual-regression-browser-simulation)
   * [3.7 Flankierende Querschnitts-Tests (Performance, Security, Regression)](#37-flankierende-querschnitts-tests-performance-security-regression)
   * [3.8 Schrittweiser Implementierungsplan (Komplexitäts-Stufen)](#38-schrittweiser-implementierungsplan-komplexitäts-stufen)
   * [3.9 Das zentrale Pre-Flight Quality Gate](#39-das-zentrale-pre-flight-quality-gate)
4. [TEIL 4: Der 5-Phasen-Release-Audit & Definition of Done (DoD)](#teil-4-der-5-phasen-release-audit--definition-of-done-dod)
5. [TEIL 5: Step-by-Step Checkliste für dein Projekt (Roadmap)](#teil-5-step-by-step-checkliste-für-dein-projekt-roadmap)

---

## TEIL 1: Daily Workflow & Cheatsheet

### 1.1 Der Standard-Entwicklungszyklus (4-Stufen-Workflow)

Um Regressionsfehler, Build-Abbrüche und instabile Stände auf dem Hauptbranch (`main`) auszuschließen, folgt jede Änderung verbindlich diesem linearen Zyklus:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ SCHRITT 1: Feature-Branch erstellen                                         │
│ └── Ausgehend von einem aktuellen 'main' isoliert abzweigen.                │
├─────────────────────────────────────────────────────────────────────────────┤
│ SCHRITT 2: Komplettes Feature entwickeln & lokal verifizieren               │
│ └── Typdefinition -> Geschäftslogik -> UI-Komponente -> Dokumentation.      │
├─────────────────────────────────────────────────────────────────────────────┤
│ SCHRITT 3: Testpyramide & Quality Gate sequenziell abarbeiten                │
│ └── Statische Analyse -> Unit -> Component -> Integration -> E2E -> Audit.  │
├─────────────────────────────────────────────────────────────────────────────┤
│ SCHRITT 4: Feature-Branch via Pull Request in main integrieren              │
│ └── Deploy-Preview prüfen, automatisches CI abwarten, sauber mergen.        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 1.2 Tägliches Befehls-Cheatsheet (Terminal & npm run)

Alle Prüfungen und Server-Starts werden bevorzugt über standardisierte `npm run`-Befehle ausgeführt:

```bash
# ---------------------------------------------------------
# LOKALE ENTWICKLUNGSSERVER
# ---------------------------------------------------------
npm run dev                 # Startet Frontend/Doku unter http://localhost:4321
npm run dev:all             # Startet Frontend + Netlify Functions unter http://localhost:8888
npm run build               # Simuliert vollständigen Produktions-Build in dist/
npm run preview             # Lokale Vorschau des fertigen Produktions-Builds

# ---------------------------------------------------------
# QUALITÄTSPRÜFUNGEN & PYRAMIDEN-TESTS (VON UNTEN NACH OBEN)
# ---------------------------------------------------------
npm run lint                # Biome: Prüft Syntax, Formatierung & tote Imports
npm run lint:fix            # Biome: Korrigiert Stil- & Formatierungsfehler automatisch
npm run check               # Astro Check: Validiert .astro-Templates, Props & Frontmatter
npm run typecheck           # TypeScript: Strikte Typprüfung ohne Dateiausgabe (tsc --noEmit)

npm run test:unit           # Stufe 1: Schnelle Unit-Tests (Mathematik, Logik, Parser)
npm run test:comp           # Stufe 2: Isolierte Komponententests (Astro-Container)
npm run test:int            # Stufe 3: Integrationstests (Netlify Function, Payload, Store)
npm run test:e2e            # Stufe 4: E2E-Browsertests (Playwright, Chromium/WebKit)
npm run test:visual         # Stufe 4: Pixelgenaue visuelle Regressions-Snapshots

npm run test:perf           # Flankierend: Lighthouse CI Core Web Vitals Audit
npm run test:security       # Flankierend: npm audit Sicherheitscheck ab Schweregrad 'high'

# ---------------------------------------------------------
# DAS KOMBINIERTE QUALITY GATE (VOR JEDEM PUSH / PR)
# ---------------------------------------------------------
npm run preflight           # Führt die gesamte Kette sequenziell mit Exit-Code 0 aus
```

---

### 1.3 Git-Alltags-Workflows, Branch-Management & Notfall-Fixes

#### 1. Feature-Branch anlegen & wechseln
```bash
# Vor Beginn: Lokalen main auf den neuesten Remote-Stand bringen
git switch main
git pull origin main

# Neuen Feature-Branch anlegen und sofort aktivieren
git switch -c feature/mein-neues-feature

# Zwischen existierenden Branches wechseln
git switch feature/mein-neues-feature
git switch main

# Alle lokalen und Remote-Branches auflisten
git branch -a
```

#### 2. Änderungen versionieren & pushen
```bash
# Arbeitsbaum-Status und modifizierte Dateien prüfen
git status

# Alle Änderungen vormerken (Staging)
git add .

# Konventionellen Commit mit klarer Signatur erstellen
git commit -m "feat(renderer): proportionale notenabstaende implementiert"

# Neuen Branch erstmals an GitHub übertragen (Upstream-Tracking setzen)
git push -u origin feature/mein-neues-feature

# Nachfolgende Pushes auf diesem Branch
git push
```

#### 3. Synchronisation & Remote-Merge
```bash
# Neueste Stände vom Server abfragen (ohne lokalen Code zu manipulieren)
git fetch origin

# Main-Änderungen in den eigenen Feature-Branch integrieren
git merge origin/main
```

#### 4. Branches synchronisieren & Stände gezielt übernehmen
```bash
# Aktuellsten Stand eines Remote-Branches holen und lokalen Stand hart überschreiben
git fetch origin
git switch <branch-name>
git reset --hard origin/<branch-name>

# Älteren historischen Stand laden
git switch <aelterer-branch>
git fetch origin
git reset --hard origin/<aelterer-branch>

# Arbeitsbaum gezielt mit dem Stand eines neueren Branches auffüllen
git restore --source=origin/<aktuellster-branch> --worktree -- .
```

#### 5. Commits zurücknehmen & HEAD-Verständnis
```bash
# Letzten Commit zurücknehmen (Änderungen bleiben im Arbeitsverzeichnis erhalten)
git reset HEAD~1
```
* **`HEAD`:** Zeiger auf den aktuellen Commit, auf dem du dich befindest.
* **`HEAD~1`:** Der direkte Vorgänger-Commit (1 Schritt zurück in der Historie).
* **`HEAD~2`:** Der Vor-Vorgänger-Commit (2 Schritte zurück).

#### 6. Aufräumen, Archivieren & Windows-Notfall-Fixes
```bash
# Nicht getrackte Restdateien und Build-Reste radikal löschen
git clean -fd

# Branch umbenennen bzw. ins Archiv verschieben
git branch -m <branch-name> archive/<branch-name>
git push origin -u archive/<branch-name>

# Remote-Branch auf GitHub löschen
git push origin --delete <branch-name>

# Windows PowerShell Notfall: Blockierte Git-Lock-Datei nach Crash entfernen
Remove-Item .git\index.lock -Force -ErrorAction SilentlyContinue
git checkout -f main
```

---

### 1.4 Workspace-Initialisierung (Lokal vs. Fullstack mit Netlify)

#### Reines Frontend & Dokumentation (Schnellstart)
```bash
npm install
npm run dev
```
*Die Seite läuft unter `http://localhost:4321`. Serverless Functions sind inaktiv.*

#### Fullstack-Entwicklung (Frontend + Netlify Serverless API)
```bash
npm install
npm run build

# Einmalige Verknüpfung der Netlify CLI
npx netlify-cli login
npx netlify-cli link

# Synchronen Devserver starten
npx netlify-cli dev
```
*Startet Frontend und Netlify Functions synchron unter `http://localhost:8888`.*

---

## TEIL 2: Chronologischer Projekt-Aufbau (Scaffolding-Standard)

### 2.1 Verzeichnisarchitektur nach dem Lego-Prinzip

Die Codebasis trennt Geschäftslogik, visuelle Darstellung, Datenmodelle und Inhalte strikt nach dem Prinzip der **Separation of Concerns**:

```text
mein-projekt/
├── public/                     # Statische Assets (unverändert ausgeliefert)
│   ├── favicon.svg             # Vektor-Favicon
│   ├── robots.txt              # Suchmaschinen-Führung mit Sitemap-Link
│   └── fonts/                  # Lokale Webfonts (kein Google Fonts CDN)
├── src/
│   ├── assets/                 # Lokale Grafiken für Astros Optimierungs-Pipeline
│   ├── components/             # Astro- & UI-Komponenten
│   │   ├── ui/                 # Zustandslose Präsentationsbausteine (Buttons, Badges)
│   │   └── features/           # Fachliche Manager-Komponenten (Logik + Layout)
│   ├── content/                # Strukturierte Inhalte (Markdown / MDX)
│   ├── content.config.ts       # Typisierte Frontmatter-Schemata via Zod
│   ├── layouts/                # HTML-Skelette (<BaseLayout.astro>)
│   ├── lib/                    # Reine Geschäftslogik & Algorithmen (100% TypeScript)
│   ├── pages/                  # Datei-basiertes Routing (404.astro, index.astro)
│   └── styles/                 # Globale Design-Tokens, Resets & CSS-Module
├── tests/                      # Automatisierte Test-Suites
│   ├── unit/                   # Schnelle Unit-Tests (*.unit.test.ts)
│   ├── components/             # Astro-Container Komponententests (*.comp.test.ts)
│   ├── integration/            # Schnittstellentests (*.int.test.ts)
│   └── e2e/                    # Playwright E2E- & Visual-Tests (*.spec.ts)
├── netlify/                    # Serverless Functions & Backend-Endpunkte
│   └── functions/              # Netlify Handlers (contributions.ts)
├── data/                       # Strukturierte Datendateien (contributions.json)
├── .env.example                # Dokumentierte Vorlage aller Umgebungsvariablen
├── .gitignore                  # Git-Ausschlussregeln
├── astro.config.mjs            # Zentrale Framework- & Integrationskonfiguration
├── biome.json                  # Linter- & Formatter-Konfiguration
├── package.json                # Skripte, Werkzeuge & Abhängigkeiten
├── playwright.config.ts        # E2E-Testkonfiguration
├── tsconfig.json               # Strikte TypeScript-Compileroptionen
└── vitest.config.ts            # Component- & Integration-Testrunner
```

---

### 2.2 Core-Konfigurationen (`astro.config.mjs`, `tsconfig.json`, `package.json`)

#### `astro.config.mjs`
```javascript
// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import sitemap from '@astrojs/sitemap';
import { unified } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

export default defineConfig({
  // Kanonische Basis-URL für korrekte Sitemaps und OpenGraph-Tags
  site: 'https://deine-domain.netlify.app',
  output: 'static',
  markdown: {
    processor: unified({
      remarkPlugins: [remarkMath],
      rehypePlugins: [rehypeKatex],
    }),
  },
  integrations: [
    sitemap(),
    starlight({
      title: 'Plattform-Hub',
      defaultLocale: 'root',
      locales: {
        root: { label: 'Deutsch', lang: 'de' },
      },
      customCss: [
        './src/styles/variables.css',
        './src/styles/layout.css',
        'katex/dist/katex.min.css',
      ],
      sidebar: [
        {
          label: 'Projektierung',
          items: [{ label: 'Beiträge & Feedback', slug: 'projektierung/beitraege' }],
        },
        {
          label: 'Dokumentation & Wissen',
          autogenerate: { directory: 'docs' },
        },
      ],
    }),
  ],
});
```

#### `tsconfig.json`
```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@components/*": ["src/components/*"],
      "@layouts/*": ["src/layouts/*"],
      "@lib/*": ["src/lib/*"],
      "@styles/*": ["src/styles/*"]
    }
  },
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist", "node_modules"]
}
```

#### `package.json`
```json
{
  "name": "astro-enterprise-app",
  "type": "module",
  "version": "1.0.0",
  "scripts": {
    "dev": "astro dev",
    "dev:all": "netlify dev",
    "start": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "format": "biome format --write .",
    "check": "astro check",
    "typecheck": "tsc --noEmit",
    "test": "npm run test:unit",
    "test:unit": "node --test tests/**/*.test.mjs",
    "test:comp": "vitest run tests/**/*.comp.test.ts",
    "test:int": "vitest run tests/**/*.int.test.ts",
    "test:e2e": "playwright test",
    "test:visual": "playwright test --update-snapshots",
    "test:perf": "lhci autorun",
    "test:security": "npm audit --audit-level=high",
    "preflight": "npm run lint && npm run check && npm run typecheck && npm run test:security && npm run test:unit && npm run build && git diff --check"
  },
  "dependencies": {
    "@astrojs/markdown-remark": "^7.3.5",
    "@astrojs/sitemap": "^3.2.1",
    "@astrojs/starlight": "^0.42.8",
    "@netlify/functions": "^6.1.0",
    "astro": "^7.4.5",
    "katex": "^0.19.1",
    "rehype-katex": "^7.0.1",
    "remark-math": "^6.0.0",
    "sharp": "^0.35.3",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@astrojs/check": "^0.9.4",
    "@biomejs/biome": "^1.9.4",
    "@lhci/cli": "^0.14.0",
    "@playwright/test": "^1.49.0",
    "@types/node": "^22.10.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0"
  }
}
```

---

### 2.3 Design-Tokens, globale CSS-Ebenen & Webfonts

1. **`src/styles/variables.css`:** Zentrale Design-Tokens (Farben, Abstände, Typografie, Intervalle).
2. **`src/styles/layout.css`:** Responsive Breakpoints, Container, Starlight-Sidebar-Anpassungen.
3. **`src/styles/components.css`:** Wiederverwendbare Basisstile für interaktive UI-Elemente.
4. **Schriftarten:** Lokale Bereitstellung unter `public/fonts/` mit `font-display: swap;` im CSS, um DSGVO-Konformität und minimale Latenzen ohne externe CDN-Aufrufe zu sichern.

---

### 2.4 Typensicherer Content Layer mit Zod-Validierung

In `src/content.config.ts` wird das Frontmatter jeder Content-Sammlung verbindlich validiert. Syntax- oder Typfehler führen sofort zum Abbruch des Builds:

```typescript
import { defineCollection, z } from 'astro:content';

const docs = defineCollection({
  schema: z.object({
    title: z.string().min(1, 'Titel darf nicht leer sein'),
    description: z.string(),
    publishDate: z.date().optional(),
    draft: z.boolean().default(false),
    tags: z.array(z.string()).default([]),
  }),
});

export const collections = { docs };
```

---

### 2.5 Serverless Backend, GitHub REST API & Deploy Previews

1. **Netlify-Konfigurationsdatei (`netlify.toml`):**
   ```toml
   [build]
     command = "npm run build"
     publish = "dist"
     functions = "netlify/functions"

   # Verhindert endlose Build-Schleifen bei Datenspeicherung im Repository
   [context.production]
     ignore = "git diff --quiet $CACHED_COMMIT_REF $COMMIT_REF -- . ':(exclude)data/**'"
   ```
2. **Serverless Function (`netlify/functions/contributions.ts`):** Verarbeitet Lese- und Schreibzugriffe und sichert Schreib-Konflikte (HTTP 409) über eine automatische Retry-Logik mit bis zu 3 Versuchen ab.
3. **Datenspeicher (`data/contributions.json`):** Initiales leeres JSON-Array `[]`.
4. **Deploy-Preview-Regeln:** Im Netlify-Dashboard müssen Umgebungsvariablen für *Deploy Previews* separat gepflegt werden, damit Test-Previews nicht direkt in den Produktions-Ast (`main`) schreiben.

#### Erforderliche Umgebungsvariablen (`.env.example`)

```bash
# Kanonische Basis-URL
SITE_URL=https://deine-domain.netlify.app

# GitHub REST API Anbindung (Serverless Backend)
GITHUB_TOKEN=ghp_deinFeingranularerPersonalAccessTokenHier
GITHUB_REPOSITORY=owner/repository-name
GITHUB_BRANCH=main
GITHUB_DATA_PATH=data/contributions.json
```

---

## TEIL 3: Die Testpyramide & Stufenweiser Testing-Plan

### 3.1 Architektur der Pyramide & das 80/20-Prinzip

Die Teststrategie folgt der klassischen Pyramide: **Breite Basis mit vielen, extrem schnellen und günstigen Tests; schmale Spitze mit wenigen, langsameren Browser-Tests.**

```text
                     ▲
                    / \
                   /   \
                  / E2E \                <-- Stufe 4: Playwright (wenige, kritische Pfade)
                 /-------\
                /  INTE-  \              <-- Stufe 3: Vitest + Netlify Handler Mocks (Schnittstellen)
               /  GRATION  \
              /-------------\
             /   COMPONENT   \           <-- Stufe 2: Vitest + astro/container (UI-Isolierung)
            /-----------------\
           /    UNIT TESTS     \         <-- Stufe 1: Node.js Test-Runner (Mathematik & Logik)
          /---------------------\
         /    STATISCHE ANALYSE  \       <-- Stufe 0: Biome, Astro Check, TypeScript strict
        /-------------------------\

 ┌─────────────────────────────────────────────────────────────────────────────┐
 │  FLANKIERENDE QUERSCHNITTS-TESTS (Über alle Ebenen hinweg):                 │
 │  • Performance (Lighthouse)  • Visual Regression  • Security (npm audit)    │
 └─────────────────────────────────────────────────────────────────────────────┘
```

#### Der Mythos der „100 % Testabdeckung“:
* **Line Coverage $\neq$ Fehlerfreiheit:** Ein Test kann $100\,\%$ der Codezeilen berühren, ohne Randwerte (z. B. Division durch $0$ oder leere Arrays) zu prüfen.
* **Pareto-Prinzip ($80/20$):** Die letzten $10\text{--}15\,\%$ Testabdeckung fressen $80\,\%$ der Entwicklungszeit für praxisferne Edge-Cases.
* **Zielwerte:**
  * $90\text{--}100\,\%$ Abdeckung bei Unit Tests (reine Geschäftslogik in `src/lib/`).
  * $70\text{--}80\,\%$ Abdeckung bei Integration & Serverless Functions.
  * 3 bis 5 kritische Pfade bei E2E (Quiz, Feature-Speicherung, Navigation).

---

### 3.2 Stufe 0: Statische Code-Analyse & Hygiene (Fundament)

Prüft Code ohne Ausführung in Millisekunden auf Syntaxfehler, Formatierungsabweichungen, Typfehler und unsaubere Git-Artefakte:

```bash
# Linter und Formatierer ausführen
npm run lint

# Astro-Templates und Props prüfen
npm run check

# TypeScript-Compiler ohne Dateiausgabe durchlaufen lassen
npm run typecheck

# Git-Baum auf Whitespace-Fehler und ungelöste Merge-Konflikte prüfen
git diff --check
```

---

### 3.3 Stufe 1: Unit Tests (Mathematik, Algorithmen, Datenlogik)

* **Zweck:** Testet isolierte TypeScript-Funktionen vollständig ohne DOM, Browser oder Server.
* **Typische Bereiche:**
  * Koordinatenberechnungen, SVG-Pfade, Taktmaße, Frequenzen ($E_2 \approx 82{,}4\text{ Hz}$).
  * Daten-Transformationen, Sortier- und Filteralgorithmen.
* **Befehl:**
  ```bash
  npm run test:unit
  ```
* **Beispiel-Implementierung (`tests/unit/math-logic.test.mjs`):**
  ```javascript
  import test from 'node:test';
  import assert from 'node:assert/strict';

  test('berechnet proportionale Abstände fehlerfrei', () => {
    const calcSpacing = (duration, base) => (duration === 'quarter' ? base : base * 2);
    assert.equal(calcSpacing('quarter', 20), 20);
    assert.equal(calcSpacing('half', 20), 40);
  });
  ```

---

### 3.4 Stufe 2: Component Tests (Astro-Container & UI-Isolierung)

* **Zweck:** Rendert Astro-Komponenten im Speicher (ohne vollständigen Browser), um Props, CSS-Klassen und Barrierefreiheitsattribute (`aria-*`) abzusichern.
* **Befehl:**
  ```bash
  npm run test:comp
  ```
* **Beispiel-Implementierung (`tests/components/card.comp.test.ts`):**
  ```typescript
  import { experimental_AstroContainer as AstroContainer } from 'astro/container';
  import { describe, it, expect } from 'vitest';
  import UiButton from '../../src/components/ui/UiButton.astro';

  describe('Component: <UiButton />', () => {
    it('rendert Label und barrierefreies Attribut', async () => {
      const container = await AstroContainer.create();
      const result = await container.renderToString(UiButton, {
        props: { label: 'Starten', ariaLabel: 'Lektion starten' },
      });
      expect(result).toContain('Lektion starten');
      expect(result).toContain('Starten');
    });
  });
  ```

---

### 3.5 Stufe 3: Integration Tests (Serverless Functions & Schnittstellen)

* **Zweck:** Prüft das Zusammenspiel mehrerer Einheiten, HTTP-Statuscodes und API-Mocks.
* **Befehl:**
  ```bash
  npm run test:int
  ```
* **Beispiel-Implementierung (`tests/integration/contributions.int.test.ts`):**
  ```typescript
  import { describe, it, expect } from 'vitest';
  import { handler } from '../../netlify/functions/contributions';

  describe('Integration: Contributions Netlify Function', () => {
    it('weist Payloads ohne Titel mit HTTP 400 ab', async () => {
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({ description: 'Fehlender Titel' }),
        headers: {},
      } as any;

      const response = await handler(event, {} as any);
      expect(response.statusCode).toBe(400);
    });
  });
  ```

---

### 3.6 Stufe 4: End-to-End (E2E) & Visual Regression (Browser-Simulation)

* **Zweck:** Ein ferngesteuerter Browser (Chromium/WebKit) simuliert reale Nutzerpfade über die gebaute Anwendung.
* **Befehl:**
  ```bash
  npm run test:e2e
  ```
* **Beispiel-Implementierung (`tests/e2e/workflow.spec.ts`):**
  ```typescript
  import { test, expect } from '@playwright/test';

  test('Lernpfad-Navigation und Visual Snapshot', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Dokumentation');
    await expect(page).toHaveURL(/.*docs/);

    const mainHeading = page.locator('h1');
    await expect(mainHeading).toBeVisible();

    // Visual Regression Prüfung
    await expect(page).toHaveScreenshot('landing-page.png', {
      maxDiffPixelRatio: 0.02,
    });
  });
  ```

---

### 3.7 Flankierende Querschnitts-Tests (Performance, Security, Regression)

#### 1. Security Testing (`npm run test:security`)
```bash
npm audit --audit-level=high
```
* Prüft alle Abhängigkeiten gegen die GitHub Advisory Database.
* Bricht nur bei Lücken der Stufen `high` und `critical` ab.
* Verhindert das Eindringen bekannter Sicherheitsrisiken in Serverless Functions.

#### 2. Performance Testing (`npm run test:perf`)
```bash
npm run build && lhci autorun
```
* Überprüft Core Web Vitals (LCP, CLS, FID) und sichert einen Lighthouse-Score von mindestens 90 Punkten ab.

#### 3. Visual Regression Testing (`npm run test:visual`)
```bash
playwright test --update-snapshots
```
* Gleicht gerenderte Grafiken und Notensysteme pixelgenau mit Referenzbildern ab.

---

### 3.8 Schrittweiser Implementierungsplan (Komplexitäts-Stufen)

Gehe bei der Integration der Testschichten exakt in dieser Reihenfolge vor, um dich schrittweise von unten nach oben vorzuarbeiten:

```text
Stufe 1 (Fundament): Statische Analyse & Unit Tests
├── 1. Biome und Astro Check in package.json verankern
└── 2. Reine TypeScript-Funktionen in tests/unit/ absichern (npm test / npm run test:unit)

Stufe 2 (Komponenten): Astro Container API
├── 1. Vitest installieren (npm install -D vitest)
├── 2. vitest.config.ts anlegen
└── 3. Isolierte UI-Tests in tests/components/ anlegen (npm run test:comp)

Stufe 3 (Integration): Serverless & Schnittstellen
├── 1. Netlify Functions Handler über Vitest ansteuern
└── 2. Validierung & Fehler-Codes abprüfen (npm run test:int)

Stufe 4 (Spitze): End-to-End & Audits
├── 1. Playwright installieren (npx playwright install --with-deps chromium)
├── 2. E2E-Klickpfade in tests/e2e/ etablieren (npm run test:e2e)
├── 3. npm audit in die Pre-Flight-Kette aufnehmen (npm run test:security)
└── 4. Lighthouse CI für Performance-Limits konfigurieren (npm run test:perf)
```

---

### 3.9 Das zentrale Pre-Flight Quality Gate

Vor jedem Commit oder Pull Request muss die automatisierte Prüfkette fehlerfrei mit Exit-Code `0` durchlaufen:

```bash
npm run preflight
```

---

## TEIL 4: Der 5-Phasen-Release-Audit & Definition of Done (DoD)

### 🛠️ Phase 1: Code-Hygiene & Automatisierte Prüfungen
- [ ] **Linter & Formatter (`npm run lint`):** Keine Syntaxabweichungen, ungenutzten Variablen oder toten Imports.
- [ ] **Astro Template-Check (`npm run check`):** Alle Props, Datentypen und `.astro`-Templates fehlerfrei validiert.
- [ ] **TypeScript-Prüfung (`npm run typecheck`):** Der Compiler wirft 0 Typfehler im Strict-Modus.
- [ ] **Sicherheits-Audit (`npm run test:security`):** Keine Lücken der Stufen `high` oder `critical`.
- [ ] **Unit- & Integrationstests (`npm test`):** Alle Testdateien sind grün.
- [ ] **Produktions-Build (`npm run build`):** Generiert fehlerfrei das Verzeichnis `dist/`.
- [ ] **Debug-Bereinigung:** Volltextsuche nach `console.log(...)` im Client-Code durchgeführt; temporäre Notizen entfernt.
- [ ] **Secret-Hygiene:** Keine API-Tokens oder Passwörter im Quellcode; `.env` steht in `.gitignore`.

---

### 🧠 Phase 2: Inhalt & Logik-Audit (Manuelle Checks)
- [ ] **Platzhalter-Bereinigung:** Volltextsuche nach `Lorem`, `TODO`, `Test`, `Mock`, `Placeholder`, `asdf` durchgeführt und bereinigt.
- [ ] **Interaktionsprüfung:** Keine toten Buttons oder Dummy-Links (`href="#"`); alle internen Routen leiten korrekt weiter.
- [ ] **Externe Links:** Externe Verweise öffnen sicher mit `rel="noopener noreferrer"`.
- [ ] **Ablauf- & Navigationslogik:** Vor- und Zurück-Schaltflächen führen in der didaktisch korrekten Reihenfolge.
- [ ] **Zustandsspeicherung (State):** Fortschritte (z. B. via `localStorage`) bleiben nach Page-Reload erhalten; Reset-Button funktioniert sauber.

---

### 📱 Phase 3: Responsivität & Geräte-Kompatibilität
- [ ] **Physisches Smartphone-Testing:** Auf mindestens einem echten Mobilgerät (iOS oder Android) getestet.
- [ ] **Kein horizontales Scrollen:** Layout bricht bei Breiten von 320 px bis 1920 px ohne Ausbrechen der Viewport-Breite um.
- [ ] **Touch-Targets:** Alle Buttons, Icons und Tabs haben eine Mindestgröße von $44 \times 44\text{ px}$.
- [ ] **Cross-Browser-Audit:** Erfolgreiche Gegenprobe in Chromium (Chrome/Edge), WebKit (Safari iOS/macOS) und Firefox.
- [ ] **Theme-Stabilität:** Kontraste und Schriftfarben bleiben im Dark- und Light-Mode gleichermaßen lesbar.

---

### ⚡ Phase 4: Performance, SEO & Barrierefreiheit (A11y)
- [ ] **Bildoptimierung:** Lokale Bilder laufen über Astros `<Image />`-Komponente (WebP/AVIF-Generierung mit festen Seitenverhältnissen).
- [ ] **Keine Asset-Schwergewichte:** Keine unkomprimierten Multi-Megabyte-Dateien im Verzeichnis `public/`.
- [ ] **Barrierefreiheit (WCAG AA):** Alle informativen Grafiken haben ein `alt`-Attribut; semantische Überschriftenfolge ($h1 \rightarrow h2 \rightarrow h3$).
- [ ] **SEO & Meta-Tags:** Aussagekräftige `<title>`- und `<meta name="description">`-Tags pro Seite; Social-Media-Vorschau (`og:image`) konfiguriert.
- [ ] **Favicon-Matrix:** Standard-Astro-Icon durch ein eigenes Favicon-Set (`favicon.svg`, `apple-touch-icon.png`) ersetzt.
- [ ] **Lighthouse-Audit:** Score von mindestens **90+ Punkten** in Performance, Accessibility, Best Practices und SEO.

---

### ⚖️ Phase 5: Rechtliches & Server-Infrastruktur
- [ ] **Rechtliche Pflichtseiten (DACH):** Leicht auffindbares Impressum und vollständige DSGVO-Datenschutzerklärung live geschaltet.
- [ ] **404-Fehlerseite (`src/pages/404.astro`):** Benutzerfreundliche Fehlerseite mit Rückführung zur Startseite vorhanden.
- [ ] **SSL & Domain:** HTTPS ist aktiv; Weiterleitungen von `http` auf `https` sowie `www` auf non-`www` greifen sauber.
- [ ] **Produktions-Umgebungsvariablen:** Alle benötigten Keys im Dashboard des Hosting-Providers (Netlify/Vercel) hinterlegt.

---

### 📋 Definition of Done (DoD)

Ein Release gilt erst dann als **fertiggestellt und freigegeben**, wenn:
1. `npm run preflight` fehlerfrei mit Exit-Code `0` durchläuft.
2. Ein vollständiger manueller Durchlauf auf einem mobilen Touch-Endgerät protokolliert wurde.
3. Impressum, Datenschutzerklärung und 404-Fehlerseite live erreichbar sind.

---

## TEIL 5: Step-by-Step Checkliste für dein Projekt (Roadmap)

Arbeite die folgenden Schritte nacheinander ab, um dein aktuelles Repository in eine solide, produktionsreife Web-App zu transformieren:

### Schritt 1: Baseline-Fixes in der Konfiguration
- [ ] **`site`-Parameter eintragen:** Öffne `astro.config.mjs` und trage `site: 'https://deine-domain.netlify.app'` ein (behebt die Sitemap- und Build-Warnungen).
- [ ] **Eigene 404-Fehlerseite anlegen:** Erstelle die Datei `src/pages/404.astro` mit Link zurück zur Startseite.
- [ ] **Leere i18n-Spracheinträge bereinigen:** Vervollständige oder entferne unvollständige Sprachkonfigurationen in `astro.config.mjs`.
- [ ] **Vorlage `.env.example` anlegen:** Erstelle im Root-Verzeichnis die Datei `.env.example` mit `GITHUB_TOKEN=`, `GITHUB_REPOSITORY=` und `GITHUB_BRANCH=`.

### Schritt 2: Skripte & Pyramiden-Fundament in `package.json` etablieren
- [ ] **Biome installieren & initialisieren:**
  ```bash
  npm install --save-dev --save-exact @biomejs/biome
  npx biome init
  ```
- [ ] **`package.json`-Skripte aktualisieren:** Hinterlege `"test:unit"`, `"lint"`, `"check"`, `"typecheck"`, `"test:security"` und `"preflight"` wie in Teil 2.2 dokumentiert.
- [ ] **Ersten Pre-Flight-Lauf ausführen:**
  ```bash
  npm run preflight
  ```

### Schritt 3: Backend & Serverless API absichern
- [ ] **API-Zugriffsschutz ergänzen:** Füge in `netlify/functions/contributions.ts` eine Token- oder Secret-Prüfung ein, um unbefugte externe Schreiboperationen abzuwehren.
- [ ] **Deploy-Preview-Branches isolieren:** Hinterlege im Netlify-Dashboard unter *Deploy Previews* einen separaten Branch für `GITHUB_BRANCH`, damit Previews nicht in `main` schreiben.

### Schritt 4: Testpyramide schrittweise hochklettern
- [ ] **Stufe 1 (Unit):** Bestehende Tests in `tests/music-notation.test.mjs` über `npm run test:unit` fest in den Pre-Commit-Workflow einbinden.
- [ ] **Stufe 2 (Component):** Vitest installieren (`npm install -D vitest`), `vitest.config.ts` anlegen und erste Komponententests mit `astro/container` schreiben (`npm run test:comp`).
- [ ] **Stufe 3 (Integration):** Handler-Aufrufe der Serverless Function über Vitest mit Mock-Payloads testen (`npm run test:int`).
- [ ] **Stufe 4 (E2E & Visual):** Playwright installieren (`npm install -D @playwright/test`), `playwright.config.ts` konfigurieren und erste Browser-Simulationen für das Quiz aufsetzen (`npm run test:e2e`).

### Schritt 5: Rechtliches & Branding (Finaler Release-Schritt)
- [ ] **Favicon austauschen:** Ersetze `public/favicon.svg` durch dein eigenes Projekt-Logo.
- [ ] **Rechtliche Pflichtseiten veröffentlichen:** Lege Impressum und Datenschutzerklärung unter `src/content/docs/` an.
- [ ] **Abschluss-Audit nach Teil 4:** Führe den 5-Phasen-Auditkatalog durch und prüfe die Definition of Done (DoD).