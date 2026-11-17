# Leitfaden für Sicherheit, Testing-Pyramide & Release-Audit

Dieses Dokument definiert die vollständige Teststrategie, Sicherheitsrichtlinien und das verbindliche Vorgehen (Doing) vor jedem Commit, Push und Release.

---

## 1. Die Testpyramide

Um maximale Stabilität bei minimaler Testlaufzeit zu gewährleisten, gliedert sich die Qualitätssicherung in fünf Ebenen plus drei begleitende Querschnitts-Disziplinen:

```text
               ▲
              / \     Stufe 4: End-to-End & Visual Regression (Playwright)
             /---\
            /     \   Stufe 3: Integration & API-Mocks (Netlify Functions)
           /-------\
          /         \ Stufe 2: Komponenten & DOM-Tests (Vitest + happy-dom)
         /-----------\
        /             \ Stufe 1: Unit-Tests für reine Logik & Mathematik (Vitest)
       /---------------\
      /                 \ Stufe 0: Statische Prüfungen & Hygiene (Biome, astro check, tsc)
     ---------------------
    [Flanken: Security Audit (CVE) | Lighthouse CI (Perf/a11y) | Git Hygiene]
```

---

## 2. Die Ebenen im Detail

### Stufe 0: Statische Prüfungen & Fundament

- **Werkzeuge:** Biome, `@astrojs/check`, TypeScript (`tsc`).
- **Zweck:** Prüft Formatierung, Lint-Regeln und Typen sowie beispielsweise unauflösbare Imports und Schemafehler in Inhaltsdaten. Die Prüfungen ersetzen keine Laufzeittests und erkennen weder beliebige Tippfehler noch fachlich falsche Inhalte. Insbesondere Astro- und TypeScript-Prüfungen benötigen mehr als Sekundenbruchteile.
- **Umfang:** Biome prüft gemäß `biome.json` unterstützte Dateien unter `src/` und berücksichtigt Git-Ignore-Regeln; einzelne Regeln sind für Astro-Dateien deaktiviert. Astro und TypeScript prüfen anhand der Projektkonfiguration. Ein erfolgreicher Lauf garantiert daher nicht, dass jede Datei vollständig geprüft wurde.
- **Befehle:**

```bash
npm run validate
# oder einzeln:
npx @biomejs/biome check .
npx astro check
npx tsc --noEmit
```
- **Wann nutzen:**
  * **Vor jedem Commit:** Als Standard-Prüfung vor dem Einchecken (ideal als Git Pre-Commit Hook), damit fehlerhafter Code gar nicht erst im Repository landet.
  * **Nach Refactorings & Umbenennungen:** Sobald Dateien verschoben, Markdown/MDX-Frontmatter-Felder angepasst oder TypeScript-Interfaces modifiziert wurden.
  * **Nach Dependency-Updates:** Um inkompatible Typdefinitionen oder veraltete Imports unmittelbar aufzudecken.
  * **Als erstes CI-Gate (Empfehlung):** Vor Build und Laufzeittests ausführen, um statisch erkennbare Fehler früh abzufangen. Ein GitHub-Actions-Workflow ist derzeit nicht im Repository hinterlegt.

```bash
npm run fix
# oder einzeln:
npx @biomejs/biome check --write .
```

### Stufe 1: Unit-Tests (Reine Logik & Mathematik)

- **Werkzeuge:** Vitest.
- **Konfiguration:** `vitest.config.ts` erfasst `.test`- und `.spec`-Dateien in TypeScript, JavaScript und MJS unter `tests/`, ausgenommen `tests/e2e/`. Standardumgebung ist `happy-dom`; einzelne Dateien können Node wählen.
- **Testdateien:** `tests/music-notation.test.mjs`, `tests/module-builder.test.mjs`, `tests/learning-progress.test.mjs`.
- **Gegenstand:** Notationsgeometrie, rhythmische Positionierung, Systemumbrüche, SVG-Ausgabe und Notations-Builder-Zuordnungen sowie Tag-/XP-Berechnungen, Modul-/Aufgaben-Validierung und Store-Operationen. Die Lernfortschrittstests prüfen Zustandsübergänge, Freischaltungen, XP-Vergabe und Speicherung/Wiederherstellung. Eine Testabdeckung für Frequenzformeln oder allgemeine Transponierungslogik wird damit nicht zugesichert.
- **Abgrenzung:** `tests/module-builder.test.mjs` enthält zusätzlich Serverless-API-Tests (Stufe 3); `tests/learning-progress.test.mjs` prüft neben Logik auch Browser-Persistenz. Die Dateigrenzen entsprechen somit nicht strikt den Stufen der Testpyramide.
* **Befehle:**
  ```bash
  # alle Vitest-Tests, inklusive Komponenten, Integration und Dokumentation:
  npm test
  # ausschließlich tests/music-notation.test.mjs:
  npm run test:unit
  # alle drei oben genannten Testdateien, inklusive ihrer gemischten Testarten:
  npx vitest run tests/music-notation.test.mjs tests/module-builder.test.mjs tests/learning-progress.test.mjs
  # alle Vitest-Tests im Watch-Modus:
  npm run test:watch
  ```
* **Wann nutzen:**
  * **Während der aktiven Feature-Entwicklung (TDD / Watch-Modus):** Beim Implementieren von Notationslayout, XP-Berechnungen oder Freischaltregeln für schnelles Feedback nach jedem Speichern.
  * **Bei Performance-Optimierungen:** Wenn Rechenoperationen refaktoriert werden und sichergestellt werden muss, dass etwa Notenabstände, Pausenpositionen und XP-Ergebnisse korrekt bleiben. Die Tests messen dabei nicht automatisch die Laufzeit.
  * **Beim Debuggen:** Wenn ein Notationsfehler gemeldet wird; den Fall zunächst als fehlschlagenden Unit-Test isolieren (`red`), dann den Bug beheben (`green`).

### Stufe 2: Komponenten- & DOM-Verhalten

- **Werkzeuge:** Vitest mit `happy-dom` gemäß `vitest.config.ts`. Die vorhandenen Tests verwenden keinen Astro-Container.
- **Testdateien:** `tests/components/checklist-editor.test.ts`, `tests/components/notation-builder.test.ts`, `tests/components/module-builder-ui.test.ts`, `tests/components/module-player-ui.test.ts`.
- **Gegenstand:** Prüft DOM-Controller und ihre Interaktionen mit Logik und Zustand ohne echten Browser: Checklisten-Eingabe, Notations-Builder per Maus und Tastatur, Modul-/Aufgabenformulare mit Gruppierung, Sortierung, Live-XP und API-Fehleranzeige sowie Lernpfad, Lösungsanzeige, Antwort-Wiederherstellung und Dashboard-/Roadmap-Updates.
- **Testaufbau und Grenzen:** Die Tests erzeugen DOM-Strukturen direkt und rufen die TypeScript-Controller auf; sie rendern nicht die tatsächlichen `.astro`-Komponenten. API-Antworten werden bei Bedarf über `fetch`-Mocks simuliert, Geometriewerte für Mausklicks teilweise vorgegeben. Damit werden weder produktive Serverless-Endpunkte noch echtes CSS-Layout, Browser-Rendering oder vollständige Barrierefreiheit geprüft. Dafür sind ergänzende Browser- und Accessibility-Prüfungen erforderlich.
- **Abgrenzung:** Einzelne Tests verbinden mehrere Controller mit Lernfortschrittslogik und Speicherung oder prüfen Schemas und Testdaten. Die Suite enthält damit auch Integrationsanteile statt ausschließlich isolierter Komponententests.
- **Befehl:**
  ```bash
  npm run test:component
  ```

* **Wann nutzen:**
  * **Beim Bau interaktiver UI-Elemente:** Nach Änderungen an Widgets, Formularen, interaktiven Musik-Tools oder Editoren.
  * **Bei Accessibility- & Event-Anpassungen:** Geänderte Tastaturaktionen, Fokus-Steuerung oder ARIA-Attribute gezielt mit passenden Assertions absichern. Bestehende Tests prüfen unter anderem `Enter` im Checklisten-Editor sowie Pfeiltasten, Notenwertauswahl, Leertaste und Löschen im Notations-Builder; sie sind kein vollständiger Accessibility-Audit.
  * **Vor strukturellen UI-Refactorings:** Für schnelles Feedback zu Event-Handlern und Zustandsänderungen. Bei Änderungen am Astro-Markup zusätzlich echte Seiten im Browser prüfen, da manuell erzeugte Test-DOMs von den Komponenten abweichen können.


### Stufe 3: Integration – HTTP- & Serverless-Verhalten

- **Werkzeuge:** Vitest mit direkt aufgerufenen Function-Handlern und erzeugten `Request`-/`Response`-Objekten. Umgebungsvariablen werden für die Tests gesetzt; die Modul-API-Tests simulieren GitHub-Antworten über einen `fetch`-Mock.
- **Testdateien:** `tests/integration/contributions.test.ts`, `tests/module-builder.test.mjs` (`/api/modules`).
- **Gegenstand:**
  * **Beiträge:** Prüft die Ablehnung von `PUT` (405), fehlende GitHub-Konfiguration (503), ungültiges JSON (400) und ungültige Beitragsdaten (400).
  * **Module:** Prüft die Ablehnung von `PATCH` (405), fehlende GitHub-Konfiguration (503), Lesen, Speichern und Löschen von Modulen und Aufgaben sowie einen erneuten Schreibversuch nach simuliertem GitHub-409-Konflikt. Zusätzlich werden Modulreihenfolge, Ablehnung veralteter Verschiebevorgänge und globale Bestehensgrenzen mit Validierung und Revisionskonflikten geprüft.
- **Grenzen:** Es läuft weder ein HTTP-Server noch eine Netlify-Laufzeit. Routing, Deployment, echte GitHub-Zugriffe und abgelaufene Tokens werden damit nicht verifiziert. Die Beitragstests decken derzeit keine erfolgreichen GitHub-Lese-/Schreibvorgänge ab; der getestete GitHub-Konflikt-Retry gehört zur Modul-API. Nicht jeder Fehlerpfad oder jede erlaubte/verbotene Methode wird für beide APIs geprüft.
- **Befehle:**
  ```bash
  # Beitragstests unter tests/integration/:
  npm run test:integration
  # zusätzlich gezielt die Serverless-API-Tests für Module:
  npx vitest run tests/module-builder.test.mjs -t "Modules Serverless API"
  ```

  `test:integration` wählt ausschließlich `tests/integration/` und erfasst die Modul-API-Tests nicht. Über `npm test` laufen beide Testgruppen zusammen mit den übrigen Vitest-Tests.

* **Wann nutzen:**
  * **Nach Änderungen an Netlify Functions:** Wenn Backend-Logik, Middleware oder Serverless-Routen editiert werden.
  * **Bei Schema- oder Payload-Updates:** Wenn sich die Datenstruktur von Frontend-Formularen oder API-Schnittstellen ändert.
  * **Bei Validierungs- und Fehlerbehandlungsprüfungen:** Um fehlende Konfiguration, ungültige Eingaben und Konfliktfälle mit gezielten Tests abzusichern, ohne Netlify oder GitHub anzusprechen. Neue Fehlerpfade benötigen eigene Assertions; die vorhandene Suite ist kein vollständiger Sicherheits-Audit.


### Stufe 4: End-to-End (E2E) & Visuelle Regression

* **Werkzeuge:** `@playwright/test`.
* **Testdateien:** `tests/e2e/smoke.spec.ts`.
* **Testumgebung:** `playwright.config.ts` verwendet Chromium mit dem Geräteprofil „Desktop Chrome“ und WebKit mit dem Profil „iPhone 14“ unter dem Projektnamen „Mobile Safari“. Das ist Browser-/Geräteemulation, kein Test auf einem echten iPhone oder mit installiertem Google Chrome.
* **Server und Voraussetzung:** Die Tests benötigen einen aktuellen Produktionsbuild. Playwright startet dafür `npm run preview` unter `http://localhost:4321`; außerhalb von CI darf ein bereits erreichbarer Server wiederverwendet werden. Für reproduzierbare Produktionsprüfungen dort keinen abweichenden Dev-Server laufen lassen. `test:e2e` baut das Projekt nicht selbst.
* **Gegenstand:** Drei festgelegte Seiten werden auf HTTP 200, eine sichtbare Hauptüberschrift und bis zum Prüfzeitpunkt aufgetretene JavaScript-`pageerror`-Ereignisse geprüft. Weitere Tests prüfen Builder-Klickpfade sowie Notationsgeometrie, rhythmische Abstände, Schlüssel-/Taktartdarstellung, Größenanpassung und horizontales Scrollen an ausgewählten Beispielen. Ein eigener Test prüft den scrollbaren Fallback ohne JavaScript.
* **Visuelle Prüfung und Grenzen:** Die Suite wertet DOM, SVG, berechnete Styles und Geometrie im Browser aus; sie enthält keine Screenshot-Vergleiche. Sie prüft weder alle Seiten noch alle Klickpfade, Konsolenmeldungen, Netzwerkfehler oder Darstellungsvarianten. Erfolgreiches Speichern über die produktive API, AlphaTab-/Audiowiedergabe und vollständige Barrierefreiheit sind damit nicht abgesichert.
* **Builder-Smoke-Tests:** Prüfen Gruppieren/Auflösen, sichtbare Aktionsbuttons mit mindestens 44 px Höhe und überlappungsfreie Gruppenkarten statt exakter CSS-Abstände. Der Bearbeitungstest öffnet ein Modul über den Katalog und kehrt über den echten Zurück-Button zur Übersicht zurück; die API liefert dabei feste Testdaten ohne Schreibzugriffe. Die Cursor-Ausrichtung der Notationsvorschau wird separat geprüft.
* **Befehle:**
  ```bash
  # vor dem Testen einen aktuellen Produktionsbuild erzeugen:
  npm run build
  npm run test:e2e
  # dieselbe Suite mit Snapshot-Aktualisierung (derzeit ohne Snapshot-Assertions):
  npm run test:visual
  # alternativ interaktives UI-Debugging, ebenfalls mit aktuellem Build:
  npm run test:e2e:ui
  ```
* **Fehlerdiagnose:** Playwright speichert Screenshots nur bei Fehlern und Traces beim ersten Wiederholungsversuch. In CI sind bis zu zwei Wiederholungen konfiguriert, lokal standardmäßig keine; ein lokaler Fehler erzeugt deshalb nicht automatisch einen Trace.
* **Wann nutzen:**
  * **`npm run test:e2e` (Smoke-Tests & kritische User-Flows):**
    * Vor jedem Release und Produktiv-Deployment.
    * Vor dem Mergen eines Pull Requests in den Hauptzweig (`main`).
    * Nach Versions-Upgrades von Astro, Starlight, Routing- oder Styling-Anpassungen, um die abgedeckten Seiten, Klickpfade und Layoutregeln zu prüfen. Nicht abgedeckte Bereiche zusätzlich gezielt testen.
  * **`npm run test:visual` (derzeit kein separater visueller Test):**
    * Führt aktuell dieselben Prüfungen wie `test:e2e` aus; `--update-snapshots` hat ohne Snapshot-Assertions keine zusätzliche Wirkung.
    * Falls künftig Screenshot-/Snapshot-Tests hinzukommen, Referenzen nur bei beabsichtigten Änderungen und nach Sichtprüfung aktualisieren. Der Befehl ersetzt keine manuelle Prüfung globaler Styling-, AlphaTab- oder KaTeX-Änderungen.

### Dokumentationscheck

`tests/documentation.test.ts` prüft alle `README*.md` im Projekt-Root und in `features/` sowie `.github/copilot-instructions.md` auf vorhandene lokale Linkziele und Abschnitte sowie dokumentierte `npm run`-Skripte. Codebeispiele werden nicht als Links interpretiert. Der Test läuft in `npm test` und damit auch im Preflight:

```bash
npx vitest run tests/documentation.test.ts
```

Externe Links, fachliche Aktualität, dynamische Asset-Pfade und Git-Hygiene werden damit nicht automatisch verifiziert. Die wiederholbare manuelle Prüfung steht in der [Cleanup-Anleitung](README_CLEANUP.md).

---

## 3. Begleitende Querschnitts-Disziplinen


## 3.1 Sicherheits-Audit (Security Testing)

* **Werkzeuge:** `npm audit`, Git CLI (`git ls-files`, `git grep`).
* **Zweck & Gegenstand:** Scannt alle Drittanbieter-Pakete in `node_modules` nach bekannten Sicherheitslücken (CVEs) ab Schweregrad `high`. Stellt sicher, dass sensible Konfigurationsdateien (`.env`) niemals im Versionskontrollsystem landen, und verhindert die Offenlegung von Server-Geheimnissen über versehentliche `PUBLIC_`-Präfixe.
* **Befehle:**
  ```bash
  # Fremdpakete auf Schweregrad High/Critical scannen
  npm run audit
  # Fix, falls nötig
  npm audit fix
  npm audit fix --force

  # Verifizieren, dass .env nicht im Git-Index getrackt wird - Leere Ausgabe ist gut!
  git ls-files .env

  # Exponierte Geheimnisse mit PUBLIC_-Präfix im Quellcode aufspüren - Leere Ausgabe ist gut!
  git grep -i "PUBLIC_.*\(KEY\|SECRET\|TOKEN\|PASSWORD\)"
  ```
* **Wann nutzen:**
  * **Nach Paketoperationen:** Direkt nach jeder Installation (`npm install <paket>`) oder Aktualisierung von Abhängigkeiten (`npm update`).
  * **Vor jedem Production-Release:** Als unverzichtbarer Bestandteil des `preflight`-Laufs vor Build und Deployment.
  * **Bei Backend- & Serverless-Änderungen:** Sobald neue Netlify Functions, Umgebungsvariablen oder externe Schnittstellen eingerichtet werden.

---

## 3.2 Performance- & Web-Vitals-Audit

* **Werkzeuge:** Google Lighthouse CI (`@lhci/cli`).
* **Zweck & Zielmarken:** Überprüft den Produktions-Build. Die folgenden Werte sind Release-Ziele, nicht alle automatisch erzwungene Grenzwerte:
  * First Contentful Paint: $\text{FCP} < 1.2\text{ s}$
  * Cumulative Layout Shift: $\text{CLS} < 0.05$
  * Mindestens $90$ Punkte in allen vier Kategorien: *Performance*, *Accessibility*, *Best Practices* und *SEO*.
* **Befehle:**
  ```bash
  # Produktions-Build erzeugen und automatisierte Lighthouse-Messung starten
  npm run build && npm run audit:lhci
  ```
  `lighthouserc.cjs` erzwingt derzeit Accessibility ≥ 0,9; Performance ≥ 0,8 sowie Best Practices und SEO ≥ 0,9 erzeugen bei Unterschreitung Warnungen. FCP und CLS sind dort nicht separat konfiguriert. Berichte werden temporär öffentlich hochgeladen.
* **Wann nutzen:**
  * **Nach Import schwerer Bibliotheken:** Wenn Noten-Renderer (`@coderline/alphatab`), Formel-Renderer (`katex`) oder Bildoptimierungs-Pipelines (`sharp`) eingebunden oder aktualisiert werden.
  * **Nach Asset- & Schriftartänderungen:** Sobald Webfonts, globale Stylesheets oder umfangreiche SVG-Grafiken angepasst wurden.
  * **Vor Major-Releases:** Als automatisiertes Gate in der CI/CD-Pipeline vor dem Merge in den Produktivzweig.

---

## 3.3 Barrierefreiheit (a11y)

* **Werkzeuge:** Biome (`a11y`-Linter-Regelwerk), Google Lighthouse CI (`@lhci/cli`), Playwright E2E-Tests.
* **Zweck & Gegenstand:** Gewährleistet Barrierefreiheit auf statischer Code-Ebene sowie dynamisch im gerenderten DOM:
  * Alle informativen Grafiken und Noten-SVGs besitzen ein aussagekräftiges `aria-label` oder ein `alt`-Attribut.
  * Interaktive Touch-Elemente auf Mobilgeräten erfüllen die Mindestgröße von $44 \times 44\text{ px}$.
  * Text- und Hintergrundfarben erfüllen mindestens den Kontraststandard WCAG AA.
* **Befehle:**
  ```bash
  # Statische Prüfung auf ARIA-Attribute und Alt-Texte im Quellcode
  npx @biomejs/biome lint --only=a11y .

  # Dynamische Verifizierung im Browser-DOM via Playwright
  npm run test:e2e

  # Ganzheitliche Prüfung im Lighthouse-Lauf
  npm run build && npm run audit:lhci

  # Analyse der Ergebnisse
  npx serve .lighthouseci
  ```
* **Wann nutzen:**
  * **Beim Erstellen interaktiver UI-Elemente:** Wenn Steuerelemente, Navigationsmenüs, Modals oder Noten-Widgets entwickelt werden.
  * **Nach Anpassung von Farbschemata:** Wenn Tailwind-Themes, Hintergründe oder Textfarben modifiziert werden (Vermeidung von Kontrastproblemen).
  * **Vor dem Commit von Template-Änderungen:** Um fehlende Alternativtexte oder fehlerhafte ARIA-Rollen bereits lokal beim Coden abzufangen.

## 4. Das verbindliche „Doing“ im Entwicklungsprozess

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. Vor dem Git-Commit:             Lokale Hygiene & Formatierung            │
│ 2. Vor dem Git-Push / Pull Request: Zentrales Pre-Flight Quality Gate       │
│ 3. Vor dem Produktions-Release:    5-Phasen Release-Audit & DoD             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.1 Vor jedem lokalen Commit

Führe vor dem Stagen folgende Schritte aus:

```bash
npm run format          # Formatiert Code automatisch
npm run lint            # Prüft Linter-Regeln
npm run check           # Validiert Astro-Templates
npm test                # Führt die Vitest-Suite aus
git diff --check        # Verhindert Whitespace-Fehler
```

### 4.2 Vor jedem Git-Push oder Pull Request

Vor jedem Push auf GitHub muss das einzeilige Pre-Flight Quality Gate fehlerfrei durchlaufen:

```bash
npm run preflight
```

_Befehlskette im Detail:_ `npm run validate && npm run audit && npm run test:all && git diff --check`. `validate` führt Biome, Astro-Check und TypeScript aus; `test:all` führt Vitest, Build und Playwright aus. Danach misst `audit:lhci` den Build mit Lighthouse CI und lädt den Bericht in den konfigurierten temporären öffentlichen Speicher hoch. `test:visual` aktualisiert Snapshots und `test:e2e:ui` startet den interaktiven Playwright-Modus; beide sind deshalb keine Preflight-Gates.
Bricht beim kleinsten Fehler mit Exit-Code 1 ab.

---

## 5. Der 5-Phasen-Release-Audit (Vor dem Release)

Vor einem Release auf `main` wird diese Checkliste vollständig abgearbeitet:

### Phase 1: Automatisierte Code-Hygiene & Build

- [ ] Linter meldet 0 Fehler (`npm run lint`).
- [ ] Astro-Check validiert alle Templates fehlerfrei (`npm run check`).
- [ ] TypeScript meldet 0 Typfehler im Strict-Modus (`npx tsc --noEmit`).
- [ ] Sicherheits-Audit ist sauber (`npm run audit`).
- [ ] Alle Unit-, Komponenten- und Integrationstests sind grün (`npm test`).
- [ ] Produktions-Build wird fehlerfrei generiert (`npm run build`).
- [ ] Keine verbliebenen `console.log(...)`-Aufrufe im Client-Code.

### Phase 2: Inhalt & Didaktik-Prüfung

- [ ] Volltextsuche nach Platzhaltern (`Lorem`, `TODO`, `Test`, `Mock`, `asdf`) durchgeführt und bereinigt.
- [ ] Keine toten Klick-Buttons mit Dummy-Verweisen (`href="#"`).
- [ ] Alle internen und externen Links leiten korrekt weiter.
- [ ] Zustandsspeicherung (z. B. `localStorage`) bleibt nach Browser-Reload erhalten.

### Phase 3: Mobiles & Cross-Browser-Testing

- [ ] Auf physischem Smartphone getestet: Keine horizontalen Scrollbalken.
- [ ] Alle klickbaren Elemente haben eine Mindestgröße von $44 \times 44\ \text{px}$.
- [ ] Getestet in Chromium, Safari (WebKit) und Firefox.
- [ ] Dark- und Light-Mode auf Kontraste und Lesbarkeit geprüft.

### Phase 4: Performance, SEO & Barrierefreiheit

- [ ] Alle Bilder laufen über Astros `<Image />`-Komponente (WebP/AVIF).
- [ ] Keine unkomprimierten Multi-Megabyte-Dateien im Ordner `public/`.
- [ ] Eigenes Favicon-Set (`favicon.svg`, `apple-touch-icon.png`) hinterlegt.
- [ ] Jede Seite besitzt einen eindeutigen `<title>` und `<meta name="description">`.
- [ ] Google Lighthouse Audit erzielt mindestens 90+ Punkte in allen Bereichen.

### Phase 5: Rechtliches & Serverless-Infrastruktur

- [ ] Impressum und DSGVO-Datenschutzerklärung sind live erreichbar.
- [ ] Eigene 404-Fehlerseite (`src/pages/404.astro`) leitet zur Startseite zurück.
- [ ] SSL/HTTPS ist aktiv; HTTP leitet sauber auf HTTPS um.
- [ ] Alle Produktions-Umgebungsvariablen sind im Hosting-Dashboard hinterlegt.

---

## 6. Definition of Done (DoD)

Ein Release gilt erst dann als **vollständig fertiggestellt und freigegeben**, wenn:

1. Das Pre-Flight-Kommando `npm run preflight` mit **Exit-Code 0** durchläuft.
2. Ein vollständiger manueller Testlauf auf einem mobilen Touch-Endgerät erfolgreich protokolliert wurde.
3. Impressum, Datenschutzerklärung und 404-Seite funktionstüchtig live geschaltet sind.
4. Alle E2E-Browsertests bestehen und relevante visuelle Änderungen geprüft sind; vorhandene Snapshots bestehen ohne unbeabsichtigte Abweichung.
