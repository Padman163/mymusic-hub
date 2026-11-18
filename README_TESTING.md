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
npm run fix
# oder einzeln:
npx @biomejs/biome check --write .
```

```bash
npm run validate
# oder einzeln:
npx @biomejs/biome check .
npx astro check
npx tsc --noEmit
```
- **Wann nutzen:**
  * Ausschließlich im manuellen Preflight am Branch-Ende. Die Einzelbefehle erklären den Prüfumfang und sind keine Routinechecks.


### Stufe 1: Unit-Tests (Reine Logik & Mathematik)

- **Werkzeuge:** Vitest.
- **Konfiguration:** `vitest.config.ts` erfasst `.test`- und `.spec`-Dateien in TypeScript, JavaScript und MJS unter `tests/`, ausgenommen `tests/e2e/`. Standardumgebung ist `happy-dom`; einzelne Dateien können Node wählen.
- **Admin-Wiki:** `tests/admin-wiki.test.ts` nutzt Node für den serverseitigen Markdown-Renderer samt Shiki und nativen Web-APIs. Nur zur Prüfung des erzeugten HTML wird ein isoliertes Happy-DOM-Fenster angelegt; dessen unvollständige `Response`-Implementierung ersetzt dadurch nicht die Node-API.
- **Testdateien:** `tests/music-notation.test.mjs`, `tests/module-builder.test.mjs`, `tests/learning-progress.test.mjs`.
- **Gegenstand:** Notationsgeometrie, rhythmische Positionierung, Systemumbrüche, SVG-Ausgabe und Notations-Builder-Zuordnungen sowie Tag-/XP-Berechnungen, Modul-/Aufgaben-Validierung und Store-Operationen. Die Lernfortschrittstests prüfen Zustandsübergänge, Freischaltungen, XP-Vergabe und Speicherung/Wiederherstellung. Eine Testabdeckung für Frequenzformeln oder allgemeine Transponierungslogik wird damit nicht zugesichert.
- **Abgrenzung:** `tests/module-builder.test.mjs` enthält zusätzlich Serverless-API-Tests (Stufe 3); `tests/learning-progress.test.mjs` prüft neben Logik auch Browser-Persistenz. Die Dateigrenzen entsprechen somit nicht strikt den Stufen der Testpyramide.
- **Drum-Audio:** `tests/drum-audio.test.ts` kombiniert Engine- und DOM-Tests mit gemocktem `fetch` und `AudioContext`: Cache/Preloading, unmittelbarer Cache-Start, Polyphonie, Velocity, Lade-/Audiofehler, SSR, Klicks und Tastatur sowie unveränderte Patterns ohne Sounds. Fake-Timer prüfen Viertel-BPM, Auflösung, synchrone Spuren, Pausen, Loop-Neustart und Stoppen per Leertaste/Fokus-/Seitenwechsel. Play/Stop-Tests sichern die Header-Position, unabhängig ausblendbare Buttons und Footer, Haltewiedergabe ohne Button, fortlaufende Button-Wiedergabe, barrierefrei benannte Symbole, Neustart und Abbruch während der Audiofreigabe. Auswahltests prüfen Highlight-Filter, Shift-/Touch-Mehrfachauswahl, keine Markierung als „alle“ sowie die unabhängige Anschlagspur. Ausblendbare Tempo-/Hilfselemente werden einzeln und gemeinsam geprüft; BPM-Prop und Fehlermeldungen bleiben dabei wirksam. Audio-Abbrüche verhindern auch nachträgliche Starts während des Ladens oder Entsperrens. Die Tests messen keine reale Audiolatenz und ersetzen keine Browserprüfung der Audiofreigabe.
* **Befehle:**
  ```bash
  # alle Vitest-Tests, inklusive Komponenten, Integration und Dokumentation:
  npm test
  # alle drei oben genannten Testdateien, inklusive ihrer gemischten Testarten:
  npx vitest run tests/music-notation.test.mjs 
  npx vitest run tests/module-builder.test.mjs 
  npx vitest run tests/learning-progress.test.mjs

  ```
* **Wann nutzen:**
  * **Nach Zustimmung oder ausdrücklichem Testauftrag:** Copilot fragt nach jeweils zehn Nutzer-Prompts, ob Stufen 1 und 2 ausgeführt werden sollen. Keine automatischen Tests nach einzelnen Änderungen. Wenn kein passenderer Unit-Test vorliegt, `npm run test:unit` als Kurzcheck verwenden.
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

* **Wann nutzen:** Gemeinsam mit Stufe 1 nach Zustimmung zur Rückfrage nach jeweils zehn Nutzer-Prompts oder auf ausdrücklichen Testauftrag. Auch größere Komponentenänderungen lösen keine automatischen Tests aus. Passende Tests anhand der folgenden Fälle wählen:
  * **Beim Bau interaktiver UI-Elemente:** Passende Tests für Widgets, Formulare, interaktive Musik-Tools oder Editoren auswählen.
  * **Bei Accessibility- & Event-Anpassungen:** Geänderte Tastaturaktionen, Fokus-Steuerung oder ARIA-Attribute gezielt mit passenden Assertions absichern. Bestehende Tests prüfen unter anderem `Enter` im Checklisten-Editor sowie Pfeiltasten, Notenwertauswahl, Leertaste und Löschen im Notations-Builder; sie sind kein vollständiger Accessibility-Audit.
  * **Vor strukturellen UI-Refactorings:** Für schnelles Feedback zu Event-Handlern und Zustandsänderungen. Bei Änderungen am Astro-Markup zusätzlich echte Seiten im Browser prüfen, da manuell erzeugte Test-DOMs von den Komponenten abweichen können.


### Stufe 3: Integration – HTTP- & Serverless-Verhalten

- **Werkzeuge:** Vitest mit direkt aufgerufenen Function-Handlern und `Request`-/`Response`-Objekten. Ein Mock für `@netlify/blobs` simuliert JSON-Lesezugriffe und bedingte Schreibzugriffe mit ETags.
- **Testdateien:** `tests/integration/contributions.test.ts`, `tests/module-builder.test.mjs` (`/api/modules`).
- **Gegenstand:**
  * **Beiträge:** Prüft HTTP-Methoden, fehlenden Blob-Kontext (503), ungültige Eingaben, Defaults und Mutationen einschließlich Versionskonflikt und Löschung.
  * **Module:** Prüft HTTP-Methoden, fehlenden Blob-Kontext, Lesen und Ändern des Katalogs, einen erneuten Schreibversuch nach simuliertem ETag-Konflikt sowie Modulreihenfolge und Quiz-Grenzen mit Revisionsprüfung.
  * **Blob-Adapter (Unit):** `tests/blob-store.test.ts` prüft die leere Initialisierung fehlender Keys, den Erhalt gespeicherter Daten, ungültige Blob-Daten und konkurrierende Zugriffe.
- **Grenzen:** Routing, Netlify CLI und Cloud-Deploys laufen nicht im Vitest-Mock. Hinweise zur lokalen und isolierten Online-Umgebung stehen in der [Blob-Referenz](features/README_FEAT_NETLIFYBLOB.md). Dokumentationslinks und Skriptnamen prüft separat `tests/documentation.test.ts`.
- **Befehle:**
  ```bash
  # Beitragstests unter tests/integration/:
  npm run test:integration
  ```

  `test:integration` wählt ausschließlich `tests/integration/` und erfasst die Modul-API-Tests nicht. Über `npm test` laufen beide Testgruppen zusammen mit den übrigen Vitest-Tests.

* **Wann nutzen:** Ausschließlich im manuellen Preflight am Branch-Ende.
  * **Bei Änderungen an Backend-Logik, Middleware oder Serverless-Routen:** Die zugehörigen Prüfungen decken diese Änderungen im Abschlusslauf ab.
  * **Bei Schema- oder Payload-Updates im Abschlusslauf:** Wenn sich die Datenstruktur von Frontend-Formularen oder API-Schnittstellen geändert hat.
  * **Bei Validierungs- und Fehlerbehandlungsprüfungen:** Fehlenden Blob-Kontext, ungültige Eingaben und Konfliktfälle ohne Zugriff auf Netlify absichern. Neue Fehlerpfade benötigen eigene Assertions; die vorhandene Suite ist kein vollständiger Sicherheits-Audit.


### Stufe 4: End-to-End (E2E) & Visuelle Regression

* **Werkzeuge:** `@playwright/test`.
* **Testdateien:** `tests/e2e/smoke.spec.ts`.
* **Testumgebung:** `playwright.config.ts` verwendet Chromium mit dem Geräteprofil „Desktop Chrome“ und WebKit mit dem Profil „iPhone 14“ unter dem Projektnamen „Mobile Safari“. Das ist Browser-/Geräteemulation, kein Test auf einem echten iPhone oder mit installiertem Google Chrome.
* **Server und Voraussetzung:** Die Tests benötigen einen aktuellen Produktionsbuild. Playwright startet dafür `npm run preview` unter `http://localhost:4321`; außerhalb von CI darf ein bereits erreichbarer Server wiederverwendet werden. Für reproduzierbare Produktionsprüfungen dort keinen abweichenden Dev-Server laufen lassen. `test:e2e` baut das Projekt nicht selbst.
* **Gegenstand:** Drei festgelegte Seiten werden auf HTTP 200, eine sichtbare Hauptüberschrift und bis zum Prüfzeitpunkt aufgetretene JavaScript-`pageerror`-Ereignisse geprüft. Weitere Tests prüfen Builder-Klickpfade sowie Notationsgeometrie, rhythmische Abstände, Schlüssel-/Taktartdarstellung, Größenanpassung und horizontales Scrollen an ausgewählten Beispielen. Ein eigener Test prüft den scrollbaren Fallback ohne JavaScript.
* **Navigation:** Der Navigationstest prüft Reihenfolge und Zuordnung von Admin, Bediener und Sonstiges innerhalb der Hauptnavigation, unabhängig von Starlights Sidebar-Zwischenelementen. Auf Mobilgeräten wird auch die zunächst eingeklappte Navigation geprüft. Ein weiterer Test öffnet Entwickler-READMEs im Admin-Wiki und folgt ihren Querverweisen.
* **Visuelle Prüfung und Grenzen:** Die Suite wertet DOM, SVG, berechnete Styles und Geometrie im Browser aus; sie enthält keine Screenshot-Vergleiche. Sie prüft weder alle Seiten noch alle Klickpfade, Konsolenmeldungen, Netzwerkfehler oder Darstellungsvarianten. Erfolgreiches Speichern über die produktive API, AlphaTab-/Audiowiedergabe und vollständige Barrierefreiheit sind damit nicht abgesichert.
* **Builder-Smoke-Tests:** Prüfen Gruppieren/Auflösen, sichtbare Aktionsbuttons mit mindestens 44 px Höhe und überlappungsfreie Gruppenkarten statt exakter CSS-Abstände. Der Bearbeitungstest öffnet ein Modul über den Katalog und kehrt über den echten Zurück-Button zur Übersicht zurück; die API liefert dabei feste Testdaten ohne Schreibzugriffe. Die Cursor-Ausrichtung der Notationsvorschau wird separat mit gleichzeitig gemessenen Noten- und Cursorpositionen und weniger als einem Pixel Abweichung je Achse geprüft.
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
* **Wann nutzen:** Die E2E-Suite läuft ausschließlich im manuellen Preflight am Branch-Ende.
  * **`npm run test:e2e` (Smoke-Tests & kritische User-Flows):**
    * Vor jedem Release und Produktiv-Deployment.
    * Vor dem Mergen eines Pull Requests in den Hauptzweig (`main`).
    * Beim Branch-Abschluss nach Versions-Upgrades von Astro, Starlight, Routing- oder Styling-Anpassungen, um die abgedeckten Seiten, Klickpfade und Layoutregeln zu prüfen. Nicht abgedeckte Bereiche zusätzlich gezielt testen.
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
* **Zweck & Gegenstand:** `npm audit` gleicht den Abhängigkeitsbaum mit bekannten Advisories der konfigurierten Registry ab, einschließlich transitiver und Entwicklungsabhängigkeiten. `--audit-level=high` setzt die Fehlerschwelle auf `high`/`critical`, blendet niedrigere Schweregrade aber nicht aus. Ein erfolgreicher Lauf bedeutet daher nicht, dass keine bekannten Schwachstellen vorliegen.
* **Transitive Korrekturen:** Die gezielten Overrides in `package.json` aktualisieren `glob` und `minimatch` in der Netlify-Buildkette. Prüfe bei Updates der betroffenen Elternpakete, ob deren eigene Abhängigkeiten die Korrekturen inzwischen enthalten. Für [GHSA-fc5q-39xc-vjpf (`picomatch`)](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) gibt es derzeit keine veröffentlichte korrigierte Version; bis dahin meldet das Audit den Befund weiterhin als Fehler. Die Fehlerschwelle bleibt unverändert.
* **Grenzen und Geheimnisschutz:** Das Paket-Audit prüft weder eigene Anwendungslogik noch Geheimnisse, Git-Historie oder die tatsächliche Ausnutzbarkeit jedes Befunds. Die folgenden Git-Befehle sind ergänzende Suchhilfen, keine vollständigen Secret-Scans. `.gitignore` ignoriert `.env` und `.env.*` mit Ausnahme von `.env.example`; bereits getrackte Dateien werden durch Ignore-Regeln nicht entfernt. Auch Vorlagen dürfen keine echten Zugangsdaten enthalten. `PUBLIC_`-Werte können im Client landen und dürfen keine Geheimnisse enthalten.
* **Befehle:**
  ```bash
  # Bekannte Paket-Advisories prüfen; Fehlerstatus ab High/Critical
  npm run audit

  # Getrackte .env-Dateien und Varianten auflisten, ohne Inhalte auszugeben
  git ls-files -- '.env' '.env.*' '**/.env' '**/.env.*'

  # Nur Dateinamen mit verdächtigen PUBLIC_-Bezeichnern ausgeben
  git grep -il -E 'PUBLIC_.*(KEY|SECRET|TOKEN|PASSWORD)' -- src netlify
  ```
  Leere Git-Ausgaben sind kein Beweis für Geheimnisfreiheit; beispielsweise können `.env.example`-Vorlagen harmlose Treffer liefern und andere Geheimnisnamen unentdeckt bleiben. `git grep` liefert bei fehlenden Treffern Exit-Code 1. Befunde einzeln bewerten; Paketkorrekturen nur nach Prüfung des Diffs und mit erneuten Tests anwenden. `npm audit fix` kann Abhängigkeiten ändern, `--force` zusätzlich inkompatible Versionswechsel erlauben und ist kein routinemäßiger Prüfschritt.
* **Wann nutzen:**
  * **Nach Paketoperationen:** Direkt nach jeder Installation (`npm install <paket>`) oder Aktualisierung von Abhängigkeiten (`npm update`).
  * **Beim Branch-Abschluss und vor einem Production-Release:** Separat mit `npm run audit`; das Dependency-Audit ist bewusst nicht Teil des `preflight`-Laufs.
  * **Bei Backend- & Serverless-Änderungen:** Sobald neue Netlify Functions, Umgebungsvariablen oder externe Schnittstellen eingerichtet werden.

---

## 3.2 Performance- & Web-Vitals-Audit

* **Werkzeuge:** Google Lighthouse CI (`@lhci/cli`).
* **Zweck & Zielmarken:** Misst ausgewählte Seiten des statischen Produktionsbuilds mit Lighthouse in Chromium. `staticDistDir: './dist'` lässt LHCI einen lokalen Server starten; pro ausgewählter URL ist ein Messlauf konfiguriert. Ohne explizite URL-Liste erfolgt die Auswahl automatisch und deckt nicht sämtliche Seiten ab. Die folgenden Werte sind Release-Ziele, nicht alle automatisch erzwungene Grenzwerte:
  * First Contentful Paint: $\text{FCP} < 1.2\text{ s}$
  * Cumulative Layout Shift: $\text{CLS} < 0.05$
  * Mindestens $90$ Punkte in allen vier Kategorien: *Performance*, *Accessibility*, *Best Practices* und *SEO*.
* **Befehle:**
  ```bash
  # Produktions-Build erzeugen
  npm run build
  # Lighthouse messen und Berichte nur lokal speichern (Linux/Codespace)
  LHCI_UPLOAD__TARGET=filesystem LHCI_UPLOAD__OUTPUT_DIR=./.lighthouseci/reports npm run audit:lhci
  ```
  `lighthouserc.cjs` erzwingt derzeit Accessibility ≥ 0,9; Performance ≥ 0,8 sowie Best Practices und SEO ≥ 0,9 erzeugen bei Unterschreitung nur Warnungen. FCP und CLS sind dort nicht separat als Grenzwerte konfiguriert. Ohne die obigen Umgebungsvariablen laden `audit:lhci` und damit auch `preflight` Berichte gemäß Konfiguration in einen temporären öffentlichen Speicher hoch. Vor einem Upload prüfen, ob URLs, Seiteninhalte und Diagnosedaten veröffentlicht werden dürfen.
* **Aussagekraft und Berichte:** HTML-Berichte im Browser öffnen, im Codespace gegebenenfalls zuvor herunterladen; JSON-Dateien enthalten die Rohdaten. Lokale Berichte sind generiert und können bei späteren Läufen ersetzt werden. Einzelmessungen schwanken mit Rechnerlast und Messumgebung und sind keine Felddaten echter Nutzer. FCP ist keine Core-Web-Vitals-Kennzahl; für eine vollständige Web-Vitals-Bewertung sind insbesondere LCP, INP und CLS relevant. Der automatisierte Seitenlade-Lauf ersetzt keine INP-Messung realer Interaktionen und prüft keine produktive Netlify-Infrastruktur.
* **Wann nutzen:**
  * **Nach Bibliotheks- und Build-Änderungen:** Wenn etwa AlphaTab, KaTeX oder die Bildoptimierung mit `sharp` aktualisiert werden. Betroffene Seiten gezielt in die Messung aufnehmen; serverseitige Bibliotheken erhöhen nicht automatisch das Client-Bundle.
  * **Nach Asset- & Schriftartänderungen:** Sobald Webfonts, globale Stylesheets oder umfangreiche SVG-Grafiken angepasst wurden.
  * **Beim Branch-Abschluss und vor Releases:** Separat oder als Teil des lokalen `preflight`-Gates. Eine Einbindung in CI/CD ist eine Empfehlung; ein entsprechender GitHub-Actions-Workflow ist derzeit nicht hinterlegt.

---

## 3.3 Barrierefreiheit (a11y)

* **Werkzeuge:** Biome (`a11y`-Linter-Regelwerk), Google Lighthouse CI (`@lhci/cli`), Playwright E2E-Tests.
* **Zweck & Grenzen:** Unterstützt das Auffinden ausgewählter Barrierefreiheitsprobleme, gewährleistet aber weder vollständige Barrierefreiheit noch WCAG-Konformität. Biome prüft statische Muster im konfigurierten Umfang unter `src/`; Lighthouse untersucht automatisierbare Kriterien auf ausgewählten gerenderten Seiten. Die Playwright-Suite enthält keine umfassende Accessibility-Prüfung: Sie prüft unter anderem die Höhe zweier Builder-Aktionsbuttons (≥ 44 px), nicht sämtliche Touch-Ziele oder deren Breite. Auch ein Lighthouse-Accessibility-Score von 100 ist kein Konformitätsnachweis.
* **Fachliche Prüfziele (zusätzlich manuell prüfen):**
  * Informative Bilder benötigen passende Textalternativen; informative SVGs eine geeignete zugängliche Benennung und Semantik. Dekorative Grafiken sollen nicht unnötig vorgelesen werden. Ein `aria-label` allein macht komplexe Notation noch nicht verständlich zugänglich.
  * $44 \times 44\text{ CSS-px}$ ist das Projektziel für Touch-Ziele und entspricht der [erweiterten Zielgröße aus WCAG 2.2 (AAA)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html), mit Ausnahmen. Die [Mindestzielgröße auf AA-Niveau](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) beträgt dort grundsätzlich $24 \times 24\text{ CSS-px}$, ebenfalls mit Ausnahmen, unter anderem für ausreichende Abstände.
  * Textkontrast nach WCAG AA grundsätzlich mindestens 4,5:1, bei großem Text 3:1; für relevante nichttextuelle UI-Elemente grundsätzlich 3:1, jeweils unter Beachtung der normativen Ausnahmen.
  * Tastaturbedienung, sichtbaren Fokus, sinnvolle Fokus-/Lesereihenfolge, verständliche Namen und Statusmeldungen sowie Zoom/Reflow und die Ausgabe mit einem Screenreader prüfen.
* **Befehle:**
  ```bash
  # Statische a11y-Regeln im konfigurierten Biome-Prüfumfang
  npx @biomejs/biome lint --only=a11y .

  # Vorhandene Browser-Interaktions- und Layoutprüfungen (kein vollständiger a11y-Audit)
  npm run build
  npm run test:e2e

  # Automatisierte Lighthouse-Prüfungen mit ausschließlich lokalen Berichten
  LHCI_UPLOAD__TARGET=filesystem LHCI_UPLOAD__OUTPUT_DIR=./.lighthouseci/reports npm run audit:lhci
  ```
  Anschließend HTML-Berichte im Browser auswerten und die nicht automatisierten Prüfziele manuell prüfen.
* **Wann nutzen:**
  * **Beim Erstellen interaktiver UI-Elemente:** Wenn Steuerelemente, Navigationsmenüs, Modals oder Noten-Widgets entwickelt werden.
  * **Nach Anpassung von Farbschemata:** Wenn Themes, Hintergründe oder Textfarben verändert werden; betroffene Zustände und Farbschemata gezielt auf Kontrast prüfen.
  * **Vor dem Commit von Template-Änderungen:** Um fehlende Alternativtexte oder fehlerhafte ARIA-Rollen bereits lokal beim Coden abzufangen.

## 4. Das verbindliche „Doing“ im Entwicklungsprozess

### 4.1 Während der Entwicklung: Rückfrage nach jeweils zehn Prompts

Copilot startet nach einzelnen Änderungen keine Tests automatisch, auch nicht bei größeren Komponenten- oder Doku-Änderungen. Nach jeweils zehn Nutzer-Prompts im laufenden Chat fragt Copilot über das Rückfragewerkzeug, ob Stufen 1 und 2 ausgeführt werden sollen. Toolaufrufe und Systemmeldungen zählen nicht mit. Tests laufen erst nach Zustimmung oder einem ausdrücklichen Testauftrag; bei Ablehnung wird ohne Tests weitergearbeitet. Nach der Entscheidung beginnt der nächste Zehnerblock.

Nach Freigabe passende Unit- und Komponententests auswählen. Bei Doku-Änderungen auch den Dokumentationstest berücksichtigen (`npx vitest run tests/documentation.test.ts`). Die folgenden Befehle sind Beispiele, keine automatisch auszuführenden Schritte:

```bash
npm run test:unit       # Stufe 1: Notationslogik, wenn kein passenderer Unit-Test vorliegt
npx vitest run tests/components/module-player-ui.test.ts -t "DrumPattern"  # Stufe 2: Modul-Player-Verhalten
```

Wähle passende Testdateien oder Testgruppen gezielt aus. Bei gemischten Dateien schränkt `-t` den Lauf auf passende Tests ein, z. B. `npx vitest run tests/module-builder.test.mjs -t "xp-tags|module-store"`. `npm test` enthält auch Integrationstests und ist daher kein Routinekommando für Stufe 1.

### 4.2 Erst am Branch-Ende: manueller Preflight mit Stufen 0, 3 und 4

Stufen 0, 3 und 4 laufen ausschließlich in `npm run preflight`, den der Nutzer am fertigen Branch manuell startet. Copilot startet weder den Preflight noch diese Stufen separat. Es gibt keinen automatischen Abschlusslauf bei Zwischen-Commits, Pushes oder Draft-PRs. Der Preflight enthält auch die vollständigen Prüfungen der Stufen 1 und 2 sowie Lighthouse; der Nutzer startet `npm run audit` separat.

`preflight` führt Validierung, Vitest, Build, Playwright, Lighthouse CI und `git diff --check` einzeln aus und gibt für jeden Schritt einen Ergebnisbericht mit Hinweisen zur Fehlerbehebung aus. Ein fehlgeschlagener unabhängiger Schritt verhindert nicht die Auswertung der übrigen Schritte. Playwright und Lighthouse CI werden übersprungen, wenn der Build fehlschlägt. Der Prozess endet mit Exit-Code 1, sobald mindestens ein ausgeführter Schritt fehlschlägt. `npm audit` ist separat mit `npm run audit` aufzurufen.

Lighthouse CI misst den Build und lädt Berichte standardmäßig in den konfigurierten temporären öffentlichen Speicher hoch; lokale Ablage lässt sich wie in Abschnitt 3.2 über Umgebungsvariablen wählen. `test:visual` führt die E2E-Suite mit Snapshot-Aktualisierung aus (derzeit ohne Snapshot-Assertions), `test:e2e:ui` startet den interaktiven Playwright-Modus; beide sind keine zusätzlichen Preflight-Gates.

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

1. Der manuell gestartete Preflight (`npm run preflight`) und das separate Audit (`npm run audit`) erfolgreich sind.
2. Ein vollständiger manueller Testlauf auf einem mobilen Touch-Endgerät erfolgreich protokolliert wurde.
3. Impressum, Datenschutzerklärung und 404-Seite funktionstüchtig live geschaltet sind.
4. Alle E2E-Browsertests bestehen und relevante visuelle Änderungen geprüft sind; vorhandene Snapshots bestehen ohne unbeabsichtigte Abweichung.
