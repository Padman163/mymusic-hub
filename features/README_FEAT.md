# Features & Architektur des Gitarrenlernpfads

Dieses Dokument gibt einen Überblick über die wichtigsten Komponenten und Subsysteme des Musik-Hubs. Details zur [Authentifizierung und Lernkonten](README_FEAT_AUTHENTICATION.md), zum [Audioplayer für Drum-Patterns](README_FEAT_AUDIOPLAYER.md), zum [Beitragssystem](README_FEAT_CONTRIBUTIONS.md), zum [Modul-Builder und Lernpfad](README_FEAT_MODULEBUILDER.md), zum [XP-System](README_FEAT_XP-SYSTEM.md), zur [Notation und zum NotationBuilder](README_FEAT_NOTATION.md), zu den [Anforderungen für den Neuaufbau des Level-100-Quiz](README_FEAT_LEVEL100QUIZ.md), zu [Netlify Blobs](README_FEAT_NETLIFYBLOB.md) und zu [Tests](../README_TESTING.md) stehen in den jeweiligen Leitfäden.

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

Der native Web-Audio-Player ergänzt Vorhören mit Velocity, Play/Stop und
Leertasten-Loops bei einstellbaren Viertel-BPM. Die Wiedergabe berücksichtigt
die Spurauswahl und lässt sich unabhängig von den übrigen Bedienelementen
konfigurieren. Ohne Sound-URLs bleibt das Raster rein visuell.

Architektur, Props, Timing, Abbruch, Fehlerfälle und Tests stehen zentral in der
[Audioplayer-Referenz](README_FEAT_AUDIOPLAYER.md). Die
[Wiki-Anleitung](../src/content/docs/wiki/drum-pattern.mdx) erklärt die Bedienung;
die [Asset-Referenz](../public/sounds/drums/README.md) nennt die vorhandenen
Dateien und noch fehlenden Lizenzangaben.

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
  * **Persistenz & Dev-Fallback:** `/api/modules` speichert Katalog, Quiz-Einstellungen und Shop-Konfiguration im Key `modules` in [Netlify Blobs](README_FEAT_NETLIFYBLOB.md). Die Builder-Oberfläche kann derzeit die Quiz-Grenzen, aber nicht den Shop-Katalog bearbeiten. Persönliche Lernstände, XP, Käufe und Ausrüstung liegen nach Anmeldung pro Konto im separaten Store `mymusic-hub-user-data`. Nur `npm run dev` verwendet über das Vite-Plugin direkt `data/modules.json`.

### 2.9 Interaktiver Lernpfad, XP-Engine & Modul-Player
* **Dateien:** `src/lib/learning-progress.ts`, `src/lib/module-player-ui.ts`, `src/styles/module-player.css`, `src/components/learning/ProgressDashboard.astro`, `src/components/learning/ModuleRoadmap.astro`, `src/components/learning/ModuleStepper.astro`, `src/components/learning/ModuleQuizRunner.astro`, `src/content/docs/audio/theory/lernpfad.mdx`, `src/content/docs/audio/theory/modul.mdx`.
* **Funktionsweise:**
  * **Lernstand & XP-Engine:** Konto-gebundene Cloud-Persistenz nach Anmeldung mit lokalem Cache und einmaliger Migration vorhandener Gaststände, automatischem Curriculum-Sync, Duplikat-XP-Schutz (`solvedQuestionIds`), Level-Berechnung (500 XP pro Level) sowie Aufschlüsselung nach `scope` und `tags`. Das Dashboard wird daraus berechnet.
  * **Geführter Lektions-Stepper & Fastlane:** Theorie, Lernpfad-Aufgaben und Praxisblöcke folgen der gespeicherten Inhaltsreihenfolge, danach folgt das Quiz (`mittel`). Die globalen Bestehensgrenzen verwenden standardmäßig 80 % für das Quiz und 85 % für Fastlane (`schwer`); gespeicherte Einstellungen können abweichen. Änderungen der Grenzen setzen beim nächsten Laden den gespeicherten Lernfortschritt einschließlich XP zurück; bei aktiver Anmeldung wird der neue Stand mit dem Konto synchronisiert. Fastlane vergütet noch offene Inhalte und entsperrt das Folgemodul; die Links sind derzeit ausgeblendet. Details stehen in der [Modul-Referenz](README_FEAT_MODULEBUILDER.md).
  * **Aufgaben-Auswertung:** Live-Synchronisation zwischen Dashboard, Roadmap und Stepper via CustomEvent `learning-progress:updated`; unterstützt u. a. Zahlen/Einheiten-Abgleich (`880` / `880 Hz`) sowie die `NotationBuilder.astro`-Tonhöhenprüfung (`expectedPitches` exakt und oktavunabhängig).
  * **Humpa-Shop und Inventar:** Unter **Bediener** bietet der **Humpa-Shop** Sound-Items aus dem gemeinsamen Online-Katalog; das Inventar zeigt konto-gebundene Freischaltungen. Click kostet 10 und Kick 30 verfügbare XP; jeder Sound kann nur einmal gekauft werden. Insgesamt verdiente XP und Level bleiben unverändert. Die Bedienung steht in der [Wiki-Anleitung](../src/content/docs/wiki/inventar.mdx).
  * **Studio-Ausrüstung:** Unter **Bediener → Studio** können gekaufte Sounds per Klick oder Drag-and-drop in ein Metronom ausgerüstet werden. Der ausgerüstete Sound wird beim Prüfen von Lernpfad- und Quizaufgaben abgespielt.

Die vollständige Architektur des Lern-, Währungs- und Ausrüstungsmodells steht in der [XP-System-Referenz](README_FEAT_XP-SYSTEM.md).

### 2.10 Authentifizierung und Lernkonten

Netlify Identity stellt Anmeldung, optionale Selbstregistrierung und Einladungen
bereit. Lernfortschritt, XP, Quiz-Bestwerte, Käufe, Inventar und Studio-Ausrüstung
werden pro Konto in einem separaten Blob-Store gespeichert und nach Anmeldung
geräteübergreifend synchronisiert. Der Admin-Bereich kann Identity-Status
anzeigen und Einladungen versenden; die Registrierungsoptionen selbst bleiben
in der Netlify-Konfiguration.
Architektur und API-Verhalten stehen in der
[Authentifizierungs-Referenz](README_FEAT_AUTHENTICATION.md), die Bedienung in
der [Wiki-Anleitung zum Lernkonto](../src/content/docs/wiki/lernstand-konto.mdx).

---

## 3. Didaktisches Curriculum & Level-Struktur

1. **Level 100:** Schall, Frequenz und Tonsystem (101), Mechanik, Haltung und Anschlag (102), Rhythmus, Takt und Metrum (103), Notensystem und Tabulatur (104) sowie Abschlussquiz (105).
2. **Level 200–500:** Die Navigation führt die Bereiche Harmonie & Akkorde, Multi-Instrumentierung, DAW & Produktion sowie Band & Performance.
3. **Songwriting:** Ein eigener Bereich ergänzt den Lernpfad. Die tatsächlichen Inhalte stehen in `src/content/docs/` und der Navigation in `astro.config.mjs`.