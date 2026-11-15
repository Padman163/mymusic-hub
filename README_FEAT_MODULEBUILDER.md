# Der Modul- & Aufgaben-Builder (Etappe 1) – Einfach erklärt

Dieses Dokument erklärt ohne Programmier-Fachchinesisch, **was** wir im ersten Bauabschnitt (Etappe 1) für den neuen **Admin Modul- & Aufgaben-Builder** aufgebaut haben und **warum** jeder dieser Schritte wichtig ist, bevor in Etappe 2 die sichtbaren Formulare entstehen.

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

## Aktueller Stand & Ausblick auf Etappe 2

- **Bereits fertig (Etappe 1):** Datenmodell, XP-Logik, Prüfregeln, Datenspeicher, Server-Schnittstelle und automatisierte Tests sind erstellt und geprüft (alle 8 neuen Tests sowie die TypeScript-Prüfung laufen fehlerfrei; in der Gesamttest-Suite gibt es lediglich 4 bereits zuvor bestehende Fehlschläge in älteren `NotationBuilder`-Tests zur Tastenbeschriftung `Leertaste` vs. `Num 1`).
- **Noch bewusst offen (Etappe 2):** Es gibt noch **keine** sichtbaren Formulare oder Admin-Seiten im Browser. Diese bauen wir im nächsten Schritt im gewohnten Design des IssueTrackers auf dieses stabile Fundament auf.
