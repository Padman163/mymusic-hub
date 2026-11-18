# Features & Architektur des Gitarrenlernpfads

Dieses Dokument gibt einen Überblick über die wichtigsten Komponenten und Subsysteme des Musik-Hubs. Details zum [Beitragssystem](README_FEAT_CONTRIBUTIONS.md), zum [Modul-Builder und Lernpfad](README_FEAT_MODULEBUILDER.md), zur [Notation und zum NotationBuilder](README_FEAT_NOTATION.md), zu den [Anforderungen für den Neuaufbau des Level-100-Quiz](README_FEAT_LEVEL100QUIZ.md), zu [Netlify Blobs](README_FEAT_NETLIFYBLOB.md) und zu [Tests](../README_TESTING.md) stehen in den jeweiligen Leitfäden.

Der separate [Notation-Handoff](README_FEAT_NOTATION_HANDOFF.md) ergänzt die Fachreferenz zum Notationsrenderer.

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
│ └─ KaTeX Harmonielehre│ └─ ScalePattern (Griffbrett)│ └─ Netlify Blobs      │
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

#### DrumPattern mit Soundfiles

`src/lib/drum-audio.ts` kapselt die native Web Audio API ohne Audio-Bibliothek.
Der gemeinsame `DrumAudioEngine` lädt und decodiert URLs einmal pro Seitenlauf;
parallele Ladevorgänge teilen sich denselben Cache. Nach Preloading und
Audiofreigabe startet jeder Schlag direkt mit einem eigenen BufferSource- und
GainNode; Schläge überlagern sich polyphon. Geräte-/Browserlatenz sowie die
Ladezeit beim ersten, noch nicht vorbereiteten Schlag bleiben technisch bedingt.

`patternData[].soundUrl?: string` hinterlegt einen Sound. `enableAudio?: boolean`
ist automatisch aktiv, sobald eine Spur eine Sound-URL hat; `false` deaktiviert
Preloading und Audio-Bedienung. Ohne Sound-URLs bleibt das bisherige Verhalten
unverändert. WAV, MP3 und OGG werden je nach Browser unterstützt.
Dateien gehören nach `public/sounds/drums/`; dort dokumentiert die
[Asset-Anleitung](../public/sounds/drums/README.md) Benennung und Lizenzangaben.
Es werden keine Samples mitgeliefert.

Nach dem Ablegen von `kick.wav` ist dieses MDX-Beispiel direkt verwendbar:

```mdx
import DrumPattern from '../../../../components/DrumPattern.astro';

<DrumPattern
  interactive={false}
  patternData={[
    {
      name: "Kick", note: "C1", color: "#ef4444",
      activeSteps: [0, 4], velocities: [127, 0, 0, 0, 64],
      soundUrl: "/sounds/drums/kick.wav",
    },
  ]}
/>
```

Der Importpfad gilt für die Feature-Seite unter
`src/content/docs/audio/referenzen-werkzeuge/`; bei anderer Seitentiefe anpassen.

Aktive Zellen spielen ihren Step-Anschlag (`0–127` linear auf `0–1`) ab;
ohne expliziten Wert gilt volle Lautstärke. Spur-Header spielen immer in voller
Lautstärke. Enter/Leertaste und Tab sind unterstützt; erfolgreich gestartete
Schläge leuchten etwa 150 ms auf. Bei `interactive={true}` bleibt das bisherige
Umschalten der Steps erhalten: Ein zuvor aktiver Step erklingt vor dem Ausschalten.
Änderungen in der Anschlagzeile wirken auch auf Audio.

`src/lib/drum-pattern.ts` verbindet Audio mit dem DOM-Controller
`initializeDrumPatterns` und dem dynamischen Modul-Player; Props und Validierung
liegen in `src/lib/module-schema.ts`. SSR greift nicht auf Browser-Audio zu.
Audiofreigabe erfolgt innerhalb einer Nutzeraktion. Fehlende Dateien,
Decodierfehler und blockiertes Audio werden in der Konsole gemeldet; fehlgeschlagene
Abspielversuche zeigen zusätzlich einen Statushinweis im Pattern, ohne die
Rasterbedienung zu blockieren. Ein erneuter Versuch ist möglich.

Bedienung: [Wiki: Drum-Pattern anhören](../src/content/docs/wiki/drum-pattern.mdx).
`tests/drum-audio.test.ts` prüft Cache, paralleles Laden, synchronen Cache-Start,
Polyphonie, Velocity, Fehler, SSR und DOM-/Tastaturinteraktionen mit Audio-Mocks.
Echte Audiogeräte-Latenz und Browser-Audiofreigaben werden damit nicht gemessen.

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
* **Dateien:** `src/components/ContributionList.astro`, `src/components/IssueTrackerForm.astro`, `netlify/functions/contributions.ts`, `netlify/functions/lib/contribution-store.ts`, `src/lib/checklist-editor.ts`, `src/content/docs/projektierung/beitraege.mdx`.
* **Funktionsweise:**
  * **Architektur:** Serverless-Endpunkt mit dem JSON-Key `contributions` in [Netlify Blobs](README_FEAT_NETLIFYBLOB.md).
  * **Kategorisierung:** Typen (`Feature`, `Bug`, `Decision`), Bereiche (`Theorie`, `Praxis`, `Komponente`), Prioritäten (`Niedrig`, `Mittel`, `Hoch`) und Status (`New`, `Active`, `Resolved`).
  * **Checklisten:** Bis zu 100 interaktive Checklistenpunkte pro Beitrag mit je maximal 200 Zeichen.
  * **Konfliktresistenz:** Bedingte Blob-Schreibzugriffe und Prüfung des erwarteten Beitragsstands schützen gleichzeitig bearbeitete Beiträge.
  * **Detailreferenz:** Die [Beitrags-Feature-Referenz](README_FEAT_CONTRIBUTIONS.md) dokumentiert Erstellen, Anzeigen, Filtern, Sortieren, Checklisten, Bearbeiten, Löschen, API und Persistenz.

### 2.8 Admin Modul- & Aufgaben-Builder (Autorenwerkbank)
* **Dateien:** `src/lib/xp-tags.ts`, `src/lib/module-schema.ts`, `src/lib/module-store.ts`, `src/lib/module-builder-ui.ts`, `src/components/project/ModuleBuilderForm.astro`, `src/components/project/ExerciseBuilderForm.astro`, `src/components/project/ModuleCatalogList.astro`, `src/content/docs/projektierung/modul-builder.mdx`, `netlify/functions/modules.ts`, `astro.config.mjs`, `data/modules.json`.
* **Funktionsweise:**
  * **Single Source of Truth für XP & Tags:** Zentrale Konfiguration (`TAG_DEFINITIONS`, `BASE_XP_DEFAULTS`, `calculateQuestionXp`) mit Tag-Multiplikatoren (z. B. `Notensystem` 1,5x, `Gitarre` 1,2x, `Allgemein` 1,0x).
  * **Vier Autoren-Tabs (`Übersicht`, `Modul erstellen`, `Quizfragen`, `Einstellungen`):** Katalog-Verwaltung (`ModuleCatalogList`), Modul- und Block-Editor (`ModuleBuilderForm`), wiederverwendbare Quizfragen für `mittel` und `schwer` (`ExerciseBuilderForm` mit Notationsvorschau) sowie globale Bestehensgrenzen (`QuizSettingsForm`). Lernpfad-Aufgaben (`leicht`) und Praxisaufgaben entstehen in der Modul-Blockliste. Datenmodell, Löschverhalten und Bedienung stehen in der [Modul-Referenz](README_FEAT_MODULEBUILDER.md).
  * **Persistenz & Dev-Fallback:** `/api/modules` speichert den Katalog und die Quiz-Einstellungen im Key `modules` in [Netlify Blobs](README_FEAT_NETLIFYBLOB.md). Nur `npm run dev` verwendet über das Vite-Plugin direkt `data/modules.json`.

### 2.9 Interaktiver Lernpfad, XP-Engine & Modul-Player
* **Dateien:** `src/lib/learning-progress.ts`, `src/lib/module-player-ui.ts`, `src/styles/module-player.css`, `src/components/learning/ProgressDashboard.astro`, `src/components/learning/ModuleRoadmap.astro`, `src/components/learning/ModuleStepper.astro`, `src/components/learning/ModuleQuizRunner.astro`, `src/content/docs/audio/theory/lernpfad.mdx`, `src/content/docs/audio/theory/modul.mdx`.
* **Funktionsweise:**
  * **Client-State & XP-Engine:** SSR-sichere `localStorage`-Persistenz (`mymusic_learning_progress_v1`) mit automatischem Curriculum-Sync, Duplikat-XP-Schutz (`solvedQuestionIds`), Level-Berechnung (500 XP pro Level) sowie Aufschlüsselung nach `scope` und `tags`.
  * **Geführter Lektions-Stepper & Fastlane:** Theorie, Lernpfad-Aufgaben und Praxisblöcke folgen der gespeicherten Inhaltsreihenfolge, danach folgt das Quiz (`mittel`). Die globalen Bestehensgrenzen verwenden standardmäßig 80 % für das Quiz und 85 % für Fastlane (`schwer`); gespeicherte Einstellungen können abweichen. Änderungen der Grenzen setzen den lokalen Lernfortschritt zurück. Fastlane vergütet noch offene Inhalte und entsperrt das Folgemodul; die Links sind derzeit ausgeblendet. Details stehen in der [Modul-Referenz](README_FEAT_MODULEBUILDER.md).
  * **Aufgaben-Auswertung:** Live-Synchronisation zwischen Dashboard, Roadmap und Stepper via CustomEvent `learning-progress:updated`; unterstützt u. a. Zahlen/Einheiten-Abgleich (`880` / `880 Hz`) sowie die `NotationBuilder.astro`-Tonhöhenprüfung (`expectedPitches` exakt und oktavunabhängig).

---

## 3. Didaktisches Curriculum & Level-Struktur

1. **Level 100:** Schall, Frequenz und Tonsystem (101), Mechanik, Haltung und Anschlag (102), Rhythmus, Takt und Metrum (103), Notensystem und Tabulatur (104) sowie Abschlussquiz (105).
2. **Level 200–500:** Die Navigation führt die Bereiche Harmonie & Akkorde, Multi-Instrumentierung, DAW & Produktion sowie Band & Performance.
3. **Songwriting:** Ein eigener Bereich ergänzt den Lernpfad. Die tatsächlichen Inhalte stehen in `src/content/docs/` und der Navigation in `astro.config.mjs`.