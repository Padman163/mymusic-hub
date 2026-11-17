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
  - **Standard-Punkte (Basis-XP):** Der Theorie-Basiswert beträgt **30 XP**, eine Übungsaufgabe **10 XP**, eine leichte Quizfrage **15 XP** und eine Schnelltest-Frage („Fastlane“) **25 XP**.
  - **Themen-Etiketten mit Schwierigkeitsfaktor:** Themen wie `Allgemein` (× 1,0), `Violinschlüssel` (× 1,0), `Tabulatur` (× 1,0), `Bassschlüssel` (× 1,1), `Gitarre` (× 1,2), `Rhythmus` (× 1,2) und `Notensystem` (× 1,5).
  - **Automatische Berechnung:** Eine Aufgabe im Notensystem mit 10 Basis-XP zählt durch den Faktor 1,5 automatisch **15 XP**. Hat eine Aufgabe mehrere Themen-Etiketten, zählt standardmäßig der höchste Faktor.
- **Warum:** Wenn wir später entscheiden, dass das Notensystem oder Gitarren-Aufgaben mehr oder weniger Punkte geben sollen, muss das nur **an einer einzigen Stelle** angepasst werden – und nicht in Dutzenden Aufgaben einzeln.

---

### 2. Der gemeinsame Bauplan für Module & Aufgaben (`src/lib/module-schema.ts`)
- **Was es ist:** Eine verbindliche Vorlage, wie ein Lernmodul und eine Aufgabe aufgebaut sein müssen, damit alle Teile der Lernplattform dieselbe Sprache sprechen.
- **Was darin geregelt ist:**
  - **Lernmodule:** Haben Titel, Beschreibung, Reihenfolge, Bereich (`theory`, `instrument`, `production`, `band`), Level und optional eine Stufe (`D1`, `D2`, `D3`). Reine Theorie-Module können über `hasPractice: false` klar von Modulen mit Praxis-Anteil getrennt werden. Die Bestehensgrenzen gelten übergreifend (Standard: **80 %** für das einfache Quiz, **85 %** für den Schnelltest).
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
- **Datendatei (`data/modules.json`):** Der zentrale Speicherort für Lernmodule und Aufgaben; sie enthält bereits Startdaten und kann über den Builder verändert werden.
- **Schnittstelle zum Speichern und Laden (`netlify/functions/modules.ts`):**
  - Eine kleine Server-Funktion unter `/api/modules`, über die Module und Aufgaben geladen (`GET`), neu angelegt (`POST`), aktualisiert (`PUT`) und gelöscht (`DELETE`) werden können – direkt in der Projekt-Datei auf GitHub, genau nach demselben Sicherheitsmuster wie beim bestehenden IssueTracker.
  - **GitHub-Branch:** `GITHUB_BRANCH` legt den gemeinsamen Lese- und Schreib-Branch für Module und Beiträge fest (Standard: `main`). Konfiguration und Unterschied zum lokalen Dev-Endpunkt: [Workspace-Setup](../README_WORKSPACE_SETUP.md#schritt-5-netlify-cli-verknüpfen-umgebungsvariablen-für-das-backend-einrichten--fullstack-starten).
  - **Schutz bei gleichzeitigem Bearbeiten:** Wenn zwei Personen fast zeitgleich speichern, bemerkt die Schnittstelle den Konflikt und wiederholt den Speichervorgang automatisch bis zu dreimal sauber, statt Änderungen von anderen versehentlich zu überschreiben.
  - **Größenbegrenzung:** Zu große Anfragen (über 500.000 Bytes) werden sofort abgewiesen.
- **Schutz vor unnötigen Website-Neubauten (`netlify.toml`):**
  - **Was geändert wurde:** Die Bau-Regel wurde von „nur `data/contributions.json` ignorieren“ auf „den gesamten Ordner `data/**` ignorieren“ erweitert.
  - **Warum:** Wenn Redakteure später neue Module oder Aufgaben in `data/modules.json` speichern, muss Netlify nicht jedes Mal die komplette statische Website neu bauen und veröffentlichen – das spart Bauzeit und Server-Kontingent.

---

### 5. Die automatische Prüfstrecke (`tests/module-builder.test.mjs`)
- **Was es ist:** Automatisierte Tests für die Grundlagen und die Speicher-Schnittstelle.
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

Dort gibt es vier übersichtliche Reiter:

### 1. Reiter „Übersicht“ (`src/components/project/ModuleCatalogList.astro`)
- **Wozu er dient:** Deine zentrale Übersicht über alle bereits erstellten Module und ihre Aufgaben.
- **Was sie bietet:**
  - **Karten- oder Listenansicht:** Per Knopfdruck wechselst du zwischen ausführlichen Karten und einer kompakten Liste. Außerdem kannst du nach Bereich filtern und nach Reihenfolge oder Gesamt-XP sortieren.
  - **Automatische Modul-Bilanz:** Jede Karte zeigt sofort an, wie viele Theorie-Blöcke, Übungen, einfache Quizfragen, Fastlane-Fragen und Gesamt-XP im Modul stecken.
  - **Aufklappbare Aufgabenliste:** Unter jedem Modul lassen sich alle zugehörigen Fragen ausklappen und nach Lern-Spur filtern.
  - **Direktes Bearbeiten & Löschen:** Ein Klick auf den Stift eines Moduls öffnet seine eigene Detailseite; Fragen werden weiterhin im Aufgaben-Reiter bearbeitet. Beim Löschen eines Moduls erinnert eine Sicherheitsabfrage daran, dass alle dazugehörigen Aufgaben mitgelöscht werden.
  - **Reihenfolge ändern:** In der Sortierung „Reihenfolge: 1 → N“ ohne Bereichsfilter verschieben die Pfeile ein Modul jeweils um eine Position. Die Reihenfolge wird dauerhaft gespeichert und gilt für den Lernpfad.

### 2. Reiter „Theorie“ (`src/components/project/ModuleBuilderForm.astro`)
- **Wozu er dient:** Hier legst du neue Lernmodule an oder bearbeitest bestehende Module.
- **Was du einstellen kannst:**
  - **Grunddaten:** Die allgemeinen Informationen sind zunächst eingeklappt. Die eindeutige Modul-ID wird automatisch erstellt und beim Bearbeiten beibehalten. Neue Module werden automatisch hinter dem Modul mit der höchsten Reihenfolge eingefügt; beim Bearbeiten bleibt ihre Position erhalten. Einstellbar sind Titel, Kurzbeschreibung, Bereich (`Theorie`, `Instrument`, `Produktion`, `Band`), Level (`100` bis `500`) und optional die D-Stufe (`D1`, `D2`, `D3`).
  - **Themen-Etiketten als anklickbare Chips:** Zur Auswahl stehen Tags mit einem Punkte-Faktor über 1,0, z. B. `Notensystem (1.5x)`. Ohne ausgewählten Tag gilt Faktor 1,0. Bereits gespeicherte Tags mit Faktor 1,0 oder nicht mehr auswählbare Tags bleiben beim Bearbeiten erhalten.
  - **Praxisteil-Schalter:** Über ein Häkchen legst du fest, ob das Modul einen Praxisteil hat – bei reinen Theorie-Modulen bleibt der Haken einfach aus.
  - **Punkte:** Theorie-Basis-XP (Standard: `30`) dienen als Vorgabe für Blöcke ohne eigenen Wert. Die Bestehensgrenzen stehen in den übergreifenden Einstellungen.
  - **Gemeinsame Blockliste:** Beim Bearbeiten eines Moduls erscheinen die zugehörigen Übungen zwischen den Theorieblöcken und können dort einsortiert werden. Übungen können nach Bestätigung direkt gelöscht werden; ihre Bearbeitung erfolgt weiterhin im Reiter „Aufgaben“. Die gespeicherte Reihenfolge gilt vorerst nur im Editor; der Lernpfad verwendet noch getrennte Schritte. Quizfragen erscheinen nicht in der Blockliste.
  - **Dynamischer Theorie-Block-Editor:** Gespeicherte Lernabschnitte erscheinen als kompakte, aufklappbare Zeilen. Du kannst beliebig viele hinzufügen, per Pfeiltasten (`↑` / `↓`) neu sortieren oder wieder entfernen. Wähle mehrere Theorieblöcke aus und fasse sie zu einem benannten Abschnitt zusammen; Gruppen erscheinen auch im Lernmodul und lassen sich als Einheit verschieben oder auflösen. Als Abschnittstitel werden zunächst die Blocktitel kombiniert (z. B. „Titel 1, Titel 2 & Titel 3“); du kannst ihn anschließend ändern. Jeder Block kann eigene Basis-XP und Tags erhalten; seine berechneten XP verwenden ausschließlich seine Tags. Ohne eigenen Basiswert gilt die Modulvorgabe. Das Textfeld unterstützt KaTeX-Formeln (`$...$` / `$$...$$`) und Notationen direkt an der gewünschten Stelle:

    ```mdx
    Erklärung vor dem Notensystem.

    <Notation clef="treble" notes={[{ duration: "quarter", step: 2 }]} />

    Erklärung danach.
    ```

    Es werden ausschließlich feste Werte, Arrays und Objekte unterstützt, keine ausführbaren JavaScript-Ausdrücke oder Imports. Alte getrennte Notations-Props werden beim Bearbeiten in den Text übernommen. Andere bereits gespeicherte Visualisierungen bleiben erhalten; eine Definition weiterer Komponententypen im Text wird nicht unterstützt.

### 3. Reiter „Aufgaben“ (`src/components/project/ExerciseBuilderForm.astro`)
- **Wozu er dient:** Hier erstellst du Übungs- und Prüfungsfragen und ordnest sie direkt einem bestehenden Modul zu.
- **Wie sich das Formular anpasst:**
  - Du wählst das Ziel-Modul und die gewünschte Lern-Spur: normale **Übung**, **Abschluss-Quiz Einfach** oder schwerer **Fastlane-Test**. Dabei passen sich die vorgeschlagenen Basis-XP automatisch an (`10`, `15` oder `25 XP`).
  - Je nach gewähltem **Aufgabentyp** zeigt das Formular automatisch nur die passenden Eingabefelder:
    - **Eine oder mehrere richtige Antworten:** Eine flexible Liste von Antwortmöglichkeiten, in der du mit Klick die richtigen Lösungen markierst.
    - **Zahleneingabe:** Ein Feld für die exakte Antwort (z. B. `880` oder `880 Hz`).
    - **Interaktive Notenaufgabe (`NotationBuilder`):** Einstellfelder für Notenschlüssel (Violin-/Bassschlüssel), Notenanzahl (`1` bis `8`), feste oder wählbare Notenwerte, kompakte/breite Darstellung, Tastatur-Hinweise sowie die erwarteten Töne oder Notenwerte.
  - **Direkte Live-Vorschau:** Bei interaktiven Notenaufgaben siehst du direkt unter den Einstellungen das echte interaktive Notensystem als Vorschau – und kannst sofort prüfen, wie die Aufgabe später für Lernende aussieht.
  - **Live-XP-Rechner:** Sobald du Basis-XP, Spur oder Themen-Etiketten änderst, rechnet das Formular sofort aus, wie viele Erfahrungspunkte die Aufgabe am Ende bringt (z. B. `10 Basis-XP` × `1,5` für `Notensystem` = **15 XP**).

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
  - Modul 1 startet automatisch **freigeschaltet** mit Schritt 1 (*Theorie*). Alle Folgemodule starten zunächst **gesperrt**.
  - Innerhalb eines Moduls geht es der Reihe nach voran: **1. Theorie** → **2. Aufgaben** → **3. Praxis** *(nur wenn das Modul einen Praxisteil hat)* → **Abschluss-Quiz Einfach**. Erst danach öffnet sich automatisch das nächste Modul.
  - Kommen später über den Modul-Builder neue Module in `data/modules.json` hinzu, werden sie automatisch einsortiert, ohne dass bereits verdiente XP oder erledigte Module verloren gehen.
- **Keine doppelten Punkte:** Das System merkt sich jede bereits gelöste Aufgabe und jeden erledigten Schritt. Wer eine Aufgabe zur Übung noch einmal löst, lernt zwar weiter, bekommt die XP aber fair nur beim ersten Mal gutgeschrieben.
- **Der „⚡ Fastlane“-Schnelltest:** Wer ein Thema bereits beherrscht, kann auch bei gesperrten Folgemodulen das schwere Fastlane-Quiz versuchen. Bei Erreichen der Bestehensgrenze (Standard: **85 %**) gilt das Modul als bestanden und das nächste wird freigeschaltet. Die XP noch offener Theorieblöcke und ungelöster Fragen werden einmalig gutgeschrieben. Unter der Grenze wird der persönliche Bestwert gespeichert, aber es gibt keine Punkte oder Freischaltung.
- **Theorie-XP:** Jeder abgeschlossene Theorieblock schreibt seine eigenen, anhand seiner Tags gewichteten XP einmalig gut. Erst nach allen Blöcken wird der Aufgabenschritt freigeschaltet. Alte Blöcke ohne eigene Werte verwenden den Theorie-Basiswert des Moduls und zunächst keine Tags; bereits abgeschlossene Theorie bleibt abgeschlossen und wird nicht erneut vergütet. Ein Modul ohne Theorieblöcke kann ohne Theorie-XP abgeschlossen werden.
- **Level-System:** Alle **500 XP** steigt man automatisch ein Level höher (Level 1 ab 0 XP, Level 2 ab 500 XP usw.), inklusive Aufschlüsselung nach Lernbereichen und Themen-Etiketten.
- **Prüfstrecke (`tests/learning-progress.test.mjs`):** Tests prüfen diese Regeln, darunter Doppel-XP-Schutz, Fastlane, Dashboard-Kennzahlen und Speicherung.

---

## Etappe 3B: Die sichtbare Lern-Oberfläche im Browser

Jetzt verbinden sich die Bausteine aus Etappe 1 bis 3A zu einem kompletten, direkt im Browser spielbaren Kurs unter **Audio & Musik → Musiktheorie → Interaktiver Lernpfad & Dashboard** (`/audio/theory/lernpfad/`).

### 1. Start-Lehrplan (`data/modules.json`)
Die derzeitigen Startdaten in `data/modules.json` enthalten zwei Module:
1. **`theory-101` – Elementarlehre:** Theorie ohne Praxisteil, mit Schall, Kammerton und Notensystem sowie Fragen in allen drei Lernspuren.
2. **`guitar-102` – Gitarrenlehre:** Instrument-Modul mit Griffbrett, Praxishinweis und Fragen in allen drei Lernspuren.

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
  - **Abschluss-Quiz Einfach & Fastlane-Modus (`?id=...&mode=fastlane`):** Führen Frage für Frage mit Fortschrittsbalken (`Frage X / Y`), XP-Bonus-Vorschau, konfigurierbarer Bestehensschwelle (Standard: `80 %` bzw. `85 %`) und automatischer Freischaltung des Folgemoduls durch die Prüfung.
- **UI-Tests (`tests/components/module-player-ui.test.ts`):** Prüfen unter anderem Startdaten, das Entsperren des Steppers und den Fastlane-Durchlauf mit Dashboard und Roadmap.

---

## Aktueller Stand

- **Umgesetzt (Etappen 1, 2, 3A & 3B):** Autorenwerkbank, JSON-/GitHub-Speicherung mit lokalem Dev-Endpunkt, Fortschritts-Engine und Lernoberfläche (`/audio/theory/lernpfad/` und `/audio/theory/modul/`).
- **Tests:** Feature-Tests liegen in `tests/learning-progress.test.mjs`, `tests/module-builder.test.mjs`, `tests/components/module-builder-ui.test.ts` und `tests/components/module-player-ui.test.ts`. Den aktuellen Stand mit `npm test` prüfen.

---

## Schnittstellen & Abnahme

### Datenmodell und Einbindung

`src/lib/module-schema.ts` definiert `LearningModule`, `TheoryBlock`, `ModuleQuestion`, `NotationBuilderTaskConfig` und `ModulesDatabase`. Theorieblöcke können optional über `groupId` und `groupTitle` zu benannten, zusammenhängenden Abschnitten zusammengefasst werden. Module enthalten außerdem Bereich, Level, Tags, Praxisteil-Flag, XP-Werte und Theorie-Blöcke. Die Modul-Datenbank enthält die übergreifenden Quiz-Einstellungen. Aufgaben referenzieren ein Modul und eine Lernspur (`exercise`, `quiz_easy` oder `fastlane`); Notationsaufgaben konfigurieren Notenschlüssel, Taktart, Vorzeichen, Notenwerte und erwartete Tonhöhen beziehungsweise Dauern.

Die drei Builder-Formulare unter `src/components/project/` werden in `src/content/docs/projektierung/modul-builder.mdx` eingebunden. Der Lernpfad nutzt `ProgressDashboard`, `ModuleRoadmap`, `ModuleStepper` und `ModuleQuizRunner` unter `src/components/learning/`; die Seiten liegen unter `src/content/docs/audio/theory/`. Die Builder-Formulare werden ohne fachliche Astro-Props eingebunden. Die Lernkomponenten akzeptieren:

| Komponente | Props |
|:---|:---|
| `ProgressDashboard` | `id?` |
| `ModuleRoadmap` | `id?`, `lessonBaseUrl?` |
| `ModuleStepper` | `id?`, `moduleId?`, `mode?: "normal" \| "fastlane"`, `lessonBaseUrl?` |
| `ModuleQuizRunner` | `id?`, `moduleId?`, `mode?: TargetLane`, `templatesOnly?` |

Die Netlify Function `netlify/functions/modules.ts` stellt die Modul-API bereit. In der Astro-Entwicklung ergänzt ein Vite-Plugin den lokalen Endpunkt, der `data/modules.json` verwendet. XP- und Validierungsregeln liegen in `src/lib/xp-tags.ts`, `src/lib/module-schema.ts` und `src/lib/module-store.ts`; UI-Logik und Styles liegen in `src/lib/module-builder-ui.ts`, `src/lib/module-player-ui.ts`, `src/styles/module-builder.css` und `src/styles/module-player.css`.

### Manuelle Abnahme-Checkliste

- [ ] Die Modul-Builder-Seite zeigt alle vier Tabs und lädt den Katalog ohne Fehler.
- [ ] Ein Modul mit gültiger ID, Bereich, Level, Tags und Theorie-Blöcken lässt sich lokal speichern und erneut laden.
- [ ] Theorie-Blöcke lassen sich hinzufügen, entfernen und umsortieren; KaTeX-Inhalte werden im Lernpfad dargestellt.
- [ ] Visuelle Theorie-Bausteine lassen sich konfigurieren und im Lernpfad prüfen.
- [ ] Reine Theorie-Module ohne Praxisschritt sowie Module mit Praxisschritt werden korrekt gespeichert und angezeigt.
- [ ] Ungültige Pflichtfelder und Bestehensgrenzen außerhalb von 0 bis 100 werden abgewiesen.
- [ ] XP-Basiswerte und Tag-Faktoren werden im Aufgaben-Builder korrekt angezeigt und neu berechnet.
- [ ] Single-Choice-, Multi-Select- und Zahleneingabe-Aufgaben lassen sich erstellen und bearbeiten.
- [ ] Notationsaufgaben zeigen die Builder-Vorschau und speichern Konfiguration sowie erwartete Töne oder Dauern.
- [ ] Aufgaben ohne gültiges Zielmodul oder mit ungültiger Notationskonfiguration werden abgewiesen.
- [ ] Der Katalog wechselt zwischen Karten- und Listenansicht und filtert nach Bereich sowie Lernspur.
- [ ] Katalog-Zusammenfassungen zeigen Theorie-Blöcke, Aufgaben je Spur und gewichtete XP passend zu den Daten.
- [ ] Bearbeiten aus dem Katalog lädt das ausgewählte Modul beziehungsweise die ausgewählte Aufgabe in den passenden Tab.
- [ ] Beim Löschen eines Moduls bestätigt der Dialog die Aktion; zugehörige Aufgaben werden mitgelöscht.
- [ ] Die Modul-API lädt und speichert Daten über den konfigurierten GitHub-Branch; der lokale Dev-Endpunkt nutzt `data/modules.json`.
- [ ] HTML-Fehlerantworten und API-Fehler werden sichtbar behandelt, statt als erfolgreiche JSON-Antworten zu gelten.
- [ ] Das Dashboard zeigt Level, Gesamt-XP, Fortschritt, abgeschlossene Module sowie XP nach Bereich und Tag.
- [ ] Fortschritt bleibt nach erneutem Laden im Browser erhalten; serverseitiges Rendering läuft ohne `localStorage`.
- [ ] Theorie, Übungen, optionaler Praxisschritt und Quiz werden in der vorgesehenen Reihenfolge freigeschaltet.
- [ ] Wiederholtes Lösen derselben Aufgabe vergibt keine doppelten XP; 500 XP entsprechen einem Level.
- [ ] Quiz und Fastlane verwenden die Modul-Bestehensgrenze; Nichtbestehen vergibt keine Abschluss-XP und entsperrt kein Folgemodul.
- [ ] Fastlane ist auch für gesperrte Module erreichbar; Bestehen aktualisiert Fortschritt und Roadmap.
- [ ] Zahleneingaben mit Einheiten und interaktive Notationsantworten werden gemäß Aufgaben-Konfiguration bewertet.
- [ ] Dashboard und Roadmap aktualisieren sich nach Fortschrittsänderungen ohne Seitenneuladen.
- [ ] Der Fortschritt-Reset erfordert Bestätigung und setzt den lokalen Lernstand zurück.

### Automatisierte Qualitätssicherung

Die fachlichen Regeln und die Builder-/Player-Interaktionen sind in den vier oben genannten Feature-Testdateien abgedeckt. Für die fokussierten Tests `npm test`, für das vollständige Projekt-Quality-Gate `npm run preflight` ausführen.
