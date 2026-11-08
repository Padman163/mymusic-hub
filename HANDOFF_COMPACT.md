# Entwickler-Handoff: MyMusic-Hub / Notation

## 1. Ziel & Tech-Stack

Musiktheorie-Website mit konsistenten, responsiven Notationsschaubildern und Quizdarstellungen. Musikalische Zeichen und ihre Darstellungsregeln sollen zentral und wiederverwendbar sein.

- Astro ^7.4.5, Starlight ^0.42.8, TypeScript, Astro-Komponenten und MDX.
- SVG-Notation mit Bravura-Schrift.
- AlphaTab ^1.9.0 ist im Projekt vorhanden; der gemeinsame Notationsrenderer soll jedoch **ohne AlphaTab und MusicXML** funktionieren.
- Zuletzt lokal verwendet: Node.js 22.23.4 und npm 10.9.9. Das sind beobachtete Versionen, keine festgestellten Mindestanforderungen.

## 2. Aktueller Stand

- Schaubilder und Quiz verwenden denselben Notationsrenderer.
- Vorhanden sind u. a. Schlüssel, Tonart- und Einzelvorzeichen, Taktarten, Notenwerte, Punktierung, Balken, Pausen, Artikulationen, Halte- und Bindebögen, Tempo, Dynamik, Taktzahlen und Wiederholungszeichen.
- Pausen von ganzen bis Sechzehntelwerten können mit Noten gemischt werden. Eine einzelne ganze Taktpause bleibt mittig.
- Das Abschlussbeispiel umfasst 18 Takte: zunächst Zeilen mit zwei Takten, zuletzt Zeilen mit drei Takten; bei wenig Platz ein Takt pro Zeile.
- Erste Ereignisse sind systemübergreifend ausgerichtet; Zeilenabstände sind einheitlich. Das Beispiel soll nicht horizontal scrollen.
- Rhythmische Abstände sind derzeit proportional zu den angegebenen Noten- und Pausendauern, einschließlich Punktierungen. Für Zeichenvergleiche gibt es `spacing="equal"`.
- Die Tonartvorzeichnung wird über Zeilenumbrüche hinweg beibehalten und am Anfang jeder Zeile wiederholt. Ein neues `accidentals`-Array setzt eine neue Vorzeichnung; `[]` hebt sie auf. Einzelne Notenvorzeichen ändern diesen Zustand nicht.
- **Zuletzt ausdrücklich gewünschte Reihenfolge:** Notenschlüssel → Taktart → Vorzeichnung. Die Taktart steht im Beispiel nur am Anfang und bei Wechseln. Diese Reihenfolge weicht vom üblichen Notensatz ab, ist aber die aktuelle Nutzervorgabe.
- Zuletzt erfolgreich geprüft: 20 Notationstests, TypeScript und Produktions-Build. Browserprüfung des Abschlussbeispiels bei 320, 700 und 1280 px: korrekte Reihenfolge, Taktarten in Takten 1, 9, 13 und 16, Vorzeichnung an jedem Zeilenbeginn und kein horizontaler Seitenüberlauf.
- Bestehende Buildwarnungen: große Chunks, leere i18n-/fehlende 404-Einträge und fehlende `site`-Konfiguration für Sitemap.
- Der Git-Arbeitsbaum war zum Zeitpunkt dieses Handoffs sauber; vor Änderungen erneut prüfen.

## 3. Dateistruktur & Kernkomponenten

- `src/lib/notation-renderer.ts`: gemeinsamer SVG-Renderer und zentrale Geometrie, u. a. Reihenfolge und Platzbedarf von Schlüssel, Taktart, Vorzeichnung und Wiederholung.
- `src/components/notation/NotationVisual.astro`: wiederverwendbarer Astro-Wrapper für den Renderer.
- `src/components/notation/system-layout.ts`: Systemaufteilung, Wiederholung von Schlüssel und Vorzeichnung, Tonartwechsel und Ausrichtung erster Ereignisse.
- `src/components/notation/NotationOverview.astro`: Taktdaten und Anordnung des 18-Takt-Abschlussbeispiels; komponiert vorhandene Bausteine.
- `src/components/notation/NotationNoteRestValues.astro`: Vergleich von Noten- und Pausenwerten.
- `src/components/notation/Notation*.astro`: weitere thematische Schaubilder, z. B. für Artikulation, Dynamik, Bögen, Tempo und Taktarten.
- `src/components/music/`: gemeinsame musikalische Bausteine, insbesondere `rhythm.ts`, `rest.ts`, `articulation.ts`, `curve.ts`, `barline.ts`, `time-signature.ts`, `tempo.ts` und `dynamics.ts` sowie Astro-Bausteine für Dynamik, Tempo, Taktzahl und Schlussstrich.
- `src/components/Level100Quiz.astro`: nutzt `renderNotationSvg` auch clientseitig.
- `src/styles/notation.css`, `src/styles/music.css`: zentrale Styles und gemeinsame Notationstypografie.
- `src/content/docs/audio/referenzen-werkzeuge/visualisierungen-erklaert/notensystem.mdx`: Dokumentation, Schaubilder, Abschlussbeispiel und Zuordnung der Zeichen zu Bausteinen.
- `tests/music-notation.test.mjs`: gezielte Tests für Renderer, Regeln und Systemlayout.

## 4. Entscheidungen & verworfene Ansätze

- Keine Zeichen in Übersichten oder Quiz separat nachzeichnen: bestehende Bausteine und den gemeinsamen Renderer verwenden; neue Zeichen und Positionierungsregeln zentral ergänzen.
- Keine komponentenspezifischen Sonderregeln für gemeinsam verwendete Notationszeichen und Typografie.
- Keine horizontal scrollbar machenden Notationsschaubilder als Lösung für Platzprobleme.
- Einzelne Notenvorzeichen nicht mit der über Zeilen gültigen Tonartvorzeichnung verwechseln.
- Taktart und Vorzeichnung nicht wieder in die übliche Reihenfolge zurückstellen, solange der Nutzer die aktuelle Reihenfolge nicht ändert.
- Proportionale Rhythmusverteilung nicht als Umsetzung nach Elaine Gould ausgeben: Das wurde diskutiert, aber keine exakte Gould-Regel verifiziert oder implementiert.
- Bereits bekannte Einschränkung: Streng proportionale Verteilung kann in dichten Takten bei schmalen Ansichten zu engen Abständen oder Überlappungen führen; ein vollständiges optisches Collision-Layout existiert nicht.
- Optische Änderungen zentral vornehmen und zusätzlich im Browser bei breiten und schmalen Ansichten prüfen.

## 5. Offene To-dos / nächster Schritt

Es liegt derzeit kein neuer Implementierungsauftrag vor. Auf die nächste konkrete Nutzeranforderung warten.

Falls künftig eine lesbarkeitsorientierte statt streng proportionaler Verteilung gewünscht wird: Anforderungen und Quellen zunächst klären; keine unbelegte Formel als Gould-Regel darstellen.

Relevante Prüfkommandos:
- `node --test tests\music-notation.test.mjs`
- `npx --yes --package typescript tsc --noEmit`
- `npm run build`
- `git diff --check`