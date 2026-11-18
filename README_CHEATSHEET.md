# Tägliche Workflows & Entwickler-Cheatsheet

Dieses Dokument bündelt Befehle für den Entwicklungsalltag und die Problembehebung. Den Ablauf beschreibt der [Workflow](README_WORKFLOW.md), die Einrichtung das [Workspace-Setup](README_WORKSPACE_SETUP.md) und die Prüfstrategie der [Testing-Leitfaden](README_TESTING.md).

---

## 1. Schnelles Alltags-Cheatsheet (Terminal & Skripte)

Die folgenden Befehle sind als schnelle Referenz gedacht.

### 1.1 Lokale Entwicklungsserver
```bash
npm run dev                  # Startet Astro isoliert (Frontend/Doku) auf http://localhost:4321
npx netlify-cli dev          # Astro + Functions + lokale Blobs auf http://localhost:8888
npm run build                # Erzeugt einen produktionsreifen Static-Build im Ordner dist/
npm run preview              # Startet einen lokalen Webserver zur Vorschau des dist/-Builds
```

`git switch feat/netlify-blobs`: `.env` und Dashboard gemäß [Workspace-Setup](README_WORKSPACE_SETUP.md) separat anpassen. Den [Blob-Reset](features/README_FEAT_NETLIFYBLOB.md#architektur-und-datenfluss) nur für lokale Testdaten verwenden.

### 1.2 Statische Code-Hygiene & Typenprüfung
```bash
npm run lint                 # Führt den Biome-Linter aus (Syntax, Stil, ungenutzte Imports)
npm run format               # Schreibt Formatierungsanpassungen direkt in die Dateien
npm run check                # Prüft Astro-Templates, Frontmatter-Typen und Props (astro check)
npx tsc --noEmit             # Führt strikte TypeScript-Typprüfung im gesamten Projekt aus
```

### 1.3 Testpyramide & Verifikation
```bash
npm test                     # Führt alle Vitest-Tests einschließlich Dokumentationscheck aus
npm run test:watch           # Startet Tests im interaktiven Watch-Modus während des Programmierens
npm run test:unit            # Führt ausschließlich tests/music-notation.test.mjs aus
npm run test:component       # Führt isolierte DOM-/Komponententests mit happy-dom aus
npm run test:integration     # Führt die Beitragstests unter tests/integration/ aus
npm run build && npm run test:e2e # Prüft den aktuellen Build mit Playwright
npm run test:e2e:ui          # Öffnet das grafische Playwright Test-Dashboard
npm run test:visual          # E2E mit --update-snapshots; derzeit keine Snapshot-Assertions
```

### 1.4 Prüfungen im Alltag und am Branch-Ende
```bash
npm run validate             # Alltag: Stufe 0, plus gezielte Unit-Tests und bei Bedarf Stufe 2
npm run preflight            # Nur zum Branch-Abschluss:
                             # Ergebnisbericht zu Validierung, Vitest, Build, E2E, Lighthouse und Git-Diff
npm run audit                # Separates Dependency-Audit; nicht Teil des Preflights
npm run cleanup:check        # Nicht-destruktiver Bericht zu den fünf Cleanup-Schritten
```

Lighthouse lädt Berichte standardmäßig temporär öffentlich hoch. Lokale Ablage und Testgrenzen stehen im [Testing-Leitfaden](README_TESTING.md).

Für eine vollständige Repository-Bereinigung siehe [Cleanup-Anleitung](README_CLEANUP.md).

### MDX-Frontmatter: Seitenleisten

Die Einstellungen stehen zwischen den `---` am Anfang einer MDX-Seite:

```yaml
---
title: Meine Seite
template: doc
tableOfContents: false
---
```

- `template: doc` ist der Standard: Die linke Navigation bleibt sichtbar; das Inhaltsverzeichnis wird bei passenden Überschriften angezeigt.
- `tableOfContents: false` blendet das Inhaltsverzeichnis für diese Seite aus, nicht aber die linke Navigation. Auf Mobilgeräten ist die Navigation über das Menü erreichbar.
- `template: splash` verwendet ein breiteres Layout ohne linke Navigation und ohne Inhaltsverzeichnis.
- `sidebar: false` ist dafür keine gültige Einstellung. `sidebar: { hidden: true }` entfernt stattdessen den Seiteneintrag aus automatisch erzeugten Navigationsgruppen.

Beispiel mit linker Navigation, aber ohne Inhaltsverzeichnis: [Lernpfad und Dashboard](src/content/docs/audio/theory/lernpfad.mdx).

### 1.5 Häufigste Git-Kommandos
```bash
git switch main              # Zurück zum Hauptbranch wechseln
git switch <branch-name>   # Zu einem vorhandenen Feature-Branch wechseln
git switch -c feat/<name>    # Neuen isolierten Feature-Branch erstellen und dorthin wechseln
git fetch origin             # Remote-Änderungen abfragen ohne lokalen Code zu verändern
git status                   # Zeigt modifizierte, gelöschte und ungetrackte Dateien an
git add .                    # Alle Änderungen für den nächsten Commit stagen
git commit -m "feat: text"   # Commit mit konventioneller Nachricht erstellen
git push -u origin <branch>  # Neuen lokalen Branch erstmals auf GitHub veröffentlichen
git push                     # Nachfolgende Commits auf den Tracking-Branch übertragen
git pull origin main         # Lokalen Stand mit dem Remote-Hauptbranch synchronisieren
git merge main               # Neueste Änderungen aus main in den aktuellen Feature-Branch holen
git reset HEAD~1             # Letzten Commit zurücknehmen (Dateiänderungen bleiben im Editor)
```

---

## 2. Feature entwickeln

Für den Ablauf von Branch-Erstellung über Tests und Cleanup bis zur Archivierung siehe [Workflow](README_WORKFLOW.md). Bei der Implementierung: Typen definieren, Logik in `src/lib/` schreiben, Tests ergänzen, UI-Komponenten kapseln und Inhalte in `src/content/docs/` anbinden. Architekturdetails stehen in [README_ASTROSTRUCTURE.md](README_ASTROSTRUCTURE.md).

---

### Branch umbenennen (lokaler Branch)

# 0. Prüfen, wo der Branch liegt
```bash
git branch -a
```

Die Liste unterscheidet lokale und Remote-Branches; ein Remote-Branch unter `remotes/` ist nicht automatisch lokal vorhanden.

# 1. Branch lokal auschecken
```bash
git checkout <branch-name>
```

# 2. Zurück auf main wechseln (falls gewünscht)
```bash
git checkout main
```

# 3. Nun lokal umbenennen
```bash
git branch -m <branch-name> archive/<branch-name>
```

# 4. Den neuen Branch pushen
```bash
git push origin -u archive/<branch-name>
```

# 5. Optional: Nach Prüfung des neuen Branches den alten Remote-Branch löschen
```bash
git push origin --delete <branch-name>
```


### Branch umbenennen (nur auf GitHub)

# 1. Den Remote-Branch unter neuem Namen pushen
```bash
git push origin origin/<branch-name>:refs/heads/archive/<branch-name>
```

# 2. Optional: Nach Prüfung des neuen Branches den alten Remote-Branch löschen
```bash
git push origin --delete <branch-name>
```


## 3. Notfall-Workflows & Problembehebung

Vor überschreibenden oder löschenden Befehlen den Arbeitsstand sichern und die Auswirkungen prüfen. `git reset --hard` und `git clean -fd` löschen lokale Änderungen beziehungsweise ungetrackte Dateien.

### Windows/Git-Lock-Datei blockiert
Wenn ein Prozess unerwartet abgebrochen wurde und Git blockiert ist:
```powershell
Remove-Item .git\index.lock -Force -ErrorAction SilentlyContinue
```

```bash
# Linux / macOS / Codespaces
rm -f .git/index.lock
```

### Lokalen Stand komplett verwerfen und mit GitHub synchronisieren
Falls sich dein lokaler Branch in einem inkonsistenten Zustand befindet:
```bash
git fetch origin
git reset --hard origin/<branch-name>
git clean -fd
```

### Letzten Commit korrigieren (noch nicht gepusht)
```bash
# Nur die Commit-Nachricht korrigieren:
git commit --amend -m "feat: korrigierte nachricht"

# Dateien vergessen? Datei stagen und Commit ergänzen:
git add <vergessene-datei>
git commit --amend --no-edit
```


## Worktree mit neuen Infos füllen

Die folgenden Restore- und Reset-Befehle können lokale Änderungen überschreiben oder löschen; vorher sichern.

### Älteren Branch aktivieren
```bash
git switch <aelteren-branch>
git fetch origin
```

### Arbeitsbaum gezielt mit dem Stand des Zielbranches auffüllen
```bash
git restore --source=origin/<aktuellsten-branch> --worktree -- .
```

### Rückgängig
Den älteren Branch als Ziel im [Notfall-Workflow](#lokalen-stand-komplett-verwerfen-und-mit-github-synchronisieren) verwenden. Dabei gehen lokale Änderungen und ungetrackte Dateien verloren.

### Bei Konflikt Commit zurück in Worktree holen
```bash
git reset --mixed HEAD~1
```
### Erst pullen, dann den worktree im stash wieder holen
```bash
git stash push -u
git pull --rebase
git stash pop
```