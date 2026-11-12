# Entwickler-Handoff: MyMusic-Hub / Notation

## 1. Ziel & Tech-Stack
* **Projektziel:** Musiktheorie-Website mit konsistenten, responsiven Notationsschaubildern und Quizdarstellungen. Musikalische Zeichen und ihre Darstellungsregeln sollen zentral und wiederverwendbar sein.
* **Framework:** Astro `^7.4.5`, Starlight `^0.42.8`, TypeScript, Astro-Komponenten und MDX.
* **Typografie:** SVG-Notation mit Bravura-Schriftart (SMuFL-Standard).
* **Abgrenzung:** AlphaTab `^1.9.0` ist im Projekt vorhanden; der gemeinsame Notationsrenderer soll jedoch **ohne AlphaTab und MusicXML** funktionieren.
* **Umgebung:** Zuletzt lokal verwendet: Node.js 22.23.4 und npm 10.9.9 (beobachtete Versionen, keine Mindestanforderungen).

---

## 2. Aktueller Implementierungsstand & Feste Darstellungsregeln
* **Gemeinsame Engine:** Schaubilder und interaktive Quiz-Komponenten verwenden denselben Notationsrenderer (`src/lib/notation-renderer.ts`).
* **Implementierte Musikelemente:**
  * Notenschlüssel (G- und F-Schlüssel).
  * Tonart- und Einzelversetzungszeichen.
  * Taktarten.
  * Notenwerte und Pausenwerte (Ganze, Halbe, Viertel, Achtel, Sechzehntel).
  * Punktierte Notenwerte.
  * Balkengruppen.
  * Artikulationen (Staccato, Tenuto, Akzent, Marcato).
  * Halte- und Bindebögen.
  * Tempoangaben und Metronomzahlen.
  * Dynamikzeichen und Hairpins (Crescendo / Decrescendo).
  * Taktzahlen, Taktstriche und Wiederholungszeichen.
* **Pausen-Logik:** Pausen von ganzen bis Sechzehntelwerten können frei mit Noten gemischt werden. Eine einzelne ganze Taktpause bleibt immer horizontal zentriert im Takt.
* **Layout des 18-Takt-Abschlussbeispiels (`NotationOverview.astro`):**
  * Zunächst Zeilen mit zwei Takten, zuletzt Zeilen mit drei Takten; bei wenig Platz responsiver Umbruch auf einen Takt pro Zeile.
  * Erste Ereignisse sind systemübergreifend exakt vertikal ausgerichtet; Zeilenabstände sind einheitlich.
  * Das Beispiel darf auf keinen Fall horizontal scrollen.
* **Rhythmische Abstände & Spacing:**
  * Abstände sind proportional zu den angegebenen Noten- und Pausendauern, einschließlich Punktierungen.
  * Für Zeichenvergleiche gibt es das Attribut `spacing="equal"`.
* **Tonartvorzeichnung (Key Signature Logik):**
  * Die Tonartvorzeichnung wird über Zeilenumbrüche hinweg beibehalten und am Anfang jeder Zeile wiederholt.
  * Ein neues `accidentals`-Array setzt eine neue Vorzeichnung; ein leeres Array `[]` hebt sie auf.
  * Einzelne Notenvorzeichen verändern diesen Zeilenzustand nicht.
* **Verbindliche Reihenfolge am Systemanfang (Nutzervorgabe):**
  * **Notenschlüssel → Taktart → Vorzeichnung**.
  * Die Taktart steht im Beispiel nur am Anfang sowie bei Taktartwechseln.
  * *Hinweis:* Diese Reihenfolge weicht bewusst vom traditionellen Notensatz ab, ist aber die ausdrückliche Vorgabe für dieses Projekt.
* **Erfolgreich geprüfter Zustand:**
  * 20 Unit-Tests in `tests/music-notation.test.mjs` erfolgreich.
  * TypeScript-Typecheck (`tsc --noEmit`) und Produktions-Build (`npm run build`) fehlerfrei.
  * Browserprüfung des 18-Takt-Beispiels bei 320 px, 700 px und 1280 px: korrekte Reihenfolge, Taktarten in Takten 1, 9, 13 und 16, Vorzeichnung an jedem Zeilenbeginn und kein horizontaler Seitenüberlauf.
* **Bekannte Build-Warnungen (unkritisch):**
  * Große Chunks.
  * Leere i18n- und fehlende 404-Einträge.
  * Fehlende `site`-Konfiguration in `astro.config.mjs` für Sitemap-Generierung.
* **Git-Zustand:** Der Arbeitsbaum war zum Zeitpunkt der Erstellung sauber.

---

## 3. Dateistruktur & Kernkomponenten
* `src/lib/notation-renderer.ts`: Gemeinsamer SVG-Renderer und zentrale Geometrieberechnung (Reihenfolge, Platzbedarf von Schlüssel, Taktart, Vorzeichnung und Wiederholung).
* `src/components/notation/NotationVisual.astro`: Wiederverwendbarer Astro-Wrapper für den Renderer.
* `src/lib/system-layout.ts`: Systemaufteilung, Umbrüche, Wiederholung von Schlüssel und Vorzeichnung, Tonartwechsel und Ausrichtung erster Ereignisse.
* `src/components/notation/NotationOverview.astro`: Taktdaten und Anordnung des 18-Takt-Abschlussbeispiels; komponiert vorhandene Bausteine.
* `src/components/notation/NotationNoteRestValues.astro`: Vergleich von Noten- und Pausenwerten.
* `src/components/notation/Notation*.astro`: Weitere thematische Schaubilder (Artikulation, Dynamik, Bögen, Tempo, Taktarten, Vorzeichen).
* `src/components/music/`: Gemeinsame musikalische Bausteine (`rhythm.ts`, `rest.ts`, `articulation.ts`, `curve.ts`, `barline.ts`, `time-signature.ts`, `tempo.ts`, `dynamics.ts`) sowie UI-Bausteine (`DynamicsMarks.astro`, `TempoHeading.astro`, `TempoLabel.astro`, `MeasureNumber.astro`, `RepeatMark.astro`, `FinalBar.astro`).
* `src/components/Level100Quiz.astro`: Nutzt `renderNotationSvg` clientseitig für interaktive Fragen.
* `src/styles/notation.css`, `src/styles/music.css`: Zentrale Stile und Notationstypografie.
* `src/content/docs/audio/referenzen-werkzeuge/visualisierungen-erklaert/notensystem.mdx`: Dokumentation, Schaubilder, Abschlussbeispiel und Bausteinzuordnung.
* `tests/music-notation.test.mjs`: Gezielte Testsuite für Renderer, Zeichenregeln und Systemlayout.

---

## 4. Offene Punkte & Nächste Schritte
* Es liegt derzeit kein neuer Render-Implementierungsauftrag vor; auf die nächste konkrete Nutzeranforderung warten.
* **Gould-Layout-Klärung:** Falls künftig eine lesbarkeitsorientierte statt streng proportionaler Verteilung gewünscht wird, müssen Anforderungen und Quellen zunächst geklärt werden; keine unbelegte Formel als Gould-Regel darstellen.
* **Anbindung:** Vorbereitung der Komponenten-Schnittstelle für die geplante interaktive Komponente `<InteractiveScoreTrainer.astro>` in Level 104.
