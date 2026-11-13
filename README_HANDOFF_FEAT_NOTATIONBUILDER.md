# Handoff: Feature `NotationBuilder.astro` (`feat/notationbuilder`)

Dieser Leitfaden fasst die Architektur, Verhaltensweisen, Props, Quiz-Einbindung und den Teststand des interaktiven Notations-Builders zusammen. Für die allgemeinen Regeln des statischen SVG-Renderers siehe `README_HANDOFF_FEAT_NOTATION.md` sowie `README_NOTATION.md`.

## 1. Übersicht & Ziel
`NotationBuilder.astro` (`src/components/notation/NotationBuilder.astro`) ist eine interaktive Schicht über dem nativen SVG-Notationssystem. Sie ermöglicht es Nutzern (z. B. im Rahmen von interaktiven Quiz-Aufgaben oder Lernmodulen), Noten interaktiv per Maus oder Tastatur in einem Notensystem zu platzieren und zu löschen.

Standardmäßig entspricht das Aussehen einem reduzierten Einzeltakt ohne linken und ohne rechten Taktstrich (`showLeftBar={false}`, `showRightBar={false}`). Es kann genau eine Viertelnote per Tastatur oder Mausklick platziert werden. Mit `compact={true}` schrumpft die Komponente auf eine kompakte Breite zusammen (ideal für Quiz- und Übungsfragen).

## 2. Aktive Architektur & Dateien
* **Komponente (`src/components/notation/NotationBuilder.astro`):**
  * Kapselt die serverseitig vorgerenderte SVG-Ansicht inklusive des orangefarbenen, abgerundeten Auswahlcursors (`.notation-builder-cursor-head`).
  * Unterstützt `compact` für Inline-/Quiz-Darstellung sowie `observeNotationFit()`.
* **Kernlogik & Controller (`src/lib/notation-builder.ts`):**
  * `stepToPitchName(step, clef)` & `pitchNameToStep(pitch, clef)`: Zuordnung zwischen `step` (`-2` bis `10`) und Tonnamen (`treble` & `bass`).
  * `stepToY(step)` & `yToStep(y)`: Y-Koordinate im Bravura-Notensystem (`SPATIUM = 10`, `STAFF_BOTTOM = 64`).
  * `renderNotationBuilderSvg()`: Erzeugt das SVG auf Basis von `renderNotationSvg()` und ergänzt den Cursor-Marker und optionale Badges.
  * `attachNotationBuilder(root)` & `setupNotationBuilders()`: Clientseitige Event-Verkabelung (Mausklick, Tastatursteuerung, CustomEvents).
* **Styles (`src/styles/notation.css`):**
  * `.notation-builder`: Fokussierbarkeit (`tabindex="0"`, `:focus-visible`).
  * `.notation-builder-cursor-head`: Abgerundetes orangefarbenes Rechteck (`rx="4"`, `width="17.5"`, `height="14"`) mit dunklerem Rahmen (`#c2410c` / `#9a3412`).
  * `.notation-builder-footer`: Optionale Statusleiste und Tasten-Hinweise.
* **Quiz-Integration (`src/components/Level100Quiz.astro`):**
  * Frage 1 in "Teil 4: Notation in fünf Beispielen": Tonhöhen-Eingabe auf den 5 Notenlinien in der `compact="wide"`-Version mit `showHints` und "Antwort einloggen"-Button.
  * Frage 2 in "Teil 4: Notation in fünf Beispielen": Notenwert-Eingabe mit der visuellen Button-Leiste (`showDurationPicker`, `compact="wide"`, `showHints`) und "Antwort einloggen"-Button.
  * Gesamtpunkte: `21` (`passingPoints = 17`).
  * Beide interaktiven Fragen validieren direkt und fließen in das Gesamtergebnis des Quiz ein.
* **Dokumentation:**
  * `src/content/docs/audio/referenzen-werkzeuge/visualisierungen-erklaert/notationbuilder.mdx`.
  * Verlinkt in `astro.config.mjs` (Sidebar unter Features) und in `visualisierungen-erklaert.mdx`.

## 3. Bedienung & Interaktionsregeln
1. **Maus:**
   * Klick in das Notensystem: Ermittelt die vertikale Position (`yToStep`), setzt den Cursor auf die entsprechende Notenlinie bzw. den Zwischenraum (`-2` bis `10`) und fokussiert das Element.
   * Klick auf einen Notenwert in der Toolbar (`showDurationPicker`):
     * Ist bereits eine Note platziert, ändert sich ihr Notenwert (`whole`, `half`, `quarter`, `eighth`, `sixteenth`) sofort.
     * Ist noch keine Note platziert, wird die Note direkt an der aktuellen Cursor-Position mit dem gewählten Notenwert gesetzt.
2. **Tastatur:**
   * `ArrowUp` / `ArrowDown`: Verschiebt den Cursor schrittweise (`clampStep` hält ihn im Bereich `-2..10`).
   * `Leertaste`: Platziert an der aktuellen Cursor-Position eine Note mit dem aktiven Notenwert (`activeDuration`, Standard: `"quarter"`).
   * `NUM 1` bzw. Taste `1`: Schaltet den Notenwert zyklisch durch (`Ganze` → `Halbe` → `Viertel` → `Achtel` → `16tel`). Ist bereits eine Note platziert, ändert sich ihr Notenwert sofort.
   * `Entf` (`Delete`) bzw. `Backspace`: Entfernt eine gesetzte Note wieder.
3. **Props:**
   * `initialStep` (Standard: `4` / Mittellinie).
   * `initialDuration` (Standard: `"quarter"`).
   * `allowedDurations` (Standard: alle 5 Notenwerte).
   * `showDurationPicker` (Standard: `false`): Schaltet die Button-Toolbar zur Notenwert-Auswahl ein.
   * `compact` (Standard: `false`): Kompakte Breite (`true` / `"tight"` = ultraschmal wie im Quiz, `"wide"` = Standard-Notationslänge von 300px; beide Varianten standardmäßig ohne rechten Taktstrich).
   * `showRightBar` (Standard: `false`): Taktstrich rechts (standardmäßig aus; kann mit `showRightBar={true}` explizit aktiviert werden).
   * `showLabel` (Standard: `false`): Schaltet das Noten-/Aktions-Badge direkt am Cursor ein.
   * `showStatus` (Standard: `false`): Schaltet die Statuszeile unterhalb des Systems ein.
   * `showHints` (Standard: `false`): Schaltet die Tastaturlegende (im Footer oder bei `compact` als Spalte rechts) ein.
   * Alle Standard-Props von `<Notation />` (`clef`, `timeSignature`, `accidentals`, `scale`, `showRightBar`, etc.) werden direkt durchgereicht.

## 4. Tests & Qualitätssicherung
* **Unit-Tests (`tests/music-notation.test.mjs`):**
  * Testet `stepToPitchName`, `pitchNameToStep`, `stepToY`, `yToStep`, `moveStep`, `describeBuilderState` und `renderNotationBuilderSvg`.
* **Komponententests (`tests/components/notation-builder.test.ts`):**
  * Testet Tastatur-Navigation (`↑`/`↓`), Mausklick-Positionierung, Erstellen mit `Num 1`, Löschen mit `Entf`, State-Attribute und `notationbuilder:reset`.
* **Validierung:**
  * `npm run validate` (`biome check . && astro check && tsc --noEmit`)
  * `npm run test` (55 Vitest-Tests erfolgreich)
