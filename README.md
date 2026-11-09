# [Projektname] – Universelles Web- & Dokumentations-Template

Universeller Architektur-Leitfaden, Entwickler-Handbuch und Release-Checkliste für modulare Webanwendungen und Dokumentationsplattformen auf Basis von Astro, TypeScript, modernen Linter-Tools und Serverless Functions.

---

## TEIL 1: Chronologischer Projekt-Aufbau (Step-by-Step für Folgeprojekte)

Dieser Ablauf dokumentiert die standardisierte Reihenfolge, um ein neues Web- und Dokumentationsprojekt mit vollständiger Entwickler-Infrastruktur reproduzierbar aufzusetzen:

### 1. Astro-Starlight-Vorlage erstellen
```bash
# Astro mit Starlight-Vorlage für Dokumentationen initialisieren
npm create astro@latest mein-projekt -- --template starlight

# In das Projektverzeichnis wechseln
cd mein-projekt

# Basis-Abhängigkeiten installieren
npm install
```

### 2. Tooling, Linter & Typenprüfung installieren
```bash
# Biome als extrem schneller Linter & Formatter
npm install --save-dev --save-exact @biomejs/biome
npx biome init

# Astro-Komponenten- & Typenprüfung
npm install --save-dev @astrojs/check typescript @types/node

# Formel- und Rendering-Pipelines (optional für mathematische/technische Dokumentation)
npm install remark-math rehype-katex katex

# Serverless Backend & Bildoptimierung
npm install @netlify/functions sharp
```

### 3. Schriftarten, Design-Tokens & globale Styles einrichten
Lege eine saubere Trennung der Stil-Ebenen unter `src/styles/` an:
* `src/styles/variables.css`: Design-Tokens (Farbpalette, Abstände, Typografie).
* `src/styles/layout.css`: Globale Anpassungen für Navigation, Sidebar und Inhaltsbreiten.
* `src/styles/components.css`: Globale Komponentenstile.
* **Webfonts / Symbole:** Externe Webfonts oder SMuFL-Schriftarten (z. B. Bravura) unter `public/fonts/` ablegen.

### 4. Konfiguration anpassen (`astro.config.mjs`)
Verbinde Markdown-Plugins, Stile und Sidebar-Strukturen:
```javascript
// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { unified } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

export default defineConfig({
  // Kanonische URL für SEO & Sitemap-Generierung (verhindert Build-Warnungen)
  site: '[https://deine-domain.netlify.app](https://deine-domain.netlify.app)',
  markdown: {
    processor: unified({
      remarkPlugins: [remarkMath],
      rehypePlugins: [rehypeKatex],
    }),
  },
  integrations: [
    starlight({
      title: 'Mein Projekt-Hub',
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

### 5. Komponenten- & Modul-Architektur
Strukturiere das Projekt nach dem **Lego-Prinzip (Kapselung)**:
* `src/lib/`: Reine Geschäftslogik, Datenverarbeitung und Hilfsfunktionen (reines TypeScript, framework-unabhängig).
* `src/components/ui/`: Kleine, wiederverwendbare UI-Elemente (Buttons, Tags, Formulare).
* `src/components/features/`: Manager-Komponenten, die interne Logik bündeln und Markdown-Dateien schlank halten.
* `src/content/docs/`: Rein deklarative Markdown/MDX-Dateien ohne Inline-Skripte oder rohes HTML.

### 6. Serverless Backend & Datenspeicher (Netlify Functions)
1. **Netlify-Konfiguration (`netlify.toml`):**
   ```toml
   [build]
     command = "npm run build"
     publish = "dist"
     functions = "netlify/functions"

   # Verhindert endlose Build-Schleifen bei Datenspeicherung im Repository
   [context.production]
     ignore = "git diff --quiet $CACHED_COMMIT_REF $COMMIT_REF -- . ':(exclude)data/**'"
   ```
2. **Serverless Function anlegen (`netlify/functions/contributions.ts`):** Nimmt Lese- und Schreibzugriffe entgegen und speichert Daten (z. B. via GitHub REST API in eine JSON-Datei).
3. **Initiale Datendatei (`data/contributions.json`):** Als leeres JSON-Array `[]` im Repository bereitstellen.

### 7. Testumgebung einrichten
* Testdateien unter `tests/` anlegen (z. B. `tests/core-logic.test.mjs`).
* In `package.json` unter `"scripts"` folgende Standardkommandos registrieren:
  ```json
  "scripts": {
    "dev": "astro dev",
    "start": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "check": "astro check",
    "lint": "biome check .",
    "test": "node --test tests/*.test.mjs"
  }
  ```

---

## TEIL 2: Entwickler-Workflows & Git-Cheatsheet

### 1. Start in einem neuen / geklonten Workspace

#### Anwendung starten (ohne Netlify)
Für reines Frontend- und Dokumentations-Testing:
```bash
npm install
npm run dev
```
*Startet den Astro-Devserver unter `http://localhost:4321`. Serverless Functions sind inaktiv.*

#### Anwendung starten (mit Netlify)
Für vollständige lokale Entwicklung inklusive Serverless Functions und Datenspeicherung:
```bash
npm install
npm run build
npx netlify-cli login
npx netlify-cli link
npx netlify-cli dev
```
*Startet Frontend und Netlify Functions synchron unter `http://localhost:8888`.*

---

### 2. Pre-Flight Qualitätsprüfung vor jedem Commit
Vor jedem Push müssen alle Prüfschritte lokal fehlerfrei mit Exit-Code `0` durchlaufen:
```bash
# 1. Linter & Formatter ausführen
npx @biomejs/biome check .

# 2. Astro Komponenten- und Typenprüfung
npx astro check

# 3. Strikte TypeScript-Prüfung
npx tsc --noEmit

# 4. Automatisierte Unit-Tests
npm test

# 5. Produktions-Build testen
npm run build

# 6. Whitespace- und Git-Konflikte prüfen
git diff --check
```

---

### 3. Git-Alltags-Workflows & Befehlsübersicht

#### Neuen Branch erstellen & wechseln
```bash
# Neuen Feature-Branch anlegen und direkt aktivieren
git switch -c <neuer-branch>

# Vorhandenen Branch wechseln
git switch main
git switch <neuer-branch>

# Alle lokalen und entfernten Branches anzeigen
git branch -a
```

#### Aktuellsten Branch holen
```bash
git fetch origin
git switch <aktuellsten-branch>
git reset --hard origin/<aktuellsten-branch>
```

#### Älteren Branch holen
```bash
git switch <älteren-branch>
git fetch origin
git reset --hard origin/<älteren-branch>
```

#### Älteren Branch holen und Worktree auffüllen zu aktuellstem Branch
```bash
git switch <älteren-branch>
git fetch origin
git reset --hard origin/<älteren-branch>
git restore --source=origin/<aktuellsten-branch> --worktree -- .
```
*Zusätzliche Aufräumbefehle:*
* **Löscht anstehende / ungetrackte Dateien:** `git clean -fd`
* **Löscht Push / setzt Arbeitsbaum zurück:** `git reset --hard origin/<älteren-branch>`

#### Commits löschen / zurücknehmen & HEAD-Erklärung
```bash
git reset HEAD~1
```
* **`HEAD`:** Zeiger auf deinen aktuellen Commit.
* **`HEAD~1`:** Direkter Vorgänger-Commit (1 Schritt zurück).
* **`HEAD~2`:** Vor-Vorgänger-Commit (2 Schritte zurück).
*(Die Code-Änderungen bleiben bei `git reset HEAD~1` im Arbeitsverzeichnis erhalten).*

#### Auf Origin zurücksetzen
```bash
git reset --hard origin/<branch-name>
```
*(Verwirft alle lokalen Änderungen und setzt den Branch exakt auf den Remote-Stand).*

#### Mergen des Branch
```bash
# Neuesten Stand vom Server laden
git fetch origin

# Änderungen aus dem Remote-Main in den aktuellen Branch integrieren
git merge origin main
```

#### Sonstige Befehle (Archivieren, Löschen & Notfall-Fixes)
1. **Branch umbenennen / ins Archiv verschieben:**
   ```bash
   git branch -m <kopierter-branch> archive/<eingefügter-branch>
   ```
2. **Kopierten / archivierten Branch auf GitHub pushen:**
   ```bash
   git push origin -u archive/<eingefügter-branch>
   ```
3. **Branch auf dem Remote-Server löschen:**
   ```bash
   git push origin --delete <branch>
   ```
4. **Prozesse abbrechen und erzwungen auf main wechseln:**
   ```powershell
   Remove-Item .git\index.lock -Force -ErrorAction SilentlyContinue
   git checkout -f main
   ```
   *(Entfernt blockierende Lock-Dateien nach Terminal-Abstürzen und erzwingt den Wechsel auf `main`).*

---

### 4. IssueTracker-Beiträge & Datenspeicherung

Die Netlify Function unter `netlify/functions/contributions.ts` nimmt strukturierte Daten entgegen und speichert sie via GitHub REST API in `data/contributions.json` im GitHub-Repository.

#### Erforderliche Umgebungsvariablen (Environment)
In Netlify müssen folgende Umgebungsvariablen hinterlegt werden:
* `GITHUB_TOKEN`: Fine-grained Personal Access Token mit Lese- und Schreibzugriff auf den Repository-Inhalt. **Darf NICHT als öffentlich sichtbares Secret im Frontend definiert werden**.
* `GITHUB_REPOSITORY`: Repository im Format `owner/repository`.
* `GITHUB_BRANCH`: Zielbranch für Schreiboperationen (optional, Standard: `main`).
* `GITHUB_DATA_PATH`: Speicherpfad der JSON-Datei (optional, Standard: `data/contributions.json`).

#### Sicherheits- und Architektur-Hinweise
* Das Token darf unter keinen Umständen im Frontend-Code oder in öffentlich eingecheckten Dateien hinterlegt werden.
* Bis eine Benutzer-Authentifizierung ergänzt ist, kann jeder Besucher die öffentliche API zum Einreichen von Beiträgen aufrufen.
* Einträge sind entsprechend der Sichtbarkeit des Repositories einsehbar; vertrauliche Daten sollten daher nicht eingereicht werden.
* Die API ist modular von der Speicherung getrennt, sodass die GitHub-JSON-Speicherung später durch eine echte Datenbank (z. B. Supabase, PostgreSQL) ersetzt werden kann.
* Lokales `npm run dev` startet keine Netlify Functions; für API-Funktionen wird `npx netlify-cli dev` benötigt.

#### Funktionslogik des Beitrags-Managers
* **Filterung & Sortierung:** Einträge können nach Typ, Bereich und Priorität gefiltert sowie nach Datum und Priorität sortiert werden.
* **Kategorien & Prioritäten:**
  * **Typen:** `Feature`, `Bug`, `Decision`.
  * **Bereiche:** Frei definierbar (z. B. `Theorie`, `Praxis`, `Komponente`).
  * **Prioritäten:** `Hoch`, `Mittel`, `Niedrig` (`Mittel` ist Standardwert).
  * **Status:** `New`, `Active`, `Resolved` (`New` ist Standardwert).
* **Inhaltsregeln:**
  * Die Beschreibung ist optional und wird in der Listenübersicht auf drei Zeilen gekürzt.
  * Beiträge können bis zu 100 Checklistenpunkte mit je maximal 200 Zeichen enthalten.
  * Punkte werden beim Bearbeiten hinzugefügt, entfernt oder abgehakt und beim Speichern persistiert.

---

### 5. Deploy Preview Workflow für die Entwicklung

1. Das GitHub-Repository in Netlify verknüpfen, `main` als Produktionsbranch wählen und **Deploy Previews** in den Build-Einstellungen aktivieren.
2. Einen Pull Request vom Feature-Branch nach `main` öffnen. Netlify baut dafür automatisch eine eigene Preview-URL, ohne die Produktionsseite zu verändern.
3. Weitere Änderungen auf den Feature-Branch pushen; der offene Pull Request erhält automatisch eine aktualisierte Preview.
4. Erst nach erfolgreicher Prüfung der Preview den Pull Request nach `main` mergen.

#### Besondere Hinweise zu Deploy Previews & Kosten:
* **Umgebungsvariablen isolieren:** Für den Deploy-Preview-Kontext müssen die Umgebungsvariablen in Netlify separat gesetzt werden, wenn das Speichern getestet werden soll. Ohne explizites `GITHUB_BRANCH` schreibt die Function auch in einer Preview direkt nach `main`! Für isolierte Tests empfiehlt sich ein separates Test-Repository oder ein Test-Branch.
* **Endlosschleifen-Schutz:** Die Produktionskonfiguration in `netlify.toml` überspringt Builds, wenn seit dem letzten erfolgreichen Build ausschließlich `data/contributions.json` geändert wurde. Dadurch löst nicht jeder gespeicherte Beitrag einen neuen Produktions-Deploy aus.
* **Netlify-Credits:** Deploy Previews haben keine gesonderte Deploy-Gebühr, verbrauchen aber je nach Nutzung Bandbreite, Function-Ausführungen und Build-Minuten aus dem monatlichen Kontingent.

---

## TEIL 3: Universelle Feature-Entwicklungs-Pipeline

Gehe bei der Entwicklung neuer Features immer nach diesem 5-Stufen-Muster vor:

```text
1. Typ- & Datendefinition (src/types/ oder src/lib/)
   └── Interfaces, Enums und Validierungsschemata anlegen

2. Reine Geschäftslogik (src/lib/feature-logic.ts)
   └── Berechnungen, Filter- und Transformationsfunktionen (100% TypeScript)

3. Automatisierte Tests (tests/feature-logic.test.mjs)
   └── Logik und Randfälle mit 'node --test' absichern

4. UI-Komponenten (src/components/features/FeatureManager.astro)
   └── Astro-Komponente bindet die Logik ein und kapselt Unterkomponenten

5. Dokumentation & Integration (src/content/docs/...)
   └── MDX-Seiten binden die Manager-Komponente über saubere Props ein
```

---

## TEIL 4: Vollständige Release-Checkliste (Phasen 1 bis 5)

### 🛠️ Phase 1: Code-Hygiene & Automatisierte Prüfungen
- [ ] **Linter & Formatter (`biome check`)**
  - Befehl: `npx @biomejs/biome check .`
  - Keine Syntaxfehler, ungenutzten Variablen oder toten Imports mehr vorhanden.
- [ ] **Astro Typen- & Komponentenprüfung (`astro check`)**
  - Befehl: `npx astro check`
  - Alle Props, Datenübergaben und `.astro`-Templates sind fehlerfrei typisiert.
- [ ] **Produktions-Build testen (`astro build`)**
  - Befehl: `npm run build`
  - Der Build läuft lokal mit **0 Fehlern** durch und erzeugt den Ordner `dist/`.
- [ ] **Bereinigung von Debug-Code**
  - Keine verbliebenen `console.log(...)`-Befehle im Client-Code.
  - Veraltete Kommentare und Test-Dateien der KI entfernt.
- [ ] **Sicherheit: Geheimnisse & API-Keys**
  - Keine Passwörter, Token oder geheimen Keys im Quellcode oder Git-Repository.
  - Nur öffentlich vorgesehene Client-Variablen nutzen das Präfix `PUBLIC_`.
  - `.env` ist in der `.gitignore` eingetragen; eine `.env.example` dient als Vorlage.

---

### 🧠 Phase 2: Inhalt & Logik-Audit (manuelle Checks)
- [ ] **Vollständige Entfernung von Dummy-Inhalten**
  - Volltextsuche nach Platzhaltern wie: `Lorem`, `TODO`, `Test`, `Mock`, `Placeholder`, `asdf`.
  - Alle Lektionen, Quizzes und Dokumentationsseiten enthalten echte, geprüfte Inhalte.
- [ ] **Interaktionsprüfung aller Buttons & Links**
  - Keine „Dead Buttons“ mit leerem Link (`href="#"`) oder Dummy-Klickhandlern.
  - Alle internen Links leiten zur richtigen Seite oder Unterseite.
  - Alle externen Links öffnen korrekt (idealerweise mit `rel="noopener noreferrer"`).
- [ ] **Lernpfad-Navigation & Ablauflogik**
  - Vor- und Zurück-Buttons führen in der didaktisch korrekten Reihenfolge.
  - Abgeschlossene Module werden visuell eindeutig als erledigt gekennzeichnet.
- [ ] **Zustandsspeicherung (State / Progress)**
  - Fortschritte (z. B. über `localStorage` gespeichert) bleiben nach Neuladen der Seite erhalten.
  - Falls vorhanden: Reset-Funktion („Fortschritt zurücksetzen“) funktioniert wie erwartet.

---

### 📱 Phase 3: Responsivität & Geräte-Kompatibilität
- [ ] **Echtes Smartphone-Testing**
  - Auf mindestens einem physischen Smartphone (iOS oder Android) getestet.
  - Keine horizontalen Scrollbalken (horizontales Ausbrechen des Layouts).
  - Alle Schaltflächen und Navigationspunkte sind mit dem Daumen gut treffbar (mind. 44×44 Pixel).
- [ ] **Cross-Browser-Gegenprobe**
  - **Chrome / Chromium:** Standardprüfung für Desktop und Android.
  - **Safari (iOS / macOS):** WebKit-Prüfung auf abweichende CSS-Flexbox/Grid-Abstände.
  - **Firefox:** Prüfung auf Rendering-Auffälligkeiten.
- [ ] **Dark- / Light-Mode (falls integriert)**
  - Texte bleiben in beiden Modi kontrastreich und lesbar.
  - Grafiken, Notensysteme und Icons passen sich farblich an.

---

### ⚡ Phase 4: Performance, SEO & Barrierefreiheit (A11y)
- [ ] **Bilder & Medien-Optimierung**
  - Bilder liegen in modernen Formaten vor (WebP oder AVIF).
  - Bilder werden über Astros eigene `<Image />`-Komponente geladen (automatische Größenanpassung).
  - Keine unkomprimierten Multi-Megabyte-Dateien im Verzeichnis `public/`.
- [ ] **Barrierefreiheit (Accessibility)**
  - Alle informativen Bilder besitzen ein aussagekräftiges `alt`-Attribut.
  - Logische Überschriftenstruktur eingehalten (nur ein einziges `h1` pro Seite, danach saubere `h2` und `h3`).
  - Text-zu-Hintergrund-Kontraste genügen mindestens dem WCAG AA-Standard.
- [ ] **Favicon & Meta-Informationen**
  - Standard-Astro-Favicon (`favicon.svg`) durch eigenes Logo/Icon ersetzt.
  - Jede Seite verfügt über einen aussagekräftigen `<title>` und eine `<meta name="description">`.
  - Social-Media-Vorschau (Open Graph / Twitter Card Tags inkl. `og:image`) konfiguriert.
- [ ] **Lighthouse-Audit**
  - Google Chrome DevTools $\rightarrow$ Lighthouse-Audit ausführen.
  - Ziel: Performance, Accessibility, Best Practices und SEO jeweils bei **90+ Punkten**.

---

### ⚖️ Phase 5: Rechtliches & Server-Infrastruktur
- [ ] **Rechtliche Pflichtseiten (DACH-Raum)**
  - Vollständiges, leicht auffindbares **Impressum** (Diensteanbieter, Anschrift, Kontakt).
  - DSGVO-konforme **Datenschutzerklärung** (Angabe von Hosting-Provider, Analysetools, Schriftarten).
- [ ] **Eigene 404-Fehlerseite (`src/pages/404.astro`)**
  - Nutzerfreundliche Fehlerseite vorhanden.
  - Enthält einen direkten Link zurück zur Startseite oder Dokumentation.
- [ ] **Hosting & Domain**
  - SSL/HTTPS-Zertifikat ist aktiv (automatisch bei Netlify, Vercel etc.).
  - Eigene Domain erfolgreich verbunden (inkl. Weiterleitung von `http` auf `https` und `www` auf non-`www`).
- [ ] **Build-Umgebungsvariablen**
  - Alle für den Produktionsbetrieb nötigen Variablen im Dashboard des Hoster-Dienstes hinterlegt.

---

## 📋 Definition of Done (DoD)

Das Projekt gilt erst dann als **bereit für den Release**, wenn:
1. Alle Befehle des Pre-Flight-Skripts mit Exit-Code `0` durchlaufen:
   ```bash
   npx @biomejs/biome check . && npx astro check && npm run build
   ```
2. Mindestens ein vollständiger Durchlauf der Kernfunktionen auf einem mobilen Endgerät erfolgreich protokolliert wurde.
3. Impressum, Datenschutzerklärung und 404-Seite funktionstüchtig live geschaltet sind.