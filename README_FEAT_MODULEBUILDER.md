# Der Modul-Builder & Interaktive Lernpfad (Etappen 1–3B) – Einfach erklärt

Dieses Dokument erklärt ohne Programmier-Fachchinesisch, **was** wir in allen Etappen (Etappe 1 bis Etappe 3B) für den **Admin Modul- & Aufgaben-Builder** sowie den **Interaktiven Lernpfad für Lernende** aufgebaut haben und **warum** jeder Baustein wichtig ist.

---

## Das Grundprinzip: Erst das Fundament, dann die Oberfläche

Man kann sich dieses Feature wie den Bau eines Hauses vorstellen:
- **Etappe 1 (jetzt erledigt):** Das Fundament, die Stromleitungen, die Wasserrohre und die Hausordnung. Man sieht im Browser noch keine neuen Formulare, aber im Hintergrund ist alles vorbereitet, damit Lerninhalte später sicher erstellt, geprüft, bepunktet und gespeichert werden können.
- **Etappe 2 (als Nächstes):** Die sichtbaren Räume und Schalter – also die Eingabeformulare und Übersichtsseiten im bekannten Design des IssueTrackers.

Warum machen wir das getrennt? Weil so jeder Baustein einzeln geprüft und getestet werden kann, ohne dass später Design-Fragen und Datensicherheit miteinander vermischt werden.

---

## Was genau wurde gebaut – und wozu dient es?

### 1. Die zentrale Punkte- und Themen-Liste (`src/lib/xp-tags.ts`)
- **Was es ist:** Eine einzige, zentrale Tabelle für alle Erfahrungspunkte (XP) und Themen-Etiketten (Tags).
- **Was darin steckt:**
  - **Standard-Punkte (Basis-XP):** Ein Theorie-Block bringt standardmäßig **30 XP**, eine Übungsaufgabe **10 XP**, eine leichte Quizfrage **15 XP** und eine Schnelltest-Frage („Fastlane“) **25 XP**.
  - **Themen-Etiketten mit Schwierigkeitsfaktor:** Themen wie `Allgemein` (× 1,0), `Violinschlüssel` (× 1,0), `Tabulatur` (× 1,0), `Bassschlüssel` (× 1,1), `Gitarre` (× 1,2), `Rhythmus` (× 1,2) und `Notensystem` (× 1,5).
  - **Automatische Berechnung:** Eine Aufgabe im Notensystem mit 10 Basis-XP zählt durch den Faktor 1,5 automatisch **15 XP**. Hat eine Aufgabe mehrere Themen-Etiketten, zählt standardmäßig der höchste Faktor.
- **Warum:** Wenn wir später entscheiden, dass das Notensystem oder Gitarren-Aufgaben mehr oder weniger Punkte geben sollen, muss das nur **an einer einzigen Stelle** angepasst werden – und nicht in Dutzenden Aufgaben einzeln.

---

### 2. Der gemeinsame Bauplan für Module & Aufgaben (`src/lib/module-schema.ts`)
- **Was es ist:** Eine verbindliche Vorlage, wie ein Lernmodul und eine Aufgabe aufgebaut sein müssen, damit alle Teile der Lernplattform dieselbe Sprache sprechen.
- **Was darin geregelt ist:**
  - **Lernmodule:** Haben Titel, Beschreibung, Reihenfolge, Bereich (`theory`, `instrument`, `production`, `band`), Level und optional eine Stufe (`D1`, `D2`, `D3`). Reine Theorie-Module können über `hasPractice: false` klar von Modulen mit Praxis-Anteil getrennt werden. Zudem werden Bestehensgrenzen festgelegt (Standard: **80 %** für das einfache Quiz, **85 %** für den Schnelltest).
  - **Theorie-Bausteine:** Jedes Modul kann beliebig viele Textabschnitte mit optionalen visuellen Komponenten enthalten (z. B. Notenbilder, Klaviatur, Tonleiter-Muster oder anklickbares Griffbrett).
  - **Aufgaben (Fragen):** Unterstützt vier Aufgabentypen:
    1. **Single Choice:** Eine richtige Antwort auswählen.
    2. **Multi Select:** Mehrere richtige Antworten auswählen.
    3. **Zahleneingabe:** Einen Zahlenwert eingeben.
    4. **Interaktive Notenaufgabe:** Eine Aufgabe direkt für das interaktive Notensystem (`NotationBuilder`), inklusive Notenschlüssel (`treble`/`bass`), Taktart, Vorzeichen, erlaubten Notenwerten und den erwarteten Tönen oder Dauern.
  - **Drei Lern-Spuren:** Jede Aufgabe gehört klar zu `exercise` (Übung), `quiz_easy` (leichtes Quiz) oder `fastlane` (Schnelltest).
- **Warum:** Durch diesen festen Bauplan passen Aufgaben und Lernmodule später nahtlos in die Quizze, Übersichten und in den interaktiven Noteneditor – ohne Missverständnisse oder unvollständige Einträge.

---

### 3. Die Qualitäts- und Sicherheitskontrolle (`src/lib/module-store.ts`)
- **Was es ist:** Das Regelwerk, das alle Änderungen prüft und sauber verarbeitet, bevor etwas gespeichert wird.
- **Was es übernimmt:**
  - **Eingabe-Prüfung:** Lehnt unvollständige oder fehlerhafte Eingaben ab – zum Beispiel Module ohne Titel, ungültige Bestehensgrenzen (unter 0 % oder über 100 %), fehlerhafte Zusatzkonfigurationen oder Aufgaben, deren Ziel-Modul gar nicht existiert. Bei interaktiven Notenaufgaben wird außerdem geprüft, ob ein Notenschlüssel sowie mindestens eine erwartete Tonhöhe oder Notendauer hinterlegt ist.
  - **Sauberes Aufräumen (kaskadierendes Löschen):** Wird ein komplettes Lernmodul gelöscht, entfernt das System automatisch auch alle zugehörigen Aufgaben dieses Moduls. Aufgaben anderer Module bleiben unberührt.
  - **Modul-Zusammenfassung auf Knopfdruck:** Zählt automatisch zusammen, wie viele Theorie-Blöcke und wie viele Aufgaben je Lern-Spur (`exercise`, `quiz_easy`, `fastlane`) vorhanden sind und wie viele gewichtete XP ein Modul insgesamt bietet.
- **Warum:** So können beim Bearbeiten keine „Geister-Aufgaben“ ohne Modul übrig bleiben und keine fehlerhaften Lerninhalte die Plattform kaputtmachen.

---

### 4. Der Aktenschrank und die sichere Speicher-Schnittstelle
- **Leere Datendatei (`data/modules.json`):** Der zentrale Speicherort für alle künftigen Lernmodule und Aufgaben (zum Start bewusst leer angelegt).
- **Schnittstelle zum Speichern und Laden (`netlify/functions/modules.ts`):**
  - Eine kleine Server-Funktion unter `/api/modules`, über die Module und Aufgaben geladen (`GET`), neu angelegt (`POST`), aktualisiert (`PUT`) und gelöscht (`DELETE`) werden können – direkt in der Projekt-Datei auf GitHub, genau nach demselben Sicherheitsmuster wie beim bestehenden IssueTracker.
  - **Schutz bei gleichzeitigem Bearbeiten:** Wenn zwei Personen fast zeitgleich speichern, bemerkt die Schnittstelle den Konflikt und wiederholt den Speichervorgang automatisch bis zu dreimal sauber, statt Änderungen von anderen versehentlich zu überschreiben.
  - **Größenbegrenzung:** Zu große Anfragen (über 500.000 Bytes) werden sofort abgewiesen.
- **Schutz vor unnötigen Website-Neubauten (`netlify.toml`):**
  - **Was geändert wurde:** Die Bau-Regel wurde von „nur `data/contributions.json` ignorieren“ auf „den gesamten Ordner `data/**` ignorieren“ erweitert.
  - **Warum:** Wenn Redakteure später neue Module oder Aufgaben in `data/modules.json` speichern, muss Netlify nicht jedes Mal die komplette statische Website neu bauen und veröffentlichen – das spart Bauzeit und Server-Kontingent.

---

### 5. Die automatische Prüfstrecke (`tests/module-builder.test.mjs`)
- **Was es ist:** 8 automatisierte Tests, die unsere neuen Bausteine per Knopfdruck auf Herz und Nieren prüfen.
- **Was getestet wird:**
  - Stimmt die XP-Berechnung (inkl. Faktor 1,5 für `Notensystem`)?
  - Werden reine Theorie-Module (`hasPractice: false`) korrekt akzeptiert und fehlerhafte Module abgewiesen?
  - Werden beim Löschen eines Moduls wirklich nur die dazugehörigen Fragen mitgelöscht?
  - Funktioniert die Prüfung für klassische Fragen und interaktive Notenaufgaben?
  - Rechnet die Modul-Zusammenfassung alle Blöcke, Spuren und XP korrekt zusammen?
  - Reagiert die Speicher-Schnittstelle `/api/modules` korrekt (inkl. Schutz bei gleichzeitigen Änderungen)?

---

## Etappe 2: Die sichtbare Autorenwerkbank im Browser

Auf das Fundament aus Etappe 1 haben wir jetzt die bedienbare Oberfläche gebaut. Sie ist im bekannten Design des IssueTrackers gehalten, damit alles in Mein Musik-Hub einheitlich aussieht und funktioniert. Zu finden ist sie in der linken Seitenleiste unter **Projektierung → Modul-Builder** (`src/content/docs/projektierung/modul-builder.mdx`).

Dort gibt es drei übersichtliche Reiter (Tabs):

### 1. Reiter „1. Modul-Builder (Theorie)“ (`src/components/project/ModuleBuilderForm.astro`)
- **Wozu er dient:** Hier legst du neue Lernmodule an oder bearbeitest bestehende Module.
- **Was du einstellen kannst:**
  - **Grunddaten:** Eindeutige ID (z. B. `theory-101`), Reihenfolge (`1, 2, 3 …`), Titel, Kurzbeschreibung, Bereich (`Theorie`, `Instrument`, `Produktion`, `Band`), Level (`100` bis `500`) und optional die D-Stufe (`D1`, `D2`, `D3`).
  - **Themen-Etiketten als anklickbare Chips:** Zeigen direkt den jeweiligen Punkte-Faktor an (z. B. `Notensystem (1.5x)` oder `Allgemein (1.0x)`).
  - **Praxisteil-Schalter:** Über ein Häkchen legst du fest, ob das Modul einen Praxisteil hat – bei reinen Theorie-Modulen bleibt der Haken einfach aus.
  - **Punkte & Bestehensgrenzen:** Basis-XP pro Theorie-Block (Standard: `30`) sowie die nötigen Prozentwerte für das einfache Quiz (`80 %`) und den Fastlane-Test (`85 %`).
  - **Dynamischer Theorie-Block-Editor:** Du kannst beliebig viele Lernabschnitte hinzufügen, per Pfeiltasten (`↑` / `↓`) neu sortieren oder wieder entfernen. Jeder Block hat einen Titel, ein Textfeld mit Hinweis auf mathematische KaTeX-Formeln (`$...$` / `$$...$$`) sowie die Möglichkeit, eine visuelle Komponente (wie Notensystem, Klaviatur oder Griffbrett) mit passenden Einstellungen anzuhängen.

### 2. Reiter „2. Aufgaben- & Quiz-Builder“ (`src/components/project/ExerciseBuilderForm.astro`)
- **Wozu er dient:** Hier erstellst du Übungs- und Prüfungsfragen und ordnest sie direkt einem bestehenden Modul zu.
- **Wie sich das Formular anpasst:**
  - Du wählst das Ziel-Modul und die gewünschte Lern-Spur: normale **Übung**, **Abschluss-Quiz Einfach** oder schwerer **Fastlane-Test**. Dabei passen sich die vorgeschlagenen Basis-XP automatisch an (`10`, `15` oder `25 XP`).
  - Je nach gewähltem **Aufgabentyp** zeigt das Formular automatisch nur die passenden Eingabefelder:
    - **Single Choice / Multi Select:** Eine flexible Liste von Antwortmöglichkeiten, in der du mit Klick markierst, welche Lösung(en) richtig sind.
    - **Zahleneingabe:** Ein Feld für die exakte Antwort (z. B. `880` oder `880 Hz`).
    - **Interaktive Notenaufgabe (`NotationBuilder`):** Einstellfelder für Notenschlüssel (Violin-/Bassschlüssel), Notenanzahl (`1` bis `8`), feste oder wählbare Notenwerte, kompakte/breite Darstellung, Tastatur-Hinweise sowie die erwarteten Töne oder Notenwerte.
  - **Direkte Live-Vorschau:** Bei interaktiven Notenaufgaben siehst du direkt unter den Einstellungen das echte interaktive Notensystem als Vorschau – und kannst sofort prüfen, wie die Aufgabe später für Lernende aussieht.
  - **Live-XP-Rechner:** Sobald du Basis-XP, Spur oder Themen-Etiketten änderst, rechnet das Formular sofort aus, wie viele Erfahrungspunkte die Aufgabe am Ende bringt (z. B. `10 Basis-XP` × `1,5` für `Notensystem` = **15 XP**).

### 3. Reiter „3. Modul-Katalog & Übersicht“ (`src/components/project/ModuleCatalogList.astro`)
- **Wozu er dient:** Deine zentrale Übersicht über alle bereits erstellten Module und ihre Aufgaben.
- **Was sie bietet:**
  - **Karten- oder Listenansicht:** Per Knopfdruck wechselst du zwischen ausführlichen Karten und einer kompakten Liste. Außerdem kannst du nach Bereich filtern und nach Reihenfolge oder Gesamt-XP sortieren.
  - **Automatische Modul-Bilanz:** Jede Karte zeigt sofort an, wie viele Theorie-Blöcke, Übungen, einfache Quizfragen, Fastlane-Fragen und Gesamt-XP im Modul stecken.
  - **Aufklappbare Aufgabenliste:** Unter jedem Modul lassen sich alle zugehörigen Fragen ausklappen und nach Lern-Spur filtern.
  - **Direktes Bearbeiten & Löschen:** Ein Klick auf den Stift bei einem Modul oder einer Frage lädt den Eintrag direkt in den passenden Builder-Reiter. Beim Löschen eines Moduls erinnert eine Sicherheitsabfrage daran, dass alle dazugehörigen Aufgaben mitgelöscht werden.

### 4. Gemeinsame Logik, Styling & UI-Tests
- **`src/lib/module-builder-ui.ts` & `src/styles/module-builder.css`:** Enthalten die gemeinsame Steuerungslogik für alle drei Werkzeuge sowie das passende Erscheinungsbild (inklusive dunklem Design-Modus), während die `.astro`-Dateien schlank bleiben. Beim Laden und Speichern prüft der Browser sicher auf JSON-Antworten (um HTML-Fehlerseiten sauber abzufangen) und nutzt automatisch `/api/modules` bzw. `/.netlify/functions/modules`.
- **`astro.config.mjs`:** Bindet den **Modul-Builder** unter *Projektierung → Modul-Builder* sowie den **Interaktiven Lernpfad & Dashboard** ganz oben unter *Audio & Musik → Musiktheorie* in die Seitenleiste ein und stellt zusätzlich einen lokalen Entwicklungs-Endpunkt für `npm run dev` bereit, sodass Änderungen lokal direkt in `data/modules.json` gespeichert werden.
- **`netlify/functions/modules.ts`:** Reagiert sowohl auf `/api/modules` als auch auf `/.netlify/functions/modules`.
- **`tests/components/module-builder-ui.test.ts`:** 5 automatisierte Oberflächentests prüfen das Hinzufügen/Umsortieren/Entfernen von Theorie-Blöcken, das Einblenden der `NotationBuilder`-Felder samt Live-Vorschau, die Live-XP-Berechnung, die Filterung im Modul-Katalog sowie die sichere Behandlung von HTML-Fehlerantworten.

---

## Etappe 3A: Das Gehirn für Lernfortschritt & Erfahrungspunkte (`src/lib/learning-progress.ts`)

Damit Lernende sehen können, wie weit sie sind und welche Module noch gesperrt oder schon geschafft sind, braucht es ein verlässliches „Gedächtnis“ im Hintergrund – noch bevor bunte Knöpfe gezeichnet werden.

- **Speicherung im eigenen Browser (`localStorage`):** Der Lernstand wird lokal im Browser des Lernenden gespeichert (unter `mymusic_learning_progress_v1`). Es ist also kein Benutzerkonto oder Login nötig – und für den Seitenbau auf dem Server gibt es einen sicheren Ersatzspeicher, damit beim Erzeugen der Website nichts abstürzt.
- **Schrittweise Freischaltung:**
  - Modul 1 startet automatisch **freigeschaltet** mit Schritt 1 (*Theorie*). Alle Folgemodule starten zunächst **gesperrt**.
  - Innerhalb eines Moduls geht es der Reihe nach voran: **1. Theorie** → **2. Aufgaben** → **3. Praxis** *(nur wenn das Modul einen Praxisteil hat)* → **Abschluss-Quiz Einfach**. Erst danach öffnet sich automatisch das nächste Modul.
  - Kommen später über den Modul-Builder neue Module in `data/modules.json` hinzu, werden sie automatisch einsortiert, ohne dass bereits verdiente XP oder erledigte Module verloren gehen.
- **Keine doppelten Punkte:** Das System merkt sich jede bereits gelöste Aufgabe und jeden erledigten Schritt. Wer eine Aufgabe zur Übung noch einmal löst, lernt zwar weiter, bekommt die XP aber fair nur beim ersten Mal gutgeschrieben.
- **Der „⚡ Fastlane“-Schnelltest:** Wer ein Thema bereits beherrscht, kann bei jedem Modul (auch bei noch gesperrten Folgemodulen) das schwere Fastlane-Quiz versuchen. Bei mindestens **85 %** richtigen Antworten gilt das gesamte Modul als bestanden, schaltet das nächste Modul frei und vergibt alle bis dahin **noch nicht verdienten** XP des Moduls auf einmal – ohne bereits abgeholte Theorie- oder Übungs-XP doppelt zu zählen. Bei unter **85 %** wird nur der persönliche Bestwert gespeichert, es gibt aber keine Punkte und keine Freischaltung.
- **Level-System:** Alle **500 XP** steigt man automatisch ein Level höher (Level 1 ab 0 XP, Level 2 ab 500 XP usw.), inklusive Aufschlüsselung nach Lernbereichen und Themen-Etiketten.
- **Prüfstrecke (`tests/learning-progress.test.mjs`):** 7 automatisierte Tests prüfen genau diese Regeln (Theorie- vs. Instrument-Pfad, Doppel-XP-Schutz, Fastlane-Erfolg/Misserfolg, Dashboard-Kennzahlen und Speicherung).

---

## Etappe 3B: Die sichtbare Lern-Oberfläche im Browser

Jetzt verbinden sich die Bausteine aus Etappe 1 bis 3A zu einem kompletten, direkt im Browser spielbaren Kurs unter **Audio & Musik → Musiktheorie → Interaktiver Lernpfad & Dashboard** (`/audio/theory/lernpfad/`).

### 1. Start-Lehrplan (`data/modules.json`)
Damit der Lehrgang sofort ausprobiert werden kann, enthält `data/modules.json` zwei vollständige Startmodule:
1. **Modul 1 (`theory-101` – reines Theorie-Modul ohne Praxisteil):** *Schall, Frequenz & Notensystem* (Kammerton $440\text{ Hz}$ als KaTeX-Formel, Violinschlüssel-Notenbild sowie 6 Übungs-, Quiz- und Fastlane-Aufgaben inklusive interaktiver Notenaufgabe).
2. **Modul 2 (`guitar-102` – Instrument-Modul mit Praxisteil):** *Gitarren-Grundlagen & Leersaiten* (mit Griffbrett-Visualisierung, Praxishinweis und passenden Übungs-, Quiz- und Fastlane-Aufgaben).

### 2. Das XP-Dashboard (`src/components/learning/ProgressDashboard.astro`)
- **Wozu es dient:** Zeigt dem Lernenden auf einen Blick das aktuelle **Level**, die **gesammelten Gesamt-XP**, den Fortschrittsbalken bis zum nächsten Level, die Anzahl **abgeschlossener Module** sowie kompakte Badges für XP nach Lernbereich (`Theorie`, `Instrument` …) und Themen (`Notensystem`, `Gitarre` …).
- **Live-Aktualisierung:** Sobald eine Aufgabe gelöst, Theorie abgeschlossen oder ein Quiz bestanden wird, aktualisiert sich das Dashboard sofort ohne Neuladen der Seite.
- **Geschützter Reset:** Über „Lernfortschritt zurücksetzen“ mit zweistufiger Sicherheitsabfrage lässt sich der eigene Test-Fortschritt jederzeit sauber auf Null stellen.

### 3. Die Modul-Roadmap (`src/components/learning/ModuleRoadmap.astro`)
- **Wozu sie dient:** Zeigt alle Module in der richtigen Reihenfolge als übersichtliche Karten.
- **Etappen-Pills:** Jede Karte bildet den exakten Status der Schritte ab (`✓` erledigt, `●` aktiv, `🔒` gesperrt) – inklusive *3. Praxis* nur dann, wenn das Modul auch tatsächlich einen Praxisteil besitzt.
- **Zwei Wege pro Modul:** **„Lektion öffnen“** (sobald das Modul freigeschaltet ist) oder jederzeit **„⚡ Fastlane (Schweres Quiz)“** (auch für noch gesperrte Folgemodule).

### 4. Der Lektions-Parcours & Aufgaben-Runner (`ModuleStepper.astro` & `ModuleQuizRunner.astro`)
- **Geführter Schritt-für-Schritt-Aufbau (`/audio/theory/modul/?id=...`):**
  - **Schritt 1 (Theorie):** Stellt alle Theorie-Blöcke mit mathematischen KaTeX-Formeln und eingebetteten Visualisierungen (`Notation`, `FretboardClickable`, `ScalePattern`, `NotationKeyboard`) dar. Erst der Klick auf **„Theorie abschließen (+XX XP)“** gibt Schritt 2 frei.
  - **Schritt 2 (Aufgaben):** Bleibt bis dahin gesperrt und bietet alle 4 Aufgabentypen direkt interaktiv an: Multiple/Single Choice, Zahleneingabe (versteht z. B. `880` genauso wie `880 Hz`) sowie das interaktive Notensystem (`NotationBuilder.astro`), bei dem Lernende Noten selbst im Takt platzieren. Bei einer falschen Antwort erscheint die didaktische Erklärung des Autors.
  - **Schritt 3 (Praxis, optional):** Erscheint nur bei Modulen mit Praxisteil und schaltet nach Bestätigung das Abschluss-Quiz frei.
  - **Abschluss-Quiz Einfach & Fastlane-Modus (`?id=...&mode=fastlane`):** Führen Frage für Frage mit Fortschrittsbalken (`Frage X / Y`), XP-Bonus-Vorschau, Bestehensschwelle (`80 %` bzw. `85 %`) und automatischer Freischaltung des Folgemoduls durch die Prüfung.
- **UI-Tests (`tests/components/module-player-ui.test.ts`):** 3 automatisierte Tests prüfen die Startdaten in `data/modules.json`, das Entsperren des Steppers nach Klick auf „Theorie abschließen“ sowie den kompletten Fastlane-Durchlauf inklusive `NotationBuilder`-Eingabe und Live-Update von Dashboard und Roadmap.

---

## Aktueller Stand

- **Fertiggestellt (Etappen 1, 2, 3A & 3B):** Autorenwerkbank (`Modul-Builder`), JSON-/GitHub-Speicherung (inkl. lokalem Dev-Endpunkt), XP- & Fortschritts-Engine sowie die komplette Schüler-Oberfläche (`/audio/theory/lernpfad/` und `/audio/theory/modul/`) sind vollständig umgesetzt und gebaut (`npm run build`: 42 Seiten ohne Fehler; `npx astro check`: 0 Fehler; `npx tsc --noEmit`: 0 Fehler; `biome check`: 0 Fehler auf allen geänderten/neuen Dateien).
- **Testergebnisse:** Alle 23 Tests unseres Features (`tests/learning-progress.test.mjs`, `tests/module-builder.test.mjs`, `tests/components/module-builder-ui.test.ts`, `tests/components/module-player-ui.test.ts`) bestehen zu 100 %; in der Gesamttest-Suite `npm test` bleiben lediglich 4 vorbestehende, davon unabhängige Fehlschläge in älteren `NotationBuilder`-Tests (`Leertaste` vs. `Num 1`).
