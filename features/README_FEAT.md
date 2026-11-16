# Features & Architektur des Gitarrenlernpfads

Dieses Dokument gibt einen Überblick über die wichtigsten Komponenten und Subsysteme des Musik-Hubs. Details zum [Modul-Builder und Lernpfad](README_FEAT_MODULEBUILDER.md), zur [Notation](README_FEAT_NOTATION.md) und zu [Tests](../README_TESTING.md) stehen in den jeweiligen Leitfäden.

Für Übergaben gibt es separate Handoffs zur [Notation](README_FEAT_NOTATION_HANDOFF.md) und zum [NotationBuilder](README_FEAT_NOTATIONBUILDER_HANDOFF.md). Sie ergänzen die Fachreferenzen, ersetzen sie aber nicht.

---

## 1. Systemübersicht & Modul-Matrix

Die Plattform verbindet musiktheoretische Didaktik mit interaktiven Web-Technologien und einem integrierten Beitrags-Backend:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                            GITARRENLERNPFAD-HUB                             │
├───────────────────────┬─────────────────────────────┬───────────────────────┤
│ Musik & Notation      │ Instrumenten-Interaktion    │ Fullstack, Admin & XP  │
│ ├─ SVG-Notations-     │ ├─ FretboardClickable       │ ├─ Modul-Builder (CMS) │
│ │  renderer (Bravura) │ ├─ Pattern-Sequencer        │ ├─ XP-Lernpfad-Player  │
│ ├─ NotationBuilder    │ ├─ ChordSlider & TierList   │ ├─ IssueTracker        │
│ ├─ AlphaTab Player    │ ├─ ScorePattern (Partitur)  │ ├─ Serverless Func     │
│ └─ KaTeX Harmonielehre│ └─ ScalePattern (Griffbrett)│ └─ GitHub REST Store   │
└───────────────────────┴─────────────────────────────┴───────────────────────┘
```

---

## 2. Die Kern-Features im Detail

### 2.1 Der native SVG-Notationsrenderer
* **Dateien:** `src/components/notation/Notation.astro`, `src/components/notation/NotationVisual.astro`, `src/components/notation/NotationKeyboard.astro`, `src/lib/notation-renderer.ts`, `src/lib/system-layout.ts`, `src/lib/notation-layout.ts`, `src/lib/notation-fit.ts`.
* **Mathematische Module:** `src/lib/` (`rhythm.ts`, `barline.ts`, `curve.ts`, `dynamics.ts`, `tempo.ts`, `time-signature.ts`, `rest.ts`, `articulation.ts`, `svg.ts`) sowie `src/components/ui/` (`MeasureNumber.astro`, `TempoLabel.astro`, `FinalBar.astro`).
* **Funktionsweise:**
  * Rendert Notensysteme rein serverseitig als Vektorgrafik (SVG) ohne Einsatz von ressourcenhungrigem Canvas oder DOM.
  * Verwendet standardisierte SMuFL-Glyphen (Bravura-Font) und berechnet Notenhälse, Balkengruppen (`beamGroupStemUp`), Vorzeichen, Dynamik und Bögen über mathematische Koordinaten.
  * **Feste Layout-Regel am Systembeginn:** Notenschlüssel $\rightarrow$ Taktart $\rightarrow$ Tonartvorzeichen $\rightarrow$ Wiederholungszeichen $\rightarrow$ erste Note (mit dynamischem `measureNumberOffset` für Taktzahlen).
  * **Umbruchs-Logik:** `<Notation />` unterstützt `layout="auto" | number | number[]` sowie responsive Container-Skalierung (`observeNotationFit`).
  * **Qualitätssicherung:** Vitest-Tests in `tests/music-notation.test.mjs` und Playwright-Tests in `tests/e2e/smoke.spec.ts` sichern Abstände, Layoutregeln, Taktstriche und Notenwerte ab. Aktuelle Befehle stehen im [Testing-Leitfaden](../README_TESTING.md).

### 2.2 Das interaktive Griffbrett (`FretboardClickable.astro`)
* **Datei:** `src/components/FretboardClickable.astro`
* **Funktionsweise:**
  * Zeichnet ein Gitarrengriffbrett in Standardstimmung E-A-D-G-B-E mit Leersaiten und Bünden bis zum 12. Bund.
  * Unterstützt feste Positionen, Notennamen und interaktive Markierungen; mit `readOnly` kann es statisch dargestellt werden. Für Tonleitermuster gibt es separat `ScalePattern.astro`.

### 2.3 Die Rhythmus- und Pattern-Sequencer
* **Dateien:** 
  * `DrumPattern.astro`: Konfigurierbares Raster für Schlagzeugspuren; standardmäßig 4/4 mit Achtel-Auflösung.
  * `BassPattern.astro`: Rhythmus- und Tonhöhen-Muster für Bassläufe inklusive Grundton-Bindung.
  * `GuitarPattern.astro`: Visualisierung von Riffs, Anschlagmustern (Strumming: Down-/Upstrokes) und Powerchords.
  * `VocalPattern.astro`: Melodische Verläufe und Silbenrhythmik.
* **Architektur:** Die Komponenten erhalten deklarative Daten über ihre jeweiligen Props und generieren daraus HTML-/SVG-Gitter. `DrumPattern` verwendet beispielsweise `patternData` mit `activeSteps`.

### 2.4 Die Songwriting-Gesamtpartitur (`ScorePattern.astro`)
* **Datei:** `src/components/ScorePattern.astro`
* **Funktionsweise:**
  * Führt die einzelnen Spuren (Drums, Bass, Gitarre, Gesang) zu einer mehrspurigen Partitur zusammen.
  * Bietet ausklappbare Instrumentenspuren und Taktleisten für das strukturierte Erarbeiten von Song-Abschnitten (Intro, Strophe, Pre-Chorus, Refrain, Bridge, Outro).

### 2.5 Harmonielehre- & Akkordbausteine
* **Dateien:** `ChordDiagramPattern.astro`, `ChordSlider.astro`, `ChordTierList.astro`, `ChordProgression.astro`, `ScalePattern.astro`.
* **Funktionsweise:**
  * **Akkorddiagramme:** Zeichnet standardisierte Grifftabellen mit Fingersatz, Leersaiten ($O$) und abgedämpften Saiten ($X$).
  * **ChordSlider:** Visualisiert verschiebbare Powerchord-Griffe auf dem Griffbrett.
  * **ChordTierList:** Didaktisches Bewertungssystem für Akkorde nach Schwierigkeit und klanglicher Funktion.
  * **KaTeX-Integration:** Mathematisch exakte Darstellung von Stufensymbolen ($I - IV - V - vi$) und Alterationen via `remark-math` und `rehype-katex`.

### 2.6 AlphaTab MusicXML-Playback-Engine (`SheetMusicPlayer.astro`)
* **Datei:** `src/components/SheetMusicPlayer.astro`
* **Funktionsweise:**
  * Bindet AlphaTab zur Darstellung einer über `musicXmlUrl` angegebenen Partitur ein.
  * Aktiviert die Audiowiedergabe nur, wenn zusätzlich eine SoundFont über `soundFontUrl` angegeben wird.

### 2.7 Das Serverless Beitragssystem & IssueTracker
* **Dateien:** `netlify/functions/contributions.ts`, `netlify/functions/lib/github-contribution-store.ts`, `src/lib/checklist-editor.ts`, `src/content/docs/projektierung/beitraege.mdx`.
* **Funktionsweise:**
  * **Architektur:** Serverless Endpunkt auf Netlify, der Daten entgegennimmt und via GitHub REST API in `data/contributions.json` ablegt.
  * **Ziel-Branch:** `GITHUB_BRANCH` steuert den GitHub-Branch für Beiträge und Module gemeinsam; ohne Angabe gilt `main`. Einrichtung und lokale Besonderheiten stehen im [Workspace-Setup](../README_WORKSPACE_SETUP.md#schritt-5-netlify-cli-verknüpfen-umgebungsvariablen-für-das-backend-einrichten--fullstack-starten).
  * **Kategorisierung:** Typen (`Feature`, `Bug`, `Decision`), Bereiche (`Theorie`, `Praxis`, `Komponente`), Prioritäten (`Niedrig`, `Mittel`, `Hoch`) und Status (`New`, `Active`, `Resolved`).
  * **Checklisten:** Bis zu 100 interaktive Checklistenpunkte pro Beitrag mit je maximal 200 Zeichen.
  * **Konfliktresistenz:** Automatische Wiederholungslogik (Retry-Loop) bei gleichzeitigem Schreibzugriff (HTTP 409 Conflict) unter Verwendung von GitHub Blob-SHAs.
  * **Schutz vor Build-Schleifen:** In `netlify.toml` ist ein Filter hinterlegt, der Commits auf `data/contributions.json` (inzwischen erweitert auf `data/**`) von automatischen Re-Builds ausschließt.

### 2.8 Admin Modul- & Aufgaben-Builder (Autorenwerkbank)
* **Dateien:** `src/lib/xp-tags.ts`, `src/lib/module-schema.ts`, `src/lib/module-store.ts`, `src/lib/module-builder-ui.ts`, `src/components/project/ModuleBuilderForm.astro`, `src/components/project/ExerciseBuilderForm.astro`, `src/components/project/ModuleCatalogList.astro`, `src/content/docs/projektierung/modul-builder.mdx`, `netlify/functions/modules.ts`, `astro.config.mjs`, `data/modules.json`.
* **Funktionsweise:**
  * **Single Source of Truth für XP & Tags:** Zentrale Konfiguration (`TAG_DEFINITIONS`, `BASE_XP_DEFAULTS`, `calculateQuestionXp`) mit Tag-Multiplikatoren (z. B. `Notensystem` 1,5x, `Gitarre` 1,2x, `Allgemein` 1,0x).
  * **Drei Autoren-Tabs:** Anlegen/Bearbeiten von Lernmodulen inkl. dynamischem Theorie-Block-Editor (`ModuleBuilderForm`), Erstellen von Aufgaben für `exercise`, `quiz_easy` und `fastlane` (`single_choice`, `multi_select`, `numeric_input`, `interactive_notation` mit eingebetteter `NotationBuilder`-Live-Vorschau) sowie Katalog-Verwaltung mit Listen-/Kartenansicht und kaskadierendem Löschen (`ModuleCatalogList`).
  * **Persistenz & Dev-Fallback:** Speichert produktiv über `/api/modules` in `data/modules.json` via GitHub Contents API (optimistic locking mit 3 Retries bei HTTP 409) und lokal unter `npm run dev` über ein Vite-Dev-Plugin in `astro.config.mjs` direkt in `data/modules.json`.
  * **Ziel-Branch:** Die Netlify Function verwendet denselben `GITHUB_BRANCH` wie das Beitragssystem; der lokale Dev-Endpunkt verwendet stattdessen die Workspace-Datei.

### 2.9 Interaktiver Lernpfad, XP-Engine & Modul-Player
* **Dateien:** `src/lib/learning-progress.ts`, `src/lib/module-player-ui.ts`, `src/styles/module-player.css`, `src/components/learning/ProgressDashboard.astro`, `src/components/learning/ModuleRoadmap.astro`, `src/components/learning/ModuleStepper.astro`, `src/components/learning/ModuleQuizRunner.astro`, `src/content/docs/audio/theory/lernpfad.mdx`, `src/content/docs/audio/theory/modul.mdx`.
* **Funktionsweise:**
  * **Client-State & XP-Engine:** SSR-sichere `localStorage`-Persistenz (`mymusic_learning_progress_v1`) mit automatischem Curriculum-Sync, Duplikat-XP-Schutz (`solvedQuestionIds`), Level-Berechnung (500 XP pro Level) sowie Aufschlüsselung nach `scope` und `tags`.
  * **Geführter Lektions-Stepper & Fastlane:** Step-by-Step-Freischaltung (`theory` → `exercise` → optional `practice` bei `hasPractice: true` → `quiz_easy`) mit KaTeX-/Markdown-Rendering und eingebetteten Visualisierungen. Die Bestehensgrenzen sind pro Modul einstellbar (Standard: 80 % für das Quiz, 85 % für Fastlane). Fastlane schreibt den offenen Theorie-Basiswert und die XP ungelöster Fragen gut und entsperrt das Folgemodul.
  * **Aufgaben-Auswertung:** Live-Synchronisation zwischen Dashboard, Roadmap und Stepper via CustomEvent `learning-progress:updated`; unterstützt u. a. Zahlen/Einheiten-Abgleich (`880` / `880 Hz`) sowie die `NotationBuilder.astro`-Tonhöhenprüfung (`expectedPitches` exakt und oktavunabhängig).

---

## 3. Didaktisches Curriculum & Level-Struktur

1. **Level 100:** Schall, Frequenz und Tonsystem (101), Mechanik, Haltung und Anschlag (102), Rhythmus, Takt und Metrum (103), Notensystem und Tabulatur (104) sowie Abschlussquiz (105).
2. **Level 200–500:** Die Navigation führt die Bereiche Harmonie & Akkorde, Multi-Instrumentierung, DAW & Produktion sowie Band & Performance.
3. **Songwriting:** Ein eigener Bereich ergänzt den Lernpfad. Die tatsächlichen Inhalte stehen in `src/content/docs/` und der Navigation in `astro.config.mjs`.