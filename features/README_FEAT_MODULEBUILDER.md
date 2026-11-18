# Der Modul-Builder & Interaktive Lernpfad (Etappen 1–3B) – Einfach erklärt

Dieses Dokument ist die Feature-Referenz für den **Admin Modul- & Aufgaben-Builder** und den **Interaktiven Lernpfad für Lernende**. Die Etappen 1 bis 3B beschreiben die umgesetzten Bausteine; Testbefehle und aktuelle Ergebnisse stehen im [Testing-Leitfaden](../README_TESTING.md).

---

## Das Grundprinzip: Erst das Fundament, dann die Oberfläche

Man kann sich dieses Feature wie den Bau eines Hauses vorstellen:
- **Etappe 1:** Das Fundament für die Prüfung, Bepunktung und Speicherung von Lerninhalten.
- **Etappe 2:** Die Eingabeformulare und Übersichtsseiten im bekannten Design des IssueTrackers.
- **Etappen 3A und 3B:** Fortschrittsverwaltung und sichtbare Lernoberfläche.

Warum machen wir das getrennt? Weil so jeder Baustein einzeln geprüft und getestet werden kann, ohne dass später Design-Fragen und Datensicherheit miteinander vermischt werden.

---

## Was genau wurde gebaut – und wozu dient es?

### 1. Die zentrale Punkte- und Themen-Liste (`src/lib/xp-tags.ts`)
- **Was es ist:** Eine einzige, zentrale Tabelle für alle Erfahrungspunkte (XP) und Themen-Etiketten (Tags).
- **Was darin steckt:**
  - **Standard-Punkte (Basis-XP):** Der Theorie-Basiswert beträgt **30 XP**, eine Praxisaufgabe **20 XP**, eine Lernpfad-Aufgabe **10 XP**, eine Quizfrage **15 XP** und eine Schnelltest-Frage („Fastlane“) **25 XP**.
  - **Themen-Etiketten mit Schwierigkeitsfaktor:** Zum Beispiel `Tonsystem` und `Vortragslehre` (je × 1,1), `Harmonielehre` (× 1,2) und `Notensystem` (× 1,5). Die vollständige Konfiguration steht in `src/lib/xp-tags.ts`.
  - **Automatische Berechnung:** Eine Aufgabe im Notensystem mit 10 Basis-XP zählt durch den Faktor 1,5 automatisch **15 XP**. Hat eine Aufgabe mehrere Themen-Etiketten, zählt standardmäßig der höchste Faktor.
- **Warum:** Wenn wir später entscheiden, dass das Notensystem oder Gitarren-Aufgaben mehr oder weniger Punkte geben sollen, muss das nur **an einer einzigen Stelle** angepasst werden – und nicht in Dutzenden Aufgaben einzeln.

---

### 2. Der gemeinsame Bauplan für Module & Aufgaben (`src/lib/module-schema.ts`)
- **Was es ist:** Eine verbindliche Vorlage, wie ein Lernmodul und eine Aufgabe aufgebaut sein müssen, damit alle Teile der Lernplattform dieselbe Sprache sprechen.
- **Was darin geregelt ist:**
  - **Lernmodule:** Haben Titel, Beschreibung, Reihenfolge, Bereich (`theory`, `instrument`, `production`, `band`), Level und optional eine Stufe (`D1`, `D2`, `D3`). `practiceBlocks` enthält die Praxisaufgaben; eine leere Liste bedeutet keinen Praxisteil. Das frühere `hasPractice`-Flag gehört nicht mehr zum aktuellen Modell. Die Bestehensgrenzen gelten übergreifend (Standard: **80 %** für das Quiz, **85 %** für den Schnelltest); gespeicherte Einstellungen können abweichen.
  - **Theorie-Bausteine:** Jedes Modul kann beliebig viele Textabschnitte mit optionalen visuellen Komponenten enthalten (z. B. Notenbilder, Klaviatur, Tonleiter-Muster oder anklickbares Griffbrett).
  - **Aufgaben (Fragen):** Unterstützt vier Aufgabentypen:
    1. **Single Choice:** Eine richtige Antwort auswählen.
    2. **Multi Select:** Mehrere richtige Antworten auswählen.
    3. **Zahleneingabe:** Einen Zahlenwert eingeben.
    4. **Interaktive Notenaufgabe:** Eine Aufgabe direkt für das interaktive Notensystem (`NotationBuilder`), inklusive Notenschlüssel (`treble`/`bass`), Taktart, Vorzeichen, erlaubten Notenwerten und den erwarteten Tönen oder Dauern.
  - **Drei Lern-Spuren:** `leicht` bezeichnet Lernpfad-Aufgaben mit genau einem zugeordneten Modul. Quizfragen für `mittel` (Quiz) und `schwer` (Fastlane) können keinem, einem oder mehreren Modulen zugeordnet sein. Ohne Zuordnung bleiben sie im wiederverwendbaren Fragenpool. Alte Werte (`exercise`, `quiz_easy`, `fastlane`) werden beim Normalisieren in die aktuellen Lernspuren überführt.
- **Warum:** Durch diesen festen Bauplan passen Aufgaben und Lernmodule später nahtlos in die Quizze, Übersichten und in den interaktiven Noteneditor – ohne Missverständnisse oder unvollständige Einträge.

---

### 3. Die Qualitäts- und Sicherheitskontrolle (`src/lib/module-store.ts`)
- **Was es ist:** Das Regelwerk, das alle Änderungen prüft und sauber verarbeitet, bevor etwas gespeichert wird.
- **Was es übernimmt:**
  - **Eingabe-Prüfung:** Lehnt unvollständige oder fehlerhafte Eingaben ab – zum Beispiel Module ohne Titel, ungültige Bestehensgrenzen (unter 0 % oder über 100 %), fehlerhafte Zusatzkonfigurationen oder Aufgaben, deren Ziel-Modul gar nicht existiert. Bei interaktiven Notenaufgaben wird außerdem geprüft, ob ein Notenschlüssel sowie mindestens eine erwartete Tonhöhe oder Notendauer hinterlegt ist.
  - **Quellenmarker entfernen:** Generierte Quellenverweise in eckigen Klammern werden aus Modul-, Block- und Aufgabentexten entfernt, bevor die Daten gespeichert werden.
  - **Sauberes Aufräumen (kaskadierendes Löschen):** Beim Löschen eines Moduls werden seine Lernpfad-Aufgaben (`leicht`) entfernt. Quizfragen (`mittel`/`schwer`) verlieren nur die Zuordnung zu diesem Modul; sie bleiben für andere Module oder im Pool erhalten.
  - **Modul-Zusammenfassung auf Knopfdruck:** Zählt Theorie- und Praxisblöcke, Aufgaben je Lern-Spur (`leicht`, `mittel`, `schwer`) und die gewichteten XP eines Moduls.
- **Warum:** Lernpfad-Aufgaben bleiben eindeutig zugeordnet; wiederverwendbare Quizfragen werden nicht versehentlich zusammen mit einem Modul gelöscht.

---

### 4. Der Aktenschrank und die sichere Speicher-Schnittstelle
- **Lokale Datendatei (`data/modules.json`):** Wird nur beim reinen Astro-Dev-Start verwendet und beim ersten Schreiben erzeugt. Beispieldaten für Tests stehen in `tests/fixtures/modules.ts`.
- **Schnittstelle zum Speichern und Laden (`netlify/functions/modules.ts`):**
  - Module und Aufgaben laden (`GET`), anlegen (`POST`), aktualisieren (`PUT`) und löschen (`DELETE`). Einrichtung, Initialisierung und Konfliktschutz stehen in der [Blob-Referenz](README_FEAT_NETLIFYBLOB.md).
  - **Größenbegrenzung:** Zu große Anfragen (über 500.000 Bytes) werden sofort abgewiesen.

---

### 5. Die automatische Prüfstrecke (`tests/module-builder.test.mjs`)
- **Was es ist:** Automatisierte Tests für die Grundlagen und die Speicher-Schnittstelle.
- **Was getestet wird:**
  - Stimmt die XP-Berechnung (inkl. Faktor 1,5 für `Notensystem`)?
  - Werden Module ohne Praxisblöcke korrekt akzeptiert und fehlerhafte Module abgewiesen?
  - Werden beim Löschen eines Moduls seine Lernpfad-Aufgaben entfernt und Quizfragen ohne diese Zuordnung erhalten?
  - Funktioniert die Prüfung für klassische Fragen und interaktive Notenaufgaben?
  - Rechnet die Modul-Zusammenfassung alle Blöcke, Spuren und XP korrekt zusammen?
  - Reagiert die Speicher-Schnittstelle `/api/modules` korrekt (inkl. Schutz bei gleichzeitigen Änderungen)?

---

## Etappe 2: Die sichtbare Autorenwerkbank im Browser

Auf das Fundament aus Etappe 1 haben wir jetzt die bedienbare Oberfläche gebaut. Sie ist im bekannten Design des IssueTrackers gehalten, damit alles in Mein Musik-Hub einheitlich aussieht und funktioniert. Zu finden ist sie in der linken Seitenleiste unter **Projektierung → Modul-Builder** (`src/content/docs/projektierung/modul-builder.mdx`).

Dort gibt es vier übersichtliche Reiter:

### 1. Reiter „Übersicht“ (`src/components/project/ModuleCatalogList.astro`)
- **Wozu er dient:** Deine zentrale Übersicht über alle bereits erstellten Module und ihre Aufgaben.
- **Was sie bietet:**
  - **Karten- oder Listenansicht:** Per Knopfdruck wechselst du zwischen ausführlichen Karten und einer kompakten Liste. Außerdem kannst du nach Bereich filtern und nach Reihenfolge oder Gesamt-XP sortieren.
  - **Automatische Modul-Bilanz:** Jede Karte zeigt sofort an, wie viele Theorie-Blöcke, Übungen, einfache Quizfragen, Fastlane-Fragen und Gesamt-XP im Modul stecken.
  - **Aufklappbare Aufgabenliste:** Unter jedem Modul lassen sich alle zugehörigen Fragen ausklappen und nach Lern-Spur filtern.
  - **Direktes Bearbeiten & Löschen:** Ein Klick auf den Stift eines Moduls öffnet seine eigene Detailseite; Quizfragen werden im Reiter „Quizfragen“ bearbeitet. Beim Löschen weist die Bestätigung auf das Entfernen der Lernpfad-Aufgaben und den Erhalt der Quizfragen ohne diese Modulzuordnung hin.
  - **Reihenfolge ändern:** In der Sortierung „Reihenfolge: 1 → N“ ohne Bereichsfilter verschieben die Pfeile ein Modul jeweils um eine Position. Die Reihenfolge wird dauerhaft gespeichert und gilt für den Lernpfad.

### 2. Reiter „Modul erstellen“ (`src/components/project/ModuleBuilderForm.astro`)
- **Wozu er dient:** Hier legst du neue Lernmodule an oder bearbeitest bestehende Module.
- **Was du einstellen kannst:**
  - **Grunddaten:** Die allgemeinen Informationen sind zunächst eingeklappt. Die eindeutige Modul-ID wird automatisch erstellt und beim Bearbeiten beibehalten. Neue Module werden automatisch hinter dem Modul mit der höchsten Reihenfolge eingefügt; beim Bearbeiten bleibt ihre Position erhalten. Einstellbar sind Titel, Kurzbeschreibung, Bereich (`Theorie`, `Instrument`, `Produktion`, `Band`), Level (`100` bis `500`) und optional die D-Stufe (`D1`, `D2`, `D3`).
  - **Themen-Etiketten als anklickbare Chips:** Zur Auswahl stehen Tags mit einem Punkte-Faktor über 1,0, z. B. `Notensystem (1.5x)`. Ohne ausgewählten Tag gilt Faktor 1,0. Bereits gespeicherte Tags mit Faktor 1,0 oder nicht mehr auswählbare Tags bleiben beim Bearbeiten erhalten.
  - **Praxisaufgaben:** Über die Blocktyp-Auswahl fügst du Praxisaufgaben mit Titel, Text, Basis-XP und Tags hinzu. Einen separaten Praxisteil-Schalter gibt es nicht; entscheidend sind die vorhandenen Praxisblöcke.
  - **Punkte:** Theorie-Basis-XP (Standard: `30`) dienen als Vorgabe für Blöcke ohne eigenen Wert. Die Bestehensgrenzen stehen in den übergreifenden Einstellungen.
  - **Gemeinsame Blockliste:** Lernpfad-Aufgaben werden direkt zwischen den Theorie- und Praxisblöcken erstellt, sortiert und gruppiert. Klappe eine Aufgabe auf, um ihren Typ (Einfachauswahl, Mehrfachauswahl, Zahleneingabe oder interaktive Notation), Aufgabenstellung, Erklärung, Basis-XP und Tags zu bearbeiten. Die Typfelder und die interaktive Notationsvorschau entsprechen denen im [Quizfragen-Editor](#3-reiter-quizfragen-srccomponentsprojectexercisebuilderformastro). **„Modul speichern“** bzw. **„Modul-Änderungen speichern“** sichert das Modul und alle neuen oder geänderten Lernpfad-Aufgaben gemeinsam. Quizfragen erscheinen nicht in der Blockliste.
  - **Dynamischer Theorie-Block-Editor:** Gespeicherte Lernabschnitte erscheinen als kompakte, aufklappbare Zeilen. Du kannst beliebig viele hinzufügen und per Pfeiltasten (`↑` / `↓`) neu sortieren. Theorieblöcke können eigene Basis-XP und Tags erhalten; ihre berechneten XP verwenden ausschließlich diese Tags. Ohne eigenen Basiswert gilt die Modulvorgabe. Das Textfeld unterstützt [Matheformeln mit KaTeX](#matheformeln-mit-katex) und Notationen direkt an der gewünschten Stelle:

    ```mdx
    Erklärung vor dem Notensystem.

    <Notation clef="treble" notes={[{ duration: "quarter", step: 2 }]} />

    Erklärung danach.
    ```

    Neben `<Notation />` und `<NotationKeyboard />` unterstützt der Theorie-Renderer auch `<DrumPattern />` mit den Props `steps`, `timeSignature`, `resolution`, `interactive`, `showVelocity`, `showTrackNote`, `useTrackColors`, `continuous`, `keepEmptyTracks`, `stepSize`, `stepLabels` und `patternData`. Die Props müssen statische Werte, Arrays oder Objekte sein; ausführbare JavaScript-Ausdrücke und Imports werden nicht unterstützt. Statische Zahlenoperationen wie `4 / 3` sind zulässig. Beispiel:

    ```mdx
    <DrumPattern
      steps={8}
      continuous={true}
      patternData={[{
        name: "Kick",
        note: "C1",
        color: "#ef4444",
        activeSteps: [0, 4],
        cellLabels: ["1", "", "", "", "3", "", "", ""],
        eventPositions: [1.5],
        eventLabels: ["+"],
      }]}
    />
    ```

    Statische Inline-SVGs in `<figure>` werden mit einer begrenzten Element- und Attributliste gerendert; Skripte, Event-Handler, Inline-CSS und externe SVG-Ressourcen sind nicht erlaubt. Alte getrennte Notations-Props werden beim Bearbeiten in den Text übernommen. Andere bereits gespeicherte Visualisierungen bleiben erhalten; eine Definition weiterer Komponententypen im Text wird nicht unterstützt.

#### Matheformeln mit KaTeX

Schreibe Formeln in LaTeX-Schreibweise direkt in den Markdown-Text eines Theorie- oder Praxisblocks. Im Builder steht der Quelltext; im Lektions-Player rendert KaTeX daraus die gesetzte Formel. Du brauchst weder eine LaTeX-Datei noch einen Import. Aufgabenstellungen, Hinweise und Antwortfelder werden dagegen als Klartext behandelt.

- **Im Fließtext:** Setze die Formel zwischen einzelne Dollarzeichen, z. B. `Der Kammerton $A_4$ hat eine Frequenz von $440\,\text{Hz}$.`
- **Als eigene, abgesetzte Formel:** Setze `$$` auf je eine eigene Zeile. Lass vor und nach dem Formelblock eine Leerzeile. Zum Kopieren in das Textfeld:

  ```markdown
  Eine Oktave höher verdoppelt sich die Frequenz.

  $$
  f_2 = 2 \cdot f_1 = 880\,\text{Hz}
  $$
  ```

| Schreibweise | Bedeutung |
| --- | --- |
| `$f_1$`, `$2^{12}$` | Tief- und Hochstellung; `{…}` fasst mehrere Zeichen zusammen. |
| `$\frac{3}{2}$` | Bruch, z. B. das Frequenzverhältnis einer reinen Quinte. |
| `$440\,\text{Hz}$` | Kleiner Abstand und aufrechte Einheit. |
| `$\sharp$`, `$\flat$`, `$\natural$` | Kreuz, Be und Auflösungszeichen im Text. |
| `$\fermata$` | Fermatenzeichen; der Lektions-Player unterstützt diesen Ausdruck als einzelnes Inline-Symbol. |

Die Code-Markierungen in diesen Beispielen dienen nur der Dokumentation: Im Builder schreibst du die Formeln **ohne Backticks und ohne Codeblock**. Wenn eine Formel als Text erscheint, prüfe zuerst die Dollarzeichen und die Klammern. KaTeX unterstützt viele, aber nicht alle LaTeX-Befehle; prüfe die Darstellung nach dem Speichern im Lektions-Player.

#### Modulblöcke & Gruppenverwaltung

- **Aufgabentitel:** Trage in einer Lernpfad-Aufgabe einen kurzen Titel getrennt von der Aufgabenstellung ein, z. B. „Kammerton“. Im eingeklappten Builder-Block und im Lektions-Player erscheint er als **„Aufgabe: Kammerton“**. Ohne eigenen Titel dient die Aufgabenstellung als Ersatz.

- **Erreichbare XP:** Eingeklappte Theorieblöcke, Praxisblöcke und Lernpfad-Aufgaben zeigen ein XP-Badge wie im Lektions-Player. Bei einer eingeklappten Gruppe zeigt das Badge die Summe ihrer Einträge. Änderungen an Basis-XP und Tags werden direkt berücksichtigt.
- **Hinweise für Lernpfad-Aufgaben:** In der aufgeklappten Aufgabe kannst du einen einfachen und einen stärkeren Hinweis hinterlegen. Beide sind optional und sollten helfen, ohne die Lösung zu verraten. Die separate Erklärung ist für die Auflösung nach drei Fehlversuchen gedacht.
- **Lektionsgruppen erstellen:** Markiere mehrere ungruppierte Theorieblöcke, Lernpfad- oder Praxisaufgaben über ihre Auswahlfelder und wähle **„Auswahl gruppieren“**. Die Einträge werden zu einer benannten Gruppe zusammengefasst; der Titel lässt sich im Gruppen-Header ändern.
- **Einzelne Einträge lösen:** Mit dem **`−`-Button („Aus Gruppe lösen“)** wird ein einzelner Eintrag aus der Gruppe genommen, ohne ihn zu löschen. Er erscheint direkt nach der Gruppe wieder als eigenständiger Eintrag. Bleibt nur ein Gruppeneintrag übrig, wird auch dieser automatisch ungruppiert.
- **Löschen und Auflösen:** Ungruppierte Einträge löschst du über **`×`**. Der **`−`-Button im Gruppen-Header** löst die gesamte Gruppe auf; die Einträge bleiben erhalten. Die Pfeile im Header verschieben die Gruppe als Einheit.
- **Automatische Lektionsnummerierung:** Der Lektions-Player nummeriert Abschnitte automatisch nach `Modul-Level + Position` (bei Level 100 z. B. `101`, `102`). Nummern gehören daher nicht als Präfix in die Blocktitel.

### 3. Reiter „Quizfragen“ (`src/components/project/ExerciseBuilderForm.astro`)
- **Wozu er dient:** Hier erstellst du wiederverwendbare Quiz- und Fastlane-Fragen und ordnest sie optional einem oder mehreren Modulen zu. Lernpfad-Aufgaben entstehen dagegen in der Modul-Blockliste.
- **Wie sich das Formular anpasst:**
  - Du wählst bei Bedarf zugehörige Module und die Lern-Spur **Mittel (Quiz)** oder **Schwer (Fastlane)**. Dabei passen sich die vorgeschlagenen Basis-XP automatisch an (`15` oder `25 XP`). Ohne Modulwahl bleibt die Frage im Pool.
  - Je nach gewähltem **Aufgabentyp** zeigt das Formular automatisch nur die passenden Eingabefelder:
    - **Eine oder mehrere richtige Antworten:** Eine flexible Liste von Antwortmöglichkeiten, in der du mit Klick die richtigen Lösungen markierst.
    - **Zahleneingabe:** Hinterlege die Antwort als Zahl (z. B. `880`) oder mit Einheit (z. B. `880 Hz`). Steht die Einheit ausdrücklich in der Frage (z. B. „in Hz“ in Klammern) oder ergibt sie sich eindeutig aus den hinterlegten Antworten, steht sie fest im Eingabefeld. Lernende geben dann nur die Zahl ein.
    - **Interaktive Notenaufgabe (`NotationBuilder`):** Einstellfelder für Notenschlüssel (Violin-/Bassschlüssel), optionale Taktart (z. B. `3/4`), Notenanzahl (`1` bis `8`), feste oder wählbare Notenwerte, kompakte/breite Darstellung, Tastatur-Hinweise sowie die erwarteten Töne oder Notenwerte.
  - **Direkte Live-Vorschau:** Bei interaktiven Notenaufgaben siehst du direkt unter den Einstellungen das echte interaktive Notensystem als Vorschau – und kannst sofort prüfen, wie die Aufgabe später für Lernende aussieht.
  - **Live-XP-Rechner:** Sobald du Basis-XP, Spur oder Themen-Etiketten änderst, rechnet das Formular sofort die gewichteten XP aus.

### 4. Reiter „Einstellungen“ (`src/components/project/QuizSettingsForm.astro`)

Hier werden die Bestehensgrenzen für Abschluss-Quiz und Fastlane für alle Module getrennt eingestellt. Eine tatsächliche Änderung nach Bestätigung setzt den gesamten Lernfortschritt einschließlich XP und Bestwerten beim nächsten Laden im jeweiligen Browser zurück; Quizze müssen erneut absolviert werden. Unverändertes Speichern löst keinen Reset aus.

### Gemeinsame Logik, Styling & UI-Tests
- **`src/lib/module-builder-ui.ts` & `src/styles/module-builder.css`:** Enthalten die gemeinsame Steuerungslogik für alle drei Werkzeuge sowie das passende Erscheinungsbild (inklusive dunklem Design-Modus), während die `.astro`-Dateien schlank bleiben. Beim Laden und Speichern prüft der Browser sicher auf JSON-Antworten (um HTML-Fehlerseiten sauber abzufangen) und nutzt automatisch `/api/modules` bzw. `/.netlify/functions/modules`.
- **`astro.config.mjs`:** Bindet den **Modul-Builder** unter *Projektierung → Modul-Builder* sowie den **Interaktiven Lernpfad & Dashboard** ganz oben unter *Audio & Musik → Musiktheorie* in die Seitenleiste ein und stellt zusätzlich einen lokalen Entwicklungs-Endpunkt für `npm run dev` bereit, sodass Änderungen lokal direkt in `data/modules.json` gespeichert werden.
- **`netlify/functions/modules.ts`:** Reagiert sowohl auf `/api/modules` als auch auf `/.netlify/functions/modules`.
- **`tests/components/module-builder-ui.test.ts`:** Oberflächentests prüfen unter anderem Theorie-Blöcke, NotationBuilder-Vorschau, Live-XP-Berechnung, Katalogfilter und die Behandlung von HTML-Fehlerantworten.

---

## Etappe 3A: Das Gehirn für Lernfortschritt & Erfahrungspunkte (`src/lib/learning-progress.ts`)

Damit Lernende sehen können, wie weit sie sind und welche Module noch gesperrt oder schon geschafft sind, braucht es ein verlässliches „Gedächtnis“ im Hintergrund – noch bevor bunte Knöpfe gezeichnet werden.

- **Speicherung im eigenen Browser (`localStorage`):** Der Lernstand wird lokal im Browser des Lernenden gespeichert (unter `mymusic_learning_progress_v1`). Es ist also kein Benutzerkonto oder Login nötig – und für den Seitenbau auf dem Server gibt es einen sicheren Ersatzspeicher, damit beim Erzeugen der Website nichts abstürzt.
- **Schrittweise Freischaltung:**
  - Modul 1 startet automatisch **freigeschaltet** mit dem ersten Abschnitt. Alle Folgemodule starten zunächst **gesperrt**.
  - Innerhalb eines Moduls folgen Theorieblöcke, Lernpfad-Aufgaben, Praxisblöcke und Gruppen der gespeicherten Reihenfolge aus dem Editor. Nicht in der Reihenfolge enthaltene Inhalte werden ergänzt. Danach folgt das Quiz. Erst nach dem Abschluss öffnet sich automatisch das nächste Modul.
  - Kommen später über den Modul-Builder neue Module im Katalog hinzu, werden sie automatisch einsortiert, ohne dass bereits verdiente XP oder erledigte Module verloren gehen.
- **Keine doppelten Punkte:** Das System merkt sich jede bereits gelöste Aufgabe und jeden erledigten Schritt. Wer eine Aufgabe zur Übung noch einmal löst, lernt zwar weiter, bekommt die XP aber fair nur beim ersten Mal gutgeschrieben.
- **Der „⚡ Fastlane“-Schnelltest:** Der schwere Fastlane-Modus kann über die Modul-URL mit `mode=fastlane` auch für gesperrte Folgemodule aufgerufen werden; die Fastlane-Links in Roadmap und Lektion sind derzeit ausgeblendet. Bei Erreichen der Bestehensgrenze (Standard: **85 %**) gilt das Modul als bestanden und das nächste wird freigeschaltet. Die XP noch offener Theorieblöcke und ungelöster Fragen werden einmalig gutgeschrieben. Unter der Grenze wird der persönliche Bestwert gespeichert, aber es gibt keine Punkte oder Freischaltung.
- **Theorie-XP:** Jeder abgeschlossene Theorieblock schreibt seine eigenen, anhand seiner Tags gewichteten XP einmalig gut. Beim Abschluss einer Gruppe werden die noch offenen Blöcke gemeinsam vergütet. Alte Blöcke ohne eigene Werte verwenden den Theorie-Basiswert des Moduls und zunächst keine Tags; bereits abgeschlossene Theorie bleibt abgeschlossen und wird nicht erneut vergütet. Ein Modul ohne Theorieblöcke wird ohne Theorie-XP übersprungen.
- **Level-System:** Alle **500 XP** steigt man automatisch ein Level höher (Level 1 ab 0 XP, Level 2 ab 500 XP usw.), inklusive Aufschlüsselung nach Lernbereichen und Themen-Etiketten.
- **Prüfstrecke (`tests/learning-progress.test.mjs`):** Tests prüfen diese Regeln, darunter Doppel-XP-Schutz, Fastlane, Dashboard-Kennzahlen und Speicherung.

---

## Etappe 3B: Die sichtbare Lern-Oberfläche im Browser

Jetzt verbinden sich die Bausteine aus Etappe 1 bis 3A zu einem kompletten, direkt im Browser spielbaren Kurs unter **Audio & Musik → Musiktheorie → Interaktiver Lernpfad & Dashboard** (`/audio/theory/lernpfad/`).

### 1. Initialer Modulkatalog
Ein neuer Katalog enthält keine Module oder Fragen. Bis eigene Quiz-Einstellungen gespeichert werden, gelten die Schema-Standardwerte: 80 % für das Quiz und 85 % für Fastlane. Bestehende Blob-Kataloge bleiben unverändert.

### 2. Das XP-Dashboard (`src/components/learning/ProgressDashboard.astro`)
- **Wozu es dient:** Zeigt dem Lernenden auf einen Blick das aktuelle **Level**, die **gesammelten Gesamt-XP**, den Fortschrittsbalken bis zum nächsten Level, die Anzahl **abgeschlossener Module** sowie kompakte Badges für XP nach Lernbereich (`Theorie`, `Instrument` …) und Themen (`Notensystem`, `Gitarre` …).
- **Live-Aktualisierung:** Sobald eine Aufgabe gelöst, Theorie abgeschlossen oder ein Quiz bestanden wird, aktualisiert sich das Dashboard sofort ohne Neuladen der Seite.
- **Modulkatalog:** Dashboard, Roadmap, Modulansicht und Aufgaben-Runner laden den aktuellen Katalog zur Laufzeit über `/api/modules`. Es wird keine Katalogdatei in den Build eingebettet. Ein leerer Katalog ist gültig; ein Ladefehler wird separat angezeigt. Notationsaufgaben werden aus der API-Konfiguration mit dem gemeinsamen Notations-Builder gerendert.
- **Geschützter Reset:** Neben „Quiz starten“ bzw. „Quiz wiederholen“ steht „Lernfortschritt zurücksetzen“. Erst nach Bestätigung werden der gesamte in diesem Browser gespeicherte Lernfortschritt und alle XP zurückgesetzt; der Modulkatalog bleibt unverändert.

### 3. Die Modul-Roadmap (`src/components/learning/ModuleRoadmap.astro`)
- **Wozu sie dient:** Zeigt alle Module in der richtigen Reihenfolge als übersichtliche Karten.
- **Fortschritt:** Die Karte zeigt Gesamtfortschritt sowie Balken für Theorie, Aufgaben und Quiz. Status-Badges und der Fastlane-Link sind derzeit ausgeblendet.
- **Aktionen:** **„Lektion öffnen“** führt zur Modulansicht; gesperrte Module zeigen dort einen Sperrhinweis. **„Quiz starten“** wird erst bei Quizbereitschaft aktiviert. Der geschützte Reset setzt den gesamten lokalen Lernfortschritt zurück.

### 4. Der Lektions-Parcours & Aufgaben-Runner (`ModuleStepper.astro` & `ModuleQuizRunner.astro`)
- **Geführter Schritt-für-Schritt-Aufbau (`/audio/theory/modul/?id=...`):**
  - **Ein Abschnitt nach dem anderen:** Eine Gruppe zählt als ein Schritt; ihre Untertitel brauchen keine Nummern. Mit **„Abschnitt gelesen“** werden die XP gutgeschrieben, ohne sie im Button anzuzeigen. Der Abschluss schaltet **„Weiter“** frei. Solange im aktuellen Abschnitt eine Lernpfad- oder Praxisaufgabe offen ist, sind **„Zurück“** und frühere Sidebar-Schritte gesperrt. Nach Erledigung oder nach drei Fehlversuchen bei einer Lernpfad-Aufgabe wird der Rückweg freigegeben. Beim erneuten Öffnen beginnt die Lektion beim ersten offenen Abschnitt. Bei älteren oder unvollständigen Reihenfolgen werden fehlende Blöcke und Übungen ergänzt. Das Dashboard bleibt auf der Lernpfadseite.
  - **Theorie und Übungen:** Theorie unterstützt Markdown und KaTeX (`$…$` im Text, `$$…$$` als abgesetzte Formel). `Notation` und `NotationKeyboard` lassen sich als selbstschließende Elemente im Theorietext einbetten; `FretboardClickable` und `ScalePattern` sind als separate Block-Visualisierungen verfügbar. Übungen bieten Multiple/Single Choice, Zahleneingabe (z. B. `880` oder `880 Hz`) und das interaktive Notensystem (`NotationBuilder.astro`). Nach dem ersten Fehlversuch wird nur die Zahl der verbleibenden Versuche angezeigt. Nach dem zweiten erscheint, sofern hinterlegt, der einfache Hinweis; den stärkeren Hinweis kannst du vor der letzten Antwort aufklappen. Erst nach dem dritten Fehlversuch erscheinen Lösung und Erklärung. Auch dann wird die Übung abgeschlossen und ihre XP werden einmalig gutgeschrieben. Leere Antworten zählen nicht als Versuch. Abschluss-Quiz und Fastlane bleiben unverändert.
  - **Praxis (optional):** Praxisaufgaben erscheinen an ihrer gespeicherten Position, einzeln oder in Gruppen. Sie werden jeweils bestätigt; das Quiz folgt erst nach den Inhaltsabschnitten.
  - **Abschluss-Quiz (`mittel`) & Fastlane-Modus (`?id=...&mode=fastlane`, `schwer`):** Führen Frage für Frage mit Fortschrittsbalken (`Frage X / Y`), XP-Bonus-Vorschau, konfigurierbarer Bestehensschwelle (Standard: `80 %` bzw. `85 %`) und automatischer Freischaltung des Folgemoduls durch die Prüfung.
- **UI-Tests (`tests/components/module-player-ui.test.ts`):** Prüfen unter anderem Startdaten, das Entsperren des Steppers und den Fastlane-Durchlauf mit Dashboard und Roadmap.

---

## Aktueller Stand

- **Umgesetzt (Etappen 1, 2, 3A & 3B):** Autorenwerkbank, Netlify-Blobs-Persistenz mit Astro-Dev-Fallback, Fortschritts-Engine und Lernoberfläche (`/audio/theory/lernpfad/` und `/audio/theory/modul/`).
- **Tests:** Feature-Tests liegen in `tests/learning-progress.test.mjs`, `tests/module-builder.test.mjs`, `tests/components/module-builder-ui.test.ts` und `tests/components/module-player-ui.test.ts`. Den aktuellen Stand mit `npm test` prüfen.

---

## Schnittstellen & Qualitätssicherung

### Datenmodell und Einbindung

`src/lib/module-schema.ts` definiert `LearningModule`, `TheoryBlock`, `PracticeBlock`, `ModuleQuestion`, `NotationBuilderTaskConfig` und `ModulesDatabase`. `contentOrder` speichert die gemeinsame Reihenfolge von Theorie, Lernpfad-Aufgaben und Praxis; `groupId` und `groupTitle` ermöglichen benannte Gruppen. Module enthalten außerdem Bereich, Level, Tags, XP-Werte sowie Theorie- und Praxisblöcke. Die Modul-Datenbank enthält die übergreifenden Quiz-Einstellungen. Aufgaben verwenden `moduleIds` und eine Lernspur (`leicht`, `mittel`, `schwer`): Lernpfad-Aufgaben benötigen genau ein Modul, Quizfragen erlauben null bis mehrere. Notationsaufgaben konfigurieren Notenschlüssel, Taktart, Vorzeichen, Notenwerte und erwartete Tonhöhen beziehungsweise Dauern.

Mit `prerequisiteModuleIds?: string[]` lassen sich Voraussetzungen unabhängig von Themen-Tags speichern, z. B. `["elementarlehre"]` für ein Gitarrenmodul, wenn das Grundlagenmodul diese ID hat. Eine leere Liste entfernt die Voraussetzungen; ein ausgelassenes Feld lässt sie bei Teiländerungen unverändert. Die Freischaltung wertet das Feld noch nicht aus.

Die drei Builder-Formulare unter `src/components/project/` werden in `src/content/docs/projektierung/modul-builder.mdx` eingebunden. `ModuleBuilderForm` akzeptiert zusätzlich `detail?: boolean` für die Modul-Detailseite. Der Lernpfad nutzt `ProgressDashboard`, `ModuleRoadmap`, `ModuleStepper` und `ModuleQuizRunner` unter `src/components/learning/`; die Seiten liegen unter `src/content/docs/audio/theory/`. Die Lernkomponenten akzeptieren:

| Komponente | Props |
|:---|:---|
| `ProgressDashboard` | `id?` |
| `ModuleRoadmap` | `id?`, `lessonBaseUrl?` |
| `ModuleStepper` | `id?`, `moduleId?`, `mode?: "normal" \| "fastlane"`, `lessonBaseUrl?` |
| `ModuleQuizRunner` | `id?`, `moduleId?`, `mode?: TargetLane`, `templatesOnly?` |

Die Netlify Function `netlify/functions/modules.ts` stellt die Modul-API bereit. In der Astro-Entwicklung ergänzt ein Vite-Plugin den lokalen Endpunkt, der `data/modules.json` verwendet. XP- und Validierungsregeln liegen in `src/lib/xp-tags.ts`, `src/lib/module-schema.ts` und `src/lib/module-store.ts`; UI-Logik und Styles liegen in `src/lib/module-builder-ui.ts`, `src/lib/module-player-ui.ts`, `src/styles/module-builder.css` und `src/styles/module-player.css`.

### Automatisierte Qualitätssicherung

Die fachlichen Regeln und die Builder-/Player-Interaktionen werden in den vier oben genannten Feature-Testdateien geprüft. Gezielt ausführen:

```bash
npx vitest run tests/learning-progress.test.mjs tests/module-builder.test.mjs tests/components/module-builder-ui.test.ts tests/components/module-player-ui.test.ts
```

`npm test` führt alle Vitest-Tests aus; das vollständige Projekt-Quality-Gate ist `npm run preflight`.
