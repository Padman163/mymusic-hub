# Handoff: Feature `NotationBuilder.astro` (`feat/notationbuilder`)

Dieser Handoff fasst Architektur, Verhalten, Props und Quiz-Einbindung des interaktiven Notations-Builders für zukünftige Übergaben zusammen. Er ist kein Nachweis eines aktuellen Testlaufs oder einer Übernahme nach `main`. Allgemeine Regeln stehen in der [Notationsreferenz](README_FEAT_NOTATION.md); der Abschlussprozess im [Workflow](../README_WORKFLOW.md).

## 1. Übersicht & Ziel
`NotationBuilder.astro` (`src/components/notation/NotationBuilder.astro`) ist eine interaktive Schicht über dem nativen SVG-Notationssystem. Nutzer können etwa in Quiz-Aufgaben oder Lernmodulen den Cursor per Maus oder Tastatur positionieren und Noten setzen oder per Tastatur löschen.

Standardmäßig entspricht das Aussehen einem reduzierten Einzeltakt ohne linken und ohne rechten Taktstrich (`showLeftBar={false}`, `showRightBar={false}`). Es gibt einen Notenslot mit Viertelnote als Standardwert: Ein Klick auf das System positioniert den Cursor, die Leertaste setzt die Note. Mit `compact={true}` schrumpft die Komponente auf eine kompakte Breite zusammen.

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
  * Frage 1 in "Teil 4: Notation in fünf Beispielen": 4 Viertelnoten setzen (`maxNotes={4}`, `lockDuration="quarter"`, `compact="wide"`, `showHints`). Notenwert ist auf Viertel fixiert (Num 1 blockiert), `Leertaste` platziert Note und springt zum nächsten Slot, `←`/`→` wechselt frei zwischen den 4 Positionen. Wenn keine explizite Oktave vorgegeben ist (z. B. "E" statt "E4"), sind alle Oktaven auf dem System (z. B. E4 und E5) gültig.
  * Frage 2 in "Teil 4: Notation in fünf Beispielen": Notenwert-Eingabe mit der visuellen Button-Leiste (`showDurationPicker`, `compact="tight"`, `showHints`) und "Antwort einloggen"-Button.
  * **Neue Aufgabe bei falscher Antwort mit Countdown-Timer (3 Versuche):** Ist eine Eingabe falsch, erscheint auf gleicher Linie neben dem "Antwort einloggen"-Button ein kompakter Zurücksetzen-Pfeil-Button mit einem Versuchs-Timer-Badge (beginnt bei 3 und zählt auf 2, 1 herunter). Ein Klick darauf zieht eine neue Aufgabe aus dem Fragenpool und setzt den Builder zurück. Nach 3 Fehlversuchen gilt die jeweilige Aufgabe endgültig als nicht bestanden (`data-correct="false"`), der Einloggen-Button wird deaktiviert und der Reset-Button ausgeblendet.
  * **Sperrung nach Abschluss:** Sobald eine Builder-Aufgabe erfolgreich gelöst wurde (oder nach 3 Fehlversuchen endgültig fehlgeschlagen ist), wird der Builder gesperrt (`data-locked="true"`), sodass keine Noten oder Notenwerte mehr verändert werden können, und die orangefarbene Notenmarkierung (`.notation-builder-cursor`) wird ausgeblendet.
  * Gesamtpunkte: `20`; bestanden ab `16` Punkten (80 %).
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
   * `←` (`ArrowLeft`) / `→` (`ArrowRight`): Wechselt bei `maxNotes > 1` horizontal zwischen den Notenslots (auch wenn der Zielslot noch leer ist).
   * `↑` (`ArrowUp`) / `↓` (`ArrowDown`): Verschiebt den Cursor schrittweise vertikal (`clampStep` hält ihn im Bereich `-2..10`).
   * `Leertaste`: Platziert an der aktuellen Cursor-Position eine Note mit dem aktiven Notenwert (`activeDuration`, Standard: `"quarter"`). Bei `maxNotes > 1` springt der Cursor automatisch zum nächsten Slot weiter.
   * `NUM 1` bzw. Taste `1`: Schaltet den Notenwert zyklisch durch (`Ganze` → `Halbe` → `Viertel` → `Achtel` → `16tel`). Wenn `lockDuration` gesetzt ist, ist diese Taste blockiert.
   * `Entf` (`Delete`) bzw. `Backspace`: Entfernt eine gesetzte Note im aktiven Slot wieder.
   * `Enter`: Loggt die Antwort ein (feuert `notationbuilder:submit` bzw. löst den Einloggen-Button aus).
3. **Props:**
   * `maxNotes` (Standard: `1`): Anzahl der Noten/Slots im Takt (z. B. `4` für vier Viertelnoten).
   * `lockDuration` (Standard: `undefined`): Fester Notenwert (z. B. `"quarter"` oder `true`), blockiert Num 1 und fixiert den Notenwert.
   * `initialStep` (Standard: `4` / Mittellinie).
   * `initialDuration` (Standard: `"quarter"`).
   * `allowedDurations` (Standard: alle 5 Notenwerte).
   * `showDurationPicker` (Standard: `false`): Schaltet die Button-Toolbar zur Notenwert-Auswahl ein.
   * `compact` (Standard: `false`): Kompakte Breite (`true` / `"tight"` = halbe Breite von wide mit 150px, `"wide"` = Standard-Notationslänge von 300px; beide Varianten standardmäßig ohne rechten Taktstrich).
   * `showRightBar` (Standard: `false`): Taktstrich rechts (standardmäßig aus; kann mit `showRightBar={true}` explizit aktiviert werden).
   * `showLabel` (Standard: `false`): Schaltet das Noten-/Aktions-Badge direkt am Cursor ein.
   * `showStatus` (Standard: `false`): Schaltet die Statuszeile unterhalb des Systems ein.
   * `showHints` (Standard: `false`): Schaltet die Tastaturlegende (im Footer oder bei `compact` als Spalte rechts) ein.
   * Gemeinsame Notations-Props wie `clef`, `timeSignature`, `accidentals`, `scale` und `showRightBar` stehen ebenfalls zur Verfügung. Die vollständige Builder-Prop-Liste steht in `NotationBuilder.astro`.

## 4. Tests & Qualitätssicherung
* **Unit-Tests (`tests/music-notation.test.mjs`):**
  * Testet `stepToPitchName`, `pitchNameToStep`, `stepToY`, `yToStep`, `moveStep`, `describeBuilderState` und `renderNotationBuilderSvg`.
* **Komponententests (`tests/components/notation-builder.test.ts`):**
  * Testet Tastatur-Navigation (`↑`/`↓`), Mausklick-Positionierung, Erstellen mit `Leertaste`, Notenwertwechsel mit `Num 1`, Löschen mit `Entf`, State-Attribute und `notationbuilder:reset`.
* **Validierung:**
  * `npm run validate` (`biome check . && astro check && tsc --noEmit`)
  * `npm test` und vor Feature-Abschluss `npm run preflight`; Voraussetzungen und Details: [Testing-Leitfaden](../README_TESTING.md).
