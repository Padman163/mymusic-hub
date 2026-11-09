# [Projektname] – Modulare Web- & Dokumentationsplattform

> Universeller Architektur-Leitfaden, Entwickler-Handbuch und Release-Standard für modulare Webanwendungen und inhaltsgetriebene Plattformen auf Basis von Astro, TypeScript, modernen Linter-Tools und Serverless Functions.

---

## Inhaltsverzeichnis

1. [TEIL 1: Chronologischer Projekt-Aufbau (Step-by-Step Template)](#teil-1-chronologischer-projekt-aufbau-step-by-step-template)
   - [1. Initialisierung & Scaffolding](#1-initialisierung--scaffolding)
   - [2. Tooling, Linter & Typenprüfung](#2-tooling-linter--typenprüfung)
   - [3. Design-Tokens, globale Stile & Schriften](#3-design-tokens-globale-stile--schriften)
   - [4. Zentrale Konfiguration (astro.config.mjs & tsconfig.json)](#4-zentrale-konfiguration-astroconfigmjs--tsconfigjson)
   - [5. Komponenten- & Verzeichnis-Architektur](#5-komponenten---verzeichnis-architektur)
   - [6. Serverless Backend & Datenspeicher](#6-serverless-backend--datenspeicher)
   - [7. Testumgebung einrichten](#7-testumgebung-einrichten)
2. [TEIL 2: Entwickler-Workflows & Git-Cheatsheet](#teil-2-entwickler-workflows--git-cheatsheet)
   - [1. Start in einem neuen / geklonten Workspace](#1-start-in-einem-neuen--geklonten-workspace)
   - [2. Pre-Flight Qualitätsprüfung (Quality Gate)](#2-pre-flight-qualitätsprüfung-quality-gate)
   - [3. Git-Alltags-Workflows & Befehlsreferenz](#3-git-alltags-workflows--befehlsreferenz)
   - [4. Serverless API & Datenspeicher-Architektur](#4-serverless-api--datenspeicher-architektur)
   - [5. Deploy-Preview-Workflow für Teams & PRs](#5-deploy-preview-workflow-für-teams--prs)
3. [TEIL 3: Universelle Feature-Entwicklungs-Pipeline](#teil-3-universelle-feature-entwicklungs-pipeline)
4. [TEIL 4: Vollständige Release-Checkliste (Phasen 1 bis 5)](#teil-4-vollständige-release-checkliste-phasen-1-bis-5)
   - [Phase 1: Code-Hygiene & Automatisierte Prüfungen](#-phase-1-code-hygiene--automatisierte-prüfungen)
   - [Phase 2: Inhalt & Logik-Audit (Manuelle Checks)](#-phase-2-inhalt--logik-audit-manuelle-checks)
   - [Phase 3: Responsivität & Geräte-Kompatibilität](#-phase-3-responsivität--geräte-kompatibilität)
   - [Phase 4: Performance, SEO & Barrierefreiheit (A11y)](#-phase-4-performance-seo--barrierefreiheit-a11y)
   - [Phase 5: Rechtliches & Server-Infrastruktur](#-phase-5-rechtliches--server-infrastruktur)
   - [Definition of Done (DoD)](#-definition-of-done-dod)
5. [TEIL 5: Projekt-Audit – Was für den ersten Release noch fehlt](#teil-5-projekt-audit--was-für-den-ersten-release-noch-fehlt)

---

## TEIL 1: Chronologischer Projekt-Aufbau (Step-by-Step Template)

Dieser Ablauf dokumentiert die exakte Reihenfolge, in der ein neues Astro-Projekt von Grund auf sauber, typensicher und wartbar aufgesetzt wird:

### 1. Initialisierung & Scaffolding

```bash
# 1. Astro mit Starlight (für Dokumentationen) oder Minimal-Template initialisieren
npm create astro@latest mein-projekt -- --template starlight

# 2. In das Verzeichnis wechseln
cd mein-projekt

# 3. Basis-Abhängigkeiten installieren
npm install
```

### 2. Tooling, Linter & Typenprüfung

Zur Sicherstellung einheitlicher Code-Standards vor dem ersten geschriebenen Feature:

```bash
# Biome als extrem schneller All-in-One Linter & Formatter
npm install --save-dev --save-exact @biomejs/biome
npx biome init

# Astro-Komponenten- & Typenprüfung (prüft .astro-Templates & Frontmatter)
npm install --save-dev @astrojs/check typescript @types/node

# Markdown- & Formel-Pipelines (optional für wissenschaftliche/technische Projekte)
npm install remark-math rehype-katex katex

# Serverless Backend & Bildoptimierung
npm install @netlify/functions sharp
```

### 3. Design-Tokens, globale Stile & Schriften

Trennung der visuellen Ebenen unter `src/styles/`:
* `src/styles/variables.css`: Zentrale Design-Tokens (Farbpalette, Abstände, Schriftgrößen).
* `src/styles/layout.css`: Globale Anpassungen für Navigation, Sidebar, Raster und Inhaltsbreiten.
* `src/styles/components.css`: Wiederverwendbare Basisstile für interaktive UI-Elemente.
* **Webfonts & Symbole:** Lokale Schriftdateien (`.woff2`) gehören unter `public/fonts/`, um DSGVO-Konformität und minimale Latenzen ohne externe CDN-Aufrufe zu sichern.

### 4. Zentrale Konfiguration (`astro.config.mjs` & `tsconfig.json`)

#### `astro.config.mjs`
```javascript
// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { unified } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

export default defineConfig({
  // Kanonische Basis-URL (Zwingend nötig für korrekte Sitemaps und OpenGraph-Tags)
  site: 'https://deine-domain.netlify.app',
  output: 'static', // 'static' für SSG, 'server' für SSR mit Adapter
  markdown: {
    processor: unified({
      remarkPlugins: [remarkMath],
      rehypePlugins: [rehypeKatex],
    }),
  },
  integrations: [
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
          label: 'Dokumentation & Module',
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
      "@lib/*": ["src/lib/*"],
      "@styles/*": ["src/styles/*"]
    }
  }
}
```

### 5. Komponenten- & Verzeichnis-Architektur

Die Architektur folgt dem **Lego-Prinzip (Separation of Concerns)**:

```text
mein-projekt/
├── public/                     # Statische Dateien (unverändert ausgeliefert)
│   ├── favicon.svg             # Vektor-Favicon
│   ├── robots.txt              # Crawler-Führung & Sitemap-Verweis
│   └── fonts/                  # Lokale DSGVO-konforme Webfonts
├── src/
│   ├── assets/                 # Lokale Bilder & Grafiken für Astros Optimierungs-Pipeline
│   ├── components/             # Astro- & UI-Komponenten
│   │   ├── ui/                 # Zustandslose Präsentationskomponenten (Buttons, Badges, Tabs)
│   │   └── features/           # Fachliche Manager-Komponenten (bündeln Logik & Teilbausteine)
│   ├── content/                # Strukturierter Inhaltsbestand (MDX/Markdown)
│   ├── content.config.ts       # Typisierte Frontmatter-Schemata via Zod
│   ├── layouts/                # HTML-Grundgerüste (<BaseLayout.astro>)
│   ├── lib/                    # Reine Geschäftslogik & Datenberechnungen (100% TypeScript)
│   ├── pages/                  # Datei-basiertes Routing (404.astro, index.astro)
│   └── styles/                 # Globale Design-Tokens, Resets und CSS-Module
├── tests/                      # Automatisierte Unit-Tests (*.test.mjs)
├── netlify/                    # Serverless Functions & Endpunkte
├── data/                       # Datendateien (z. B. contributions.json)
├── .env.example                # Dokumentierte Vorlage aller Umgebungsvariablen
├── .gitignore                  # Git-Ausschlussregeln
├── astro.config.mjs            # Framework-Konfiguration
├── biome.json                  # Linter- & Formatter-Regeln
├── package.json                # Skripte und Paketabhängigkeiten
└── tsconfig.json               # Strikte TypeScript-Compileroptionen
```

### 6. Serverless Backend & Datenspeicher

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
2. **Serverless Function anlegen (`netlify/functions/contributions.ts`):** Verarbeitet Lese- und Schreiboperationen über eine entkoppelte API.
3. **Datenspeicher (`data/contributions.json`):** Als leeres JSON-Array `[]` initialisieren.

### 7. Testumgebung einrichten

Astro-Projekte nutzen den nativen Node.js Test-Runner (schnell, typsicher, ohne schwere Dritt-Frameworks):
* Testdatei anlegen: `tests/core-logic.test.mjs`
* In `package.json` unter `"scripts"` registrieren:
  ```json
  "scripts": {
    "dev": "astro dev",
    "start": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "check": "astro check",
    "lint": "biome check .",
    "format": "biome format --write .",
    "test": "node --test tests/*.test.mjs",
    "preflight": "npx @biomejs/biome check . && npx astro check && npx tsc --noEmit && npm test && npm run build && git diff --check"
  }
  ```

---

## TEIL 2: Entwickler-Workflows & Git-Cheatsheet

### 1. Start in einem neuen / geklonten Workspace

#### Anwendung starten (Reines Frontend / Dokumentation)
```bash
# 1. Abhängigkeiten installieren
npm install

# 2. Lokalen Entwicklungsserver starten
npm run dev
```
*Erreichbar unter `http://localhost:4321`. Serverless Functions sind in diesem Modus inaktiv.*

#### Anwendung starten (Mit Serverless Functions & Backend)
```bash
# 1. Abhängigkeiten installieren & Produktions-Build vorbereiten
npm install
npm run build

# 2. Netlify CLI mit Projekt verknüpfen (einmalig)
npx netlify-cli login
npx netlify-cli link

# 3. Synchronen Dev-Server starten
npx netlify-cli dev
```
*Frontend und Serverless Functions laufen synchron unter `http://localhost:8888`.*

---

### 2. Pre-Flight Qualitätsprüfung (Quality Gate)

Vor jedem Push oder Pull Request muss die automatisierte Prüfkette fehlerfrei mit Exit-Code `0` durchlaufen:

```bash
# Einzeiler für alle Prüfungen
npm run preflight
```

#### Die Prüfschritte im Detail:
1. `npx @biomejs/biome check .`: Prüft Syntax, Formatierung und ungenutzte Imports.
2. `npx astro check`: Prüft `.astro`-Templates, Frontmatter und Props.
3. `npx tsc --noEmit`: Führt eine strikte TypeScript-Typprüfung im gesamten Projekt durch.
4. `npm test`: Führt alle Unit-Tests in `tests/` über den Node-Testrunner aus.
5. `npm run build`: Simuliert den Produktions-Build und validiert Chunk-Größen.
6. `git diff --check`: Findet Whitespace-Fehler und verbliebene Merge-Konflikt-Marker.

---

### 3. Git-Alltags-Workflows & Befehlsreferenz

#### Feature-Branches erstellen & wechseln
```bash
# Neuen Branch anlegen und direkt aktivieren
git switch -c feature/mein-feature

# Zwischen Branches wechseln
git switch main
git switch feature/mein-feature

# Alle lokalen und entfernten Branches anzeigen
git branch -a
```

#### Änderungen versionieren & übertragen
```bash
# Status modifizierter Dateien prüfen
git status

# Alle Änderungen vormerken
git add .

# Konventionellen Commit mit prägnanter Nachricht erstellen
git commit -m "feat(api): token-basierte validierung implementiert"

# Neuen Branch erstmals an Remote übertragen
git push -u origin feature/mein-feature

# Folge-Commits pushen
git push
```

#### Synchronisation & Merging
```bash
# Neuesten Stand vom Server laden (ohne lokalen Arbeitsstand zu verändern)
git fetch origin

# Main-Branch lokal aktualisieren
git switch main
git pull origin main

# Remote-Main in den aktuellen Branch integrieren
git merge origin main
```

#### Aktuellsten oder älteren Branch holen & synchronisieren
```bash
# Aktuellsten Stand eines Branches holen und lokalen Stand hart überschreiben
git fetch origin
git switch <aktuellsten-branch>
git reset --hard origin/<aktuellsten-branch>

# Älteren historischen Branch holen
git switch <aelteren-branch>
git fetch origin
git reset --hard origin/<aelteren-branch>

# Älteren Branch holen und Arbeitsbaum gezielt mit dem Stand eines neueren Branches auffüllen
git switch <aelteren-branch>
git fetch origin
git reset --hard origin/<aelteren-branch>
git restore --source=origin/<aktuellsten-branch> --worktree -- .
```

#### Commits zurücknehmen & HEAD-Erklärung
```bash
# Letzten Commit zurücknehmen (Änderungen bleiben im Dateisystem als modifiziert erhalten)
git reset HEAD~1
```
* **`HEAD`:** Zeiger auf den aktuellen Commit, auf dem du dich befindest.
* **`HEAD~1`:** Der direkte Vorgänger-Commit (1 Schritt zurück).
* **`HEAD~2`:** Der Vor-Vorgänger-Commit (2 Schritte zurück).

#### Aufräumen, Archivieren & Notfall-Fixes
```bash
# Ungetrackte Restdateien und Build-Reste radikal löschen
git clean -fd

# Branch umbenennen / ins Archiv verschieben
git branch -m <branch-name> archive/<branch-name>

# Archivierten Branch auf GitHub übertragen
git push origin -u archive/<branch-name>

# Remote-Branch auf GitHub löschen
git push origin --delete <branch-name>

# Windows/PowerShell Notfall-Reset (nach Terminal-Absturz oder blockierter index.lock)
Remove-Item .git\index.lock -Force -ErrorAction SilentlyContinue
git checkout -f main
```

---

### 4. Serverless API & Datenspeicher-Architektur

Die Netlify Function (`netlify/functions/contributions.ts`) nimmt strukturierte Daten entgegen und speichert sie via GitHub REST API in `data/contributions.json`.

#### Umgebungsvariablen (`.env`)
| Variable | Beschreibung | Standard / Beispiel |
| :--- | :--- | :--- |
| `GITHUB_TOKEN` | Fine-grained Personal Access Token (Repo-Schreibrechte) | `ghp_abc123...` |
| `GITHUB_REPOSITORY` | Pfad zum Zielrepository | `owner/repository` |
| `GITHUB_BRANCH` | Zielbranch für Datenspeicherung | `main` |
| `GITHUB_DATA_PATH` | Pfad zur JSON-Datei im Repository | `data/contributions.json` |

#### Sicherheits- und Architektur-Regeln:
1. **Kein Token ins Frontend:** Das GitHub-Token darf **niemals** mit dem Präfix `PUBLIC_` versehen oder in statische Komponenten importiert werden.
2. **Entkopplung:** Die API ist unabhängig von der Speicherschicht gekapselt. Die GitHub-REST-Speicherung kann jederzeit ohne Frontend-Umbau gegen eine echte Datenbank (Supabase, PostgreSQL) ausgetauscht werden.
3. **Schreib-Konflikte (HTTP 409):** Bei simultanen Schreibvorgängen auf die JSON-Datei fängt eine automatische Retry-Logik (bis zu 3 Versuche mit Exponential-Backoff) Versionskonflikte des GitHub-Blobs ab.
4. **Beitrags-Manager Regeln:**
   - **Typen:** `Feature`, `Bug`, `Decision`.
   - **Bereiche:** Frei definierbare Kategorien (z. B. `Theorie`, `Praxis`, `Komponente`).
   - **Prioritäten:** `Hoch`, `Mittel` (Standard), `Niedrig`.
   - **Status:** `New` (Standard), `Active`, `Resolved`.
   - **Checklisten:** Jeder Eintrag unterstützt bis zu 100 Checklistenpunkte à maximal 200 Zeichen. Das Abhaken erfolgt über State-Updates und persistiert beim Speichern.

---

### 5. Deploy-Preview-Workflow für Teams & PRs

1. **Repository verknüpfen:** `main` als Produktionsbranch in Netlify definieren und Deploy Previews aktivieren.
2. **Pull Request öffnen:** Vom Feature-Branch einen PR gegen `main` erstellen. Netlify baut eine isolierte Preview-URL.
3. **Vorsicht bei Preview-Schreibzugriffen:** In Netlify müssen Umgebungsvariablen für den Kontext *Deploy Previews* separat konfiguriert werden! Ohne explizite Zuweisung eines Test-Branches schreibt die Serverless Function auch in einer Test-Preview direkt in den Produktions-Ast (`main`).
4. **Schutz vor Endlosschleifen:** Die `netlify.toml` ignoriert Commits an `data/**`, damit Datenspeichervorgänge der API nicht fortlaufend neue Deploy-Vorgänge triggern.

---

## TEIL 3: Universelle Feature-Entwicklungs-Pipeline

Jedes neue Modul und jedes neue Feature wird modular in 5 Schritten aufgebaut:

```text
Stufe 1: Typ- & Datendefinition (src/lib/types.ts oder src/content.config.ts)
         └── Zod-Schemata, Interfaces und Datenmodelle festlegen

Stufe 2: Reine Geschäfts- & Berechnungslogik (src/lib/feature-logic.ts)
         └── Algorithmen, Parser, Validatoren (100% TypeScript, DOM-frei)

Stufe 3: Automatisierte Unit-Tests (tests/feature-logic.test.mjs)
         └── Mathematische Logik, Parsing & Randfälle mit 'node --test' absichern

Stufe 4: UI- & Manager-Komponenten (src/components/features/FeatureManager.astro)
         └── Bündelt Präsentationsbausteine aus src/components/ui/ und kapselt die Logik

Stufe 5: Dokumentation & Lektions-Integration (src/content/docs/...)
         └── Rein deklaratives MDX; bindet Manager-Komponenten über Props ein
```

---

## TEIL 4: Vollständige Release-Checkliste (Phasen 1 bis 5)

### 🛠️ Phase 1: Code-Hygiene & Automatisierte Prüfungen
- [ ] **Linter & Formatter (`biome check .`):** Keine Syntaxabweichungen, ungenutzten Variablen oder toten Imports.
- [ ] **Astro Template-Prüfung (`astro check`):** Alle Props, Datentypen und `.astro`-Dateien fehlerfrei validiert.
- [ ] **TypeScript-Check (`tsc --noEmit`):** Compiler wirft 0 Typfehler bei strikter Konfiguration.
- [ ] **Unit-Testabdeckung (`npm test`):** Alle Logik-, Validierungs- und Parsingtests sind grün.
- [ ] **Produktions-Build (`npm run build`):** Generiert fehlerfrei das Verzeichnis `dist/`.
- [ ] **Bereinigung von Debug-Code:** Volltextsuche nach `console.log(...)` im Client-Code durchgeführt; temporäre KI-Notizen entfernt.
- [ ] **Secret-Hygiene:** Keine API-Tokens oder Passwörter im Repository; `.env` steht in `.gitignore`; `.env.example` ist aktuell.

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
- [ ] **Favicon-Matrix:** Standard-Astro-Icon durch eigenes Set (`favicon.svg`, `apple-touch-icon.png`) ersetzt.
- [ ] **Lighthouse-Audit:** Google Chrome Lighthouse Score von **90+ Punkten** in Performance, Accessibility, Best Practices und SEO.

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

## TEIL 5: Projekt-Audit – Was für den ersten Release noch fehlt

Die folgende projektspezifische Checkliste fasst alle Abweichungen zusammen, die in deiner Codebase vor dem offiziellen Livegang noch behoben werden müssen:

### 1. Konfiguration & Build-Warnungen
- [ ] **`site`-Parameter in `astro.config.mjs` ergänzen:**
  Aktuell fehlt die Basis-URL. Trage `site: 'https://deine-domain.netlify.app'` ein, um die Warnungen bei der Sitemap- und RSS-Erstellung zu beheben.
- [ ] **Eigene 404-Fehlerseite anlegen:**
  Erstelle die Datei `src/pages/404.astro` mit Link zurück zur Startseite, um die Build-Warnung für fehlende Fehler-Routen zu schließen.
- [ ] **Leere i18n-Spracheinträge bereinigen:**
  In `astro.config.mjs` unvollständige Locale-Blöcke vervollständigen oder ungenutzte Sprachen entfernen.
- [ ] **Bundle-Splitting für schwere Bibliotheken:**
  Chunk-Größen von großen Paketen (wie KaTeX oder AlphaTab) optimieren und nur seitenweise dynamisch importieren.

### 2. Sicherheit & Backend-Infrastruktur
- [ ] **Vorlage `.env.example` im Root-Verzeichnis einchecken:**
  Hinterlege eine Beispieldatei mit `GITHUB_TOKEN=`, `GITHUB_REPOSITORY=` und `GITHUB_BRANCH=`.
- [ ] **Serverless API absichern (`netlify/functions/contributions.ts`):**
  Aktuell kann jeder Webseitenbesucher unkontrolliert Schreibvorgänge in dein GitHub-Repository auslösen. Füge ein Authentifizierungs-Token, ein Shared-Secret im Header oder ein Captcha/Rate-Limiting ein.
- [ ] **Deploy-Preview-Branches in Netlify isolieren:**
  Setze im Netlify-Dashboard für den Deploy-Preview-Kontext eine abweichende Variable `GITHUB_BRANCH` (z. B. auf einen Test-Branch), damit Test-Previews nicht in den `main`-Zweig schreiben.

### 3. Tooling & Skripte (`package.json`)
- [ ] **Pre-Flight-Befehl vereinheitlichen:**
  Füge `"preflight": "npx @biomejs/biome check . && npx astro check && npx tsc --noEmit && npm test && npm run build && git diff --check"` in die `scripts` deiner `package.json` ein.
- [ ] **Biome-Konfiguration initialisieren:**
  Führe `npx biome init` aus, um einheitliche Einrückungen und Linter-Regeln festzuschreiben.

### 4. Rechtliches & Asset-Branding
- [ ] **Astro-Favicon austauschen:**
  Ersetze `public/favicon.svg` durch dein eigenes Plattform-Logo.
- [ ] **Rechtliche Pflichtseiten erstellen:**
  Erstelle `src/content/docs/impressum.mdx` und `src/content/docs/datenschutz.mdx` (inklusive Hinweisen zum Hosting und zu lokalen Schriften).