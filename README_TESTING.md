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
        /             \ Stufe 1: Unit-Tests für reine Logik & Mathematik (Node / Vitest)
       /---------------\
      /                 \ Stufe 0: Statische Prüfungen & Hygiene (Biome, astro check, tsc)
     ---------------------
    [Flanken: Security Audit (CVE) | Lighthouse CI (Perf/a11y) | Git Hygiene]
```

---

## 2. Die Ebenen im Detail

### Stufe 0: Statische Prüfungen & Fundament

- **Werkzeuge:** Biome, `@astrojs/check`, TypeScript (`tsc`).
- **Zweck:** Erkennt Syntaxfehler, veraltete Imports, Typos im Frontmatter und Typverletzungen in Sekundenbruchteilen ohne Code auszuführen.
- **Befehle:**

```bash
npm run validate
# oder separat als execute:
npx @biomejs/biome check .
npx astro check
npx tsc --noEmit
```
- **Wann nutzen:**
  * **Vor jedem Commit:** Als Standard-Prüfung vor dem Einchecken (ideal als Git Pre-Commit Hook), damit fehlerhafter Code gar nicht erst im Repository landet.
  * **Nach Refactorings & Umbenennungen:** Sobald Dateien verschoben, Markdown/MDX-Frontmatter-Felder angepasst oder TypeScript-Interfaces modifiziert wurden.
  * **Nach Dependency-Updates:** Um inkompatible Typdefinitionen oder veraltete Imports unmittelbar aufzudecken.
  * **Als erstes CI-Gate:** Der schnellste Filter in GitHub Actions, der fehlerhafte Builds nach wenigen Sekunden abbricht, bevor zeit- und ressourcenintensive Jobs starten.

```bash
npm run fix
# oder separat als execute:
npx @biomejs/biome check --write .
```

### Stufe 1: Unit-Tests (Reine Logik & Mathematik)

- **Werkzeuge:** Nativer Node.js Test-Runner oder Vitest.
- **Testdateien:** `tests/music-notation.test.mjs`, `tests/unit/*.test.ts`.
- **Gegenstand:** Mathematische Berechnungen der Notationsgeometrie, Takteinteilung, Notenwert-Splitting, Frequenzformeln und Transponierungslogik.
* **Befehle:**
  ```bash
  npm test
  # gezielt für Notationsmathematik:
  npm run test:unit
  # während des Schreibens:
  npm run test:watch
  ```
* **Wann nutzen:**
  * **Während der aktiven Feature-Entwicklung (TDD / Watch-Modus):** Beim Implementieren mathematischer Algorithmen (z. B. Tab-Positionen, Tonleiter-Berechnungen, Frequenz-Transformationen) für sofortiges Feedback nach jedem Speichern.
  * **Bei Performance-Optimierungen:** Wenn Rechenoperationen refaktoriert werden und sichergestellt werden muss, dass Randfälle (Taktüberläufe, Pausenwerte) mathematisch exakt bleiben.
  * **Beim Debuggen:** Wenn ein Notationsfehler gemeldet wird; den Fall zunächst als fehlschlagenden Unit-Test isolieren (`red`), dann den Bug beheben (`green`).

### Stufe 2: Komponenten- & DOM-Verhalten

- **Werkzeuge:** Vitest mit `happy-dom` oder `astro/container`.
- **Testdateien:** `tests/components/checklist-editor.test.ts`.
- **Gegenstand:** Prüft isolierte DOM-Interaktionen (z. B. Hinzufügen von Checklisten-Items per Enter-Taste, Maximalgrenzen von 100 Einträgen, Lösch-Operationen und ARIA-Attribute) ohne echten Browser.
- **Befehl:**
  ```bash
  npm run test:component
  ```

* **Wann nutzen:**
  * **Beim Bau interaktiver UI-Elemente:** Nach Änderungen an Widgets, Formularen, interaktiven Musik-Tools oder Editoren.
  * **Bei Accessibility- & Event-Anpassungen:** Wenn Keyboard-Navigation (z. B. `Enter`/`Escape`), Fokus-Steuerung oder ARIA-Attribute verändert werden.
  * **Vor strukturellen UI-Refactorings:** Deutlich schneller als End-to-End-Tests, um sicherzustellen, dass Event-Handler und lokaler Zustand nach DOM-Anpassungen intakt bleiben.


### Stufe 3: Integration – HTTP- & Serverless-Verhalten

- **Werkzeuge:** Vitest mit Request-/Response-Mocks.
- **Testdateien:** `tests/integration/contributions.test.ts`.
- **Gegenstand:** Testet die Serverless Function `netlify/functions/contributions.ts`. Prüft das Abweisen falscher HTTP-Methoden (z. B. `PUT` $\rightarrow$ 405), Validierungsfehler bei ungültigem JSON (400) und das Verhalten bei fehlenden Umgebungsvariablen (503).
- **Befehl:**
  ```bash
  npm run test:integration
  ```

* **Wann nutzen:**
  * **Nach Änderungen an Netlify Functions:** Wenn Backend-Logik, Middleware oder Serverless-Routen editiert werden.
  * **Bei Schema- oder Payload-Updates:** Wenn sich die Datenstruktur von Frontend-Formularen oder API-Schnittstellen ändert.
  * **Bei Sicherheits- und Fehlerbehandlungsprüfungen:** Um Ausfälle wie abgelaufene Tokens, fehlende Environment-Variablen oder unzulässige HTTP-Verben abzufangen, ohne eine Netlify-Infrastruktur starten zu müssen.


### Stufe 4: End-to-End (E2E) & Visuelle Regression

* **Werkzeuge:** `@playwright/test`.
* **Testdateien:** `tests/e2e/smoke.spec.ts`.
* **Gegenstand:** Startet den Astro-Produktionsserver und prüft Navigation, HTTP-Status 200, fehlerfreie Klickpfade und responsive Darstellung in Desktop Chrome und Mobile Safari.
* **Visuelle Regression:** Vergleicht gerenderte SVG-Notensysteme pixelgenau mit Referenzbildern (`toHaveScreenshot`).
* **Befehle:**
  ```bash
  npm run test:e2e
  # bei beabsichtigten Design-Änderungen:
  npm run test:visual
  # interaktives UI-Debugging:
  npm run test:e2e:ui
  ```
* **Wann nutzen:**
  * **`npm run test:e2e` (Smoke-Tests & kritische User-Flows):**
    * Vor jedem Release und Produktiv-Deployment.
    * Vor dem Mergen eines Pull Requests in den Hauptzweig (`main`).
    * Nach Versions-Upgrades von Astro, Starlight oder Routing-Anpassungen, um sicherzustellen, dass alle Seiten mit HTTP 200 antworten und Kernfunktionen bedienbar sind.
  * **`npm run test:visual` (Pixelgenaue Regression):**
    * Nach globalen Styling-Updates (z. B. Tailwind-Konfiguration, Typografie, Farbschemata).
    * Nach Updates der SVG-Renderings (alphaTab, Notengrafiken) oder KaTeX-Formeln, um unerwünschte Layout-Verschiebungen ("Pixel-Drift") sofort zu erkennen.
    * Zur bewussten Aktualisierung der Snapshot-Referenzen (`--update-snapshots`), wenn sich das Design absichtlich geändert hat.

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
* **Zweck & Zielmarken:** Überprüft das kompilierte Produktions-Bundle gegen die Core Web Vitals und etablierte Best Practices:
  * First Contentful Paint: $\text{FCP} < 1.2\text{ s}$
  * Cumulative Layout Shift: $\text{CLS} < 0.05$
  * Mindestens $90$ Punkte in allen vier Kategorien: *Performance*, *Accessibility*, *Best Practices* und *SEO*.
* **Befehle:**
  ```bash
  # Produktions-Build erzeugen und automatisierte Lighthouse-Messung starten
  npm run build && npx lhci autorun
  ```
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
  npx lhci autorun

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
npm test                # Führt Unit-Tests aus
git diff --check        # Verhindert Whitespace-Fehler
```

### 4.2 Vor jedem Git-Push oder Pull Request

Vor jedem Push auf GitHub muss das einzeilige Pre-Flight Quality Gate fehlerfrei durchlaufen:

```bash
npm run preflight
```

_Befehlskette im Detail:_ `npm run lint && npm run check && npx tsc --noEmit && npm run audit && npm test && npm run build && git diff --check`.
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
4. Alle E2E-Browsertests und visuellen Snapshots ohne Abweichung bestehen.
