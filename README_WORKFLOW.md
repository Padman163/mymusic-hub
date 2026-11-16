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
### 1. PLATZHALTER-DEFINITION (Hier vor dem Absenden ausfüllen)
- **FEATURE_NAME:** `<z. B. Modul- & Aufgaben-Builder>`
- **FEATURE_SLUG:** `<z. B. MODULEBUILDER>` *(Dateiname für `/features/README_FEAT_<FEATURE_SLUG>.md`)*
- **BRANCH_NAME:** `<z. B. feat/module-builder>`
- **BEREICH (`area`):** `<Theorie | Praxis | Komponente>`
- **PRIORITAET (`priority`):** `<Hoch | Mittel | Niedrig>`
- **STATUS (`status`):** `<New | Active>` *(Standard: `New`)*
- **HANDOFF_DATEI (optional):** `<z. B. HANDOFF_FEAT_MODULE_BUILDER.md oder "keine">`

---

### 2. ZIEL & REIHENFOLGE (strikt einhalten)
Wir haben den Code-Cleanup und die automatisierte Abschlussprüfung (`npm run preflight`) für **{{FEATURE_NAME}}** auf dem Branch **{{BRANCH_NAME}}** erfolgreich abgeschlossen.

Arbeite nun in zwei aufeinanderfolgenden Stufen:
1. **Stufe 1 (Dokumentation zuerst):** Analysiere die relevanten Dokumentationsdateien und ergänze die passende vorhandene Feature-Dokumentation unter `/features/README_FEAT_{{FEATURE_SLUG}}.md` oder erstelle sie, falls sie noch fehlt.
2. **Stufe 2 (Feature-Beitrag aus der Doku ableiten und einreichen):** Leite **direkt aus `/features/README_FEAT_{{FEATURE_SLUG}}.md`** den fertigen Feature-Beitrag mit kompletter To-Do-Checkliste für unseren IssueTracker (`projektierung/beitraege` / `/.netlify/functions/contributions`) ab und reiche ihn dort ein. Bestehende passende Beiträge ergänzen statt Duplikate anzulegen.

---

### 3. AUFGABEN FÜR STUFE 1 (Dokumentation & `/features/README_FEAT_{{FEATURE_SLUG}}.md`)

1. **Alle README-/Doku-Dateien analysieren & gezielt ergänzen (Single Source of Truth):**
   - Prüfe jede vorhandene `.md`-Dokumentationsdatei im Root-Verzeichnis (`README.md`, `FEATURES.md`, `ASTROSTRUCTURE.md`, `CHEATSHEET.md`, `TESTING.md`, `WORKSPACE_SETUP.md`, `.INSTRUCTIONS.md`) sowie falls angegeben **{{HANDOFF_DATEI}}**.
   - Ergänze **{{FEATURE_NAME}}** nur dort, wo es fachlich hingehört (keine Redundanzen):
     - `FEATURES.md`: Architektur, Funktionsweise, Props/Schnittstellen und beteiligte Dateien ergänzen.
     - `README.md`: Falls das Feature auf der Roadmap stand, Status auf `[x]` setzen (sonst als abgeschlossenes Feature ergänzen) und auf `/features/README_FEAT_{{FEATURE_SLUG}}.md` verweisen.
     - `TESTING.md` / `CHEATSHEET.md` / `WORKSPACE_SETUP.md` / `.INSTRUCTIONS.md`: Nur anpassen, falls neue Testsuiten, Skripte, `.env`-Variablen oder globale Architekturregeln hinzugekommen sind.

2. **Feature-Datei `/features/README_FEAT_{{FEATURE_SLUG}}.md` anlegen oder ergänzen:**
   - Verwende das bestehende Namensschema `README_FEAT_<FEATURE_SLUG>.md`. Falls eine passende Feature-Datei bereits existiert, ergänze sie statt eine zweite Dokumentation anzulegen.
   - Erstelle die Datei nur, wenn noch keine passende Feature-Dokumentation existiert, und gliedere sie wie folgt:
     - **Titel & Kurzbeschreibung:** Was löst **{{FEATURE_NAME}}** und wo ist es eingebunden?
     - **Architektur & Beteiligte Dateien:** Trennung zwischen Logik (`src/lib/`), UI (`src/components/`), Content (`src/content/docs/`), Backend (`netlify/functions/`) und Tests (`tests/`).
     - **Funktionsumfang & Teil-Features:** Alle implementierten Funktionen, Props, Konfigurationen und Edge-Cases.
     - **Qualitätssicherung & Tests:** Zugehörige Tests und Prüfkommandos.
     - **Manuelle Abnahme-Checkliste (To-Do-Liste):** Alle neuen Teil-Features, Interaktionen und Edge-Cases als abhakbare Punkte für den Release-Check.

---

### 4. AUFGABEN FÜR STUFE 2 (Feature-Beitrag aus `/features/README_FEAT_{{FEATURE_SLUG}}.md` ableiten und einreichen)
Lies bei Bedarf `src/components/IssueTrackerForm.astro`, `src/lib/contribution-checklist.ts` und `netlify/functions/contributions.ts`, damit alle Systemgrenzen eingehalten werden, und erstelle den Beitrag **auf Basis von `/features/README_FEAT_{{FEATURE_SLUG}}.md`**:

1. **Beitragsdaten:**
   - **Titel (`title`):** Prägnanter Feature-Titel zu **{{FEATURE_NAME}}** (max. **120 Zeichen**)
   - **Typ (`type`):** `Feature`
   - **Bereich (`area`):** **{{BEREICH}}**
   - **Priorität (`priority`):** **{{PRIORITAET}}**
   - **Status (`status`):** **{{STATUS}}**
   - **Beschreibung (`description`):** Kompakte Zusammenfassung inkl. Verweis auf `/features/README_FEAT_{{FEATURE_SLUG}}.md` (2–4 Sätze, da in der Übersicht auf 3 Zeilen gekürzt wird).
   - **Checklisten-Punkte (To-Do-Liste):** Alle neuen Teil-Features aus `/features/README_FEAT_{{FEATURE_SLUG}}.md` als einzelne Punkte (**strikt ≤ 200 Zeichen pro Punkt**, maximal **100 Punkte**).

2. **Beitrag direkt einreichen:** Sende das vollständige JSON (`type`, `title`, `description`, `area`, `priority`, `status`, `checklist: [{ "text": "...", "checked": false }]`) per `POST /api/contributions` (alternativ über `/.netlify/functions/contributions`). Wenn für den Workspace kein API-Endpunkt verfügbar ist, ergänze einen bereits vorhandenen passenden Eintrag in `data/contributions.json` oder füge den neuen Beitrag dort hinzu. Den JSON-Body nicht nur zur manuellen Übertragung ausgeben.

---

### 5. REGELN & STOPP-BEDINGUNG
- Dokumentation zuerst aktualisieren, anschließend den Beitrag direkt einreichen. Eine explizite Bitte um vorherige Prüfung oder einen Stopp hat Vorrang und verhindert den Post bis zur Freigabe.
- **Token-Sparmodus:** Gib bei bereits bestehenden `.md`-Dateien im Chat nur die geänderten Abschnitte (Diffs) aus, nicht die kompletten Dateien.
- Prüfe selbstständig vor der Ausgabe, dass kein Checklistenpunkt die 200-Zeichen-Grenze überschreitet.
```

## 6. Feature archivieren und neues beginnen

Auf dem fertigen Feature-Branch:

```bash
git branch -m archive/feat/<featurename>
git push -u origin archive/feat/<featurename>
```

Den Archiv-Branch auf GitHub prüfen. Ein bereits gepushter `feat/`-Branch bleibt dort bestehen; eine spätere Löschung ist eine separate Entscheidung.

Archivieren übernimmt **keine** Änderungen nach `main`. Eine Übernahme per Pull Request und ein Deployment werden später separat entschieden. Danach mit Schritt 2 das nächste Feature beginnen.
