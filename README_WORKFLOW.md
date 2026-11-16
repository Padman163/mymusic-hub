# Mein Entwicklungsworkflow

`main` ist der Hauptbranch und wird nur selten deployed. Neue Features entstehen auf `feat/<featurename>`; abgeschlossene Features werden unter `archive/feat/<featurename>` gesichert.

## 1. Workspace vorbereiten

Im neuen Workspace das Repository einrichten und den benötigten Branch auschecken: [Workspace-Setup](README_WORKSPACE_SETUP.md). Alltagsbefehle stehen im [Cheatsheet](README_CHEATSHEET.md).

Vor einem Workspace-Wechsel Änderungen prüfen, committen und den aktuellen Branch pushen. Lokale `.env`-Dateien und nicht eingecheckte Daten separat und sicher übertragen.

## 2. Feature entwickeln

Vom aktuellen `main` einen neuen Feature-Branch erstellen:

```bash
git switch main
git pull origin main
git switch -c feat/<featurename>
```

Auf diesem Branch entwickeln und Änderungen regelmäßig committen und pushen. Soll ein neues Feature auf einem noch nicht in `main` übernommenen Feature aufbauen, bewusst von dessen Archiv-Branch abzweigen statt von `main`.

## 3. Automatisch testen

```bash
npm run preflight
```

Das Gate umfasst Validierung, Audit, Vitest, Build und Playwright. Fehler beheben und erneut ausführen. Details und Voraussetzungen: [Testing](README_TESTING.md).

## 4. Cleanup und Abschlussprüfung

Die fünf Schritte der [Cleanup-Anleitung](README_CLEANUP.md) durchgehen. Löschungen und Migrationen erst nach Prüfung und Freigabe durchführen. Nach Änderungen relevante Tests und vor dem Abschluss erneut `npm run preflight` ausführen. Anschließend den endgültigen Stand committen.


## 5. Manuelle Featureprüfung und Dokumentationsanpassung
```bash
Wir haben den Code-Cleanup und die Abschlussprüfung (`npm run preflight`) für das Feature `<FEATURE-NAME>` auf dem Branch `<BRANCH-NAME>` abgeschlossen.

### Ziel & Reihenfolge (strikt einhalten)
1. **Schritt 1 (JETZT – Dokumentation & Feature-Datei):** Analysiere alle vorhandenen Dokumentationsdateien im Repository (`README.md`, `FEATURES.md`, `ASTROSTRUCTURE.md`, `CHEATSHEET.md`, `TESTING.md`, `WORKSPACE_SETUP.md`, `.INSTRUCTIONS.md` – bzw. deren `README_*.md`-Pendants), aktualisiere sie entsprechend dem neuen Feature `<FEATURE-NAME>` und lege unter `/features/<feature-slug>.md` eine eigenständige, vollständige Feature-Dokumentation an.
2. **Schritt 2 (DANACH – Feature-Beitrag aus der Doku ableiten):** Sobald die Dokumentation steht, leite **direkt aus der neu erstellten `/features/<feature-slug>.md`** den Feature-Beitrag für unseren IssueTracker (`projektierung/beitraege` / `/.netlify/functions/contributions`) ab.

---

### Aufgaben für Schritt 1 (Dokumentation anpassen & `/features/<feature-slug>.md` erstellen)

1. **Alle README-/Doku-Dateien analysieren & gezielt ergänzen:**
   - Prüfe jede vorhandene `.md`-Dokumentationsdatei im Root-Verzeichnis (`README.md`, `FEATURES.md`, `ASTROSTRUCTURE.md`, `CHEATSHEET.md`, `TESTING.md`, `WORKSPACE_SETUP.md`, `.INSTRUCTIONS.md`).
   - Ergänze das neue Feature `<FEATURE-NAME>` **nur dort, wo es fachlich hingehört** (Single Source of Truth, keine Redundanzen erzeugen!):
     - `FEATURES.md`: Architektur, Funktionsweise, Props/Schnittstellen und beteiligte Dateien ergänzen.
     - `README.md`: Falls das Feature auf der Roadmap stand, Status von `[ ]` auf `[x]` setzen (sonst als abgeschlossenes Feature ergänzen) und ggf. auf `/features/<feature-slug>.md` verweisen.
     - `TESTING.md` / `CHEATSHEET.md` / `WORKSPACE_SETUP.md` / `.INSTRUCTIONS.md`: Nur anpassen, falls neue Testsuiten, Skripte, Umgebungsvariablen oder globale Komponentenregeln hinzugekommen sind.

2. **Eigenständige Feature-Datei unter `/features/<feature-slug>.md` anlegen:**
   - Erstelle den Ordner `/features` (falls noch nicht vorhanden) und darin die Datei `/features/<feature-slug>.md`.
   - Strukturiere die Datei klar und vollständig:
     - **Titel & Kurzbeschreibung** (Was löst das Feature, wo ist es im Projekt eingebunden?)
     - **Architektur & Beteiligte Dateien** (Trennung Logik in `src/lib/`, UI in `src/components/`, Seiten in `src/content/docs/`, Backend/Tests)
     - **Funktionsumfang & Teil-Features** (alle implementierten Funktionen, Props, Konfigurationen, Edge-Cases)
     - **Qualitätssicherung & Tests** (zugehörige Unit-/Komponenten-/E2E-Tests und Prüfkommandos)
     - **Manuelle Abnahme-Checkliste (To-Do-Liste)** (alle neuen Teil-Features und Interaktionen als abhakbare Punkte für den Release-Check)

---

### Aufgaben für Schritt 2 (Aus `/features/<feature-slug>.md` den Feature-Beitrag generieren)
Lies bei Bedarf `src/components/IssueTrackerForm.astro`, `src/lib/contribution-checklist.ts` und `netlify/functions/contributions.ts`, damit alle Systemgrenzen eingehalten werden, und generiere **auf Basis von `/features/<feature-slug>.md`**:

1. **Formular-Vorlage (Copy & Paste für `/projektierung/beitraege/`):**
   - **Titel (`title`):** Prägnanter Feature-Titel (max. **120 Zeichen**)
   - **Typ (`type`):** `Feature`
   - **Bereich (`area`):** `Theorie`, `Praxis` oder `Komponente`
   - **Priorität (`priority`):** `Hoch`, `Mittel` oder `Niedrig`
   - **Status (`status`):** `New` (bzw. `Active` für die laufende manuelle Abnahme)
   - **Beschreibung (`description`):** Kompakte Zusammenfassung inkl. Verweis auf `/features/<feature-slug>.md` (2–4 Sätze, da in der Übersicht auf 3 Zeilen gekürzt wird).
   - **Checklisten-Punkte (To-Do-Liste):** Alle neuen Teil-Features aus `/features/<feature-slug>.md` als einzelne Punkte (**strikt ≤ 200 Zeichen pro Punkt**, maximal **100 Punkte**).

2. **Valides JSON-Payload (für `data/contributions.json` oder `POST /.netlify/functions/contributions`):**
   - Gib das vollständige JSON-Objekt (`type`, `title`, `description`, `area`, `priority`, `status`, `checklist: [{ "text": "...", "checked": false }]`) aus.

---

### Regeln & Stopp-Bedingung
- **Wichtig:** Führe in Schritt 1 die Anpassungen an den `.md`-Dateien durch und lege `/features/<feature-slug>.md` an. Führe jedoch **noch keinen** automatischen API-Post an `/.netlify/functions/contributions` aus, bevor ich die Doku und den abgeleiteten Beitrag geprüft und freigegeben habe.
- Token-Sparmodus: Gib bei bestehenden `.md`-Dateien nur die geänderten Abschnitte (Diffs) im Chat aus, nicht die kompletten Dateien.
- Prüfe selbstständig, dass kein Checklistenpunkt 200 Zeichen überschreitet.

```

## 6. Feature archivieren und neues beginnen

Auf dem fertigen Feature-Branch:

```bash
git branch -m archive/feat/<featurename>
git push -u origin archive/feat/<featurename>
```

Den Archiv-Branch auf GitHub prüfen. Ein bereits gepushter `feat/`-Branch bleibt dort bestehen; eine spätere Löschung ist eine separate Entscheidung.

Archivieren übernimmt **keine** Änderungen nach `main`. Eine Übernahme per Pull Request und ein Deployment werden später separat entschieden. Danach mit Schritt 2 das nächste Feature beginnen.
