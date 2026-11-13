# Handoff: Feature `Notation.astro` (`feat/notation`)

Dieser Leitfaden fasst den aktuellen Architektur-, Regel- und Teststand des nativen SVG-Notationssystems für zukünftige Chats zusammen. Für die vollständige Prop- und API-Referenz von `<Notation />` siehe `README_NOTATION.md`.

## 1. Tech-Stack
* **Framework:** Astro `^7.4.8` + `@astrojs/starlight` `^0.42.10`
* **Abhängigkeiten & Tooling:** TypeScript `^6.0.3`, Biome `2.6.6`, Vitest `^5.1.0`, Playwright `^1.65.0`, `@coderline/alphatab` `^1.9.0`
* **Font / Glyphen:** Standardisierte SMuFL-Glyphen (Bravura) als reines Server-Side-SVG (kein Canvas/DOM-Renderer für `<Notation />`).

## 2. Aktive Architektur & Dateien
Legacy-Komponenten (`NotationOverview.astro`, `NotationSystem.astro`, `DynamicsMarks.astro`, `RepeatMark.astro`, `TempoHeading.astro` usw.) sowie der frühere Ordner `src/components/music/` wurden entfernt.

* **Komponenten (`src/components/notation/`):**
  * `Notation.astro`: Deklarative Hauptkomponente (polymorph für Einzeltakt-`notes` und Mehrtakt-`measures`, Layout, Skalierung, Dynamik, Bögen, Wiederholungen).
  * `NotationVisual.astro`: Einzeltakt-Renderer (kapselt SVG-Output + UI-Overlays).
  * `NotationKeyboard.astro`: Zweisystem-Klaviernotation (Violin- und Bassschlüssel mit Akkoladenklammer).
  * `system-layout.ts`: Re-Export von `src/lib/system-layout.ts`.
* **UI-Overlays (`src/components/ui/`):**
  * `MeasureNumber.astro`, `TempoLabel.astro`, `FinalBar.astro`
* **Kernlogik (`src/lib/`):**
  * `notation-renderer.ts`: SMuFL-SVG-Rendering, Noten, Hälse, `beamGroupStemUp`, Balken, Vorzeichen, Artikulation.
  * `system-layout.ts`: Zeilenumbruch (`arrangeNotationSystems`), Spalten-/Blocksatz-Mathematik, `measureNumberOffset`, `hairpinStart`/`hairpinEnd`.
  * `notation-layout.ts`: Horizontale Ereignisverteilung (`layoutNotationEvents`).
  * `notation-fit.ts`: Responsive Container-Skalierung (`observeNotationFit` für `data-fit-to-width`).
  * **Fachmodule (`src/lib/`):** `rhythm.ts`, `rest.ts`, `articulation.ts`, `curve.ts`, `barline.ts`, `time-signature.ts`, `tempo.ts`, `dynamics.ts`, `svg.ts`
* **Styles:** `src/styles/music.css`, `src/styles/notation.css`

## 3. Verifizierte Layout- & Notationsregeln
1. **Präfix-Reihenfolge am Takt-/Systemanfang:** Notenschlüssel $\rightarrow$ Taktart $\rightarrow$ Tonartvorzeichen $\rightarrow$ Wiederholungszeichen (`repeatStart`) $\rightarrow$ erste Note.
2. **Taktzahlen (`measureNumberOffset`):** `<MeasureNumber />` wird automatisch hinter `prefixEnd` (Schlüssel, Taktart, Vorzeichen, Wiederholungszeichen) geschoben, damit keine Überlappungen entstehen.
3. **Balkengruppen (`beamGroupStemUp`):** Alle Notenhälse einer `beamGroup` zeigen in dieselbe Richtung (Mehrheit unter vs. auf/über Mittellinie `step: 4`; bei Gleichstand größere Maximaldistanz zu `step: 4`, danach standardmäßig abwärts). Die Balkensteigung verläuft linear zwischen erster und letzter Note.
4. **Zeilenumbruch & Breite:** `layout` unterstützt `'auto'` (`DEFAULT_MAX_SYSTEM_WIDTH = 600` / `scale`), `number` und `number[]`; dazu `measureWidth` (`'rhythmic' | 'equal'`), `stretchLastRow`, `pickup` (Auftakt) sowie `scrollable` vs. `observeNotationFit`.
5. **Dynamik & Bögen:** Unterstützt taktweises `hairpin` sowie notenbezogene `hairpinStart` / `hairpinEnd` (auch über Takte und Systemumbrüche hinweg), `dynamic`, `dynamicText`, `curves` (`slur` / `tie`) und `ritAt` / `aTempoAt`.
6. **Notenschlüssel:** `<Notation>` erlaubt taktweise Schlüssel (z. B. für `layout={1}` Violin-/Bassschlüssel-Vergleiche); für strikte Stücke ohne Wechsel steht der optionale Helper `assertNoClefChanges()` in `src/lib/notation-renderer.ts` bereit.

## 4. Dokumentation & Qualitätsstand
* **API-Referenz / Cheat Sheet:** `README_NOTATION.md`
* **Live-Dokumentation im Wiki (`Features` → `Notation.astro`):** `src/content/docs/audio/referenzen-werkzeuge/visualisierungen-erklaert/notensystem.mdx` (inkl. 18-Takt-Beispiel und Code-Erklärungen)
* **Checks & Tests (Stand vor Abschluss dieses Branches):**
  * `npm run validate` (`biome check .`, `astro check`, `tsc --noEmit`)
  * `npm run test` (48 Vitest-Tests gesamt, davon 41 in `tests/music-notation.test.mjs`)
  * `npm run test:e2e` (18 Playwright-Tests in `tests/e2e/smoke.spec.ts` auf Desktop Chrome & Mobile Safari)
  * `npm run build` (37 Seiten)

## 5. Offene Punkte / Mögliche nächste Schritte
* Das 18-Takt-Gesamtbeispiel in `notensystem.mdx` deckt noch nicht alle Features der Engine ab (z. B. `title`/`subtitle` auf Stück-Ebene, Auftakt `pickup`, taktübergreifendes `hairpinStart`/`hairpinEnd`, `sixteenth`-Pause, Tonartwechsel-Auflösung mit `accidentals: []` sowie Bassschlüssel).
* Falls zukünftig neue Notation-Props oder Layout-Regeln hinzukommen, immer parallel in `README_NOTATION.md` und `tests/music-notation.test.mjs` nachziehen.
