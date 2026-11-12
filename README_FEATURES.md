# Features & Architektur des Gitarrenlernpfads

Dieses Dokument bietet eine vollständige Dokumentation aller Module, didaktischen Komponenten und technischen Subsysteme der Gitarrenlernpfad- und Musik-Hub-Plattform.

---

## 1. Systemübersicht & Modul-Matrix

Die Plattform verbindet musiktheoretische Didaktik mit interaktiven Web-Technologien und einem integrierten Beitrags-Backend:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                            GITARRENLERNPFAD-HUB                             │
├───────────────────────┬─────────────────────────────┬───────────────────────┤
│ Musik & Notation      │ Instrumenten-Interaktion    │ Fullstack & Community │
│ ├─ SVG-Notations-     │ ├─ FretboardClickable       │ ├─ IssueTracker       │
│ │  renderer (Bravura) │ ├─ Pattern-Sequencer        │ ├─ Serverless Func    │
│ ├─ AlphaTab Player    │ ├─ ChordSlider & TierList   │ ├─ GitHub REST Store  │
│ └─ KaTeX Harmonielehre│ └─ ScorePattern (Partitur)  │ └─ Checklisten-Editor │
└───────────────────────┴─────────────────────────────┴───────────────────────┘
```

---

## 2. Die Kern-Features im Detail

### 2.1 Der native SVG-Notationsrenderer
* **Dateien:** `src/lib/notation-renderer.ts`, `src/components/notation/NotationVisual.astro`, `src/lib/system-layout.ts`, `src/components/notation/NotationOverview.astro`.
* **Mathematische Module:** `src/components/music/` (`rhythm.ts`, `barline.ts`, `curve.ts`, `dynamics.ts`, `tempo.ts`, `time-signature.ts`, `rest.ts`, `svg.ts`).
* **Funktionsweise:**
  * Rendert Notensysteme rein serverseitig als Vektorgrafik (SVG) ohne Einsatz von ressourcenhungrigem Canvas oder DOM.
  * Verwendet standardisierte SMuFL-Glyphen (Bravura-Font) und berechnet Notenhälse, Balken, Vorzeichen und Bögen über mathematische Koordinaten.
  * **Feste Layout-Regel am Systembeginn:** Notenschlüssel $\rightarrow$ Taktart $\rightarrow$ Tonartvorzeichen.
  * **Umbruchs-Logik:** Die responsive 18-Takt-Übersicht bricht je nach Bildschirmbreite automatisch von 3 Takten auf 2 oder 1 Takt pro System um.
  * **Qualitätssicherung:** 20 isolierte Unit-Tests in `tests/music-notation.test.mjs` sichern Abstände, Taktstriche und Notenwerte ab.

### 2.2 Das interaktive Griffbrett (`FretboardClickable.astro`)
* **Datei:** `src/components/FretboardClickable.astro`
* **Funktionsweise:**
  * Zeichnet ein anpassbares Gitarrengriffbrett (Standard-Stimmung E-A-D-G-B-E) mit frei konfigurierbarer Bundanzahl ($0$ bis $12$ bzw. $24$ Bünde).
  * Unterstützt das Hervorheben von Tonleitern (z. B. Pentatonik, Dur/Moll-Skalen), Grundtönen (Roots) und Intervall-Farben.
  * Kann statisch für Lektionen gerendert werden oder Klick-Events auf einzelne Bünde und Saiten verarbeiten, um Notennamen oder Akkorde interaktiv abzufragen.

### 2.3 Die Rhythmus- und Pattern-Sequencer
* **Dateien:** 
  * `DrumPattern.astro`: 4/4-Raster mit 16tel-Auflösung zur Darstellung von Kick-, Snare- und Hi-Hat-Grooves.
  * `BassPattern.astro`: Rhythmus- und Tonhöhen-Muster für Bassläufe inklusive Grundton-Bindung.
  * `GuitarPattern.astro`: Visualisierung von Riffs, Anschlagmustern (Strumming: Down-/Upstrokes) und Powerchords.
  * `VocalPattern.astro`: Melodische Verläufe und Silbenrhythmik.
* **Architektur:** Die Komponenten fungieren als „Fabriken“. Sie erhalten über Props deklarative Daten (z. B. `beats={[1, 3]}`) und generieren daraus standardisierte, responsive HTML-/SVG-Gitter.

### 2.4 Die Songwriting-Gesamtpartitur (`ScorePattern.astro`)
* **Datei:** `src/components/ScorePattern.astro`
* **Funktionsweise:**
  * Führt die einzelnen Spuren (Drums, Bass, Gitarre, Gesang) zu einer mehrspurigen Partitur zusammen.
  * Bietet ausklappbare Instrumentenspuren und Taktleisten für das strukturierte Erarbeiten von Song-Abschnitten (Intro, Strophe, Pre-Chorus, Refrain, Bridge, Outro).

### 2.5 Harmonielehre- & Akkordbausteine
* **Dateien:** `ChordDiagramPattern.astro`, `ChordSlider.astro`, `ChordTierList.astro`, `ChordProgression.astro`, `ScalePattern.astro`.
* **Funktionsweise:**
  * **Akkorddiagramme:** Zeichnet standardisierte Grifftabellen mit Fingersatz, Leersaiten ($O$) und abgedämpften Saiten ($X$).
  * **ChordSlider:** Ermöglicht das stufenlose Transponieren von Kadenzen entlang des Quintenzirkels.
  * **ChordTierList:** Didaktisches Bewertungssystem für Akkorde nach Schwierigkeit und klanglicher Funktion.
  * **KaTeX-Integration:** Mathematisch exakte Darstellung von Stufensymbolen ($I - IV - V - vi$) und Alterationen via `remark-math` und `rehype-katex`.

### 2.6 AlphaTab MusicXML-Playback-Engine (`SheetMusicPlayer.astro`)
* **Datei:** `src/components/SheetMusicPlayer.astro`
* **Funktionsweise:**
  * Bindet die AlphaTab-Engine über Web Worker ein, um echte MusicXML- und GuitarPro-Dateien darzustellen.
  * Bietet integriertes Audio-Playback mit Noten-Highlighting während des Abspielens.
  * Isolierte Ausführung verhindert Speicherlecks und Performance-Einbußen im Hauptthread.

### 2.7 Das Serverless Beitragssystem & IssueTracker
* **Dateien:** `netlify/functions/contributions.ts`, `netlify/functions/lib/github-contribution-store.ts`, `src/lib/checklist-editor.ts`, `src/content/docs/projektierung/beitraege.mdx`.
* **Funktionsweise:**
  * **Architektur:** Serverless Endpunkt auf Netlify, der Daten entgegennimmt und via GitHub REST API in `data/contributions.json` ablegt.
  * **Kategorisierung:** Typen (`Feature`, `Bug`, `Decision`), Bereiche (`Theorie`, `Praxis`, `Komponente`), Prioritäten (`Niedrig`, `Mittel`, `Hoch`) und Status (`New`, `Active`, `Resolved`).
  * **Checklisten:** Bis zu 100 interaktive Checklistenpunkte pro Beitrag mit je maximal 200 Zeichen.
  * **Konfliktresistenz:** Automatische Wiederholungslogik (Retry-Loop) bei gleichzeitigem Schreibzugriff (HTTP 409 Conflict) unter Verwendung von GitHub Blob-SHAs.
  * **Schutz vor Build-Schleifen:** In `netlify.toml` ist ein Filter hinterlegt, der Commits auf `data/contributions.json` von automatischen Re-Builds ausschließt.

---

## 3. Didaktisches Curriculum & Level-Struktur

1. **Level 100 (Grundlagen der Musiktheorie):**
   * Lektion 101: „Vom Ton zur Gitarre“ (Frequenzen, Halbtöne, Griffbrett-Geometrie).
   * Lektion 102–104: Taktarten, Notenwerte, Intervalle und Vorzeichen.
   * Lektion 105: Interaktives Abschlussquiz mit dynamischer Notationsauswertung.
2. **Level 200–500 (Aufbaulehrgang):**
   * Level 200: Harmonie, Kadenzen und Pentatonik.
   * Level 300: Multi-Instrumentierung und Band-Arrangement.
   * Level 400: Digitale Audioworkstation (DAW) und Recording.
   * Level 500: Live-Praxis, Gehörbildung und Improvisation.
3. **Songwriting-Lehrgang (Rock in E-Moll):**
   * Schritt 0: Kompositionsidee und Skizze.
   * Schritt 1: Refrain (Hookline und Powerchords).
   * Schritt 2: Songstruktur und Dynamikplanung.
   * Schritt 3: Strophen und Pre-Chorus 1 & 2.
   * Schritt 4: Bridge und Spannungsaufbau.
   * Schritt 5: Intro, Outro und Finale.