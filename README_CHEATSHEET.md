# Tägliche Workflows & Entwickler-Cheatsheet

Dieses Dokument bündelt Befehle für den Entwicklungsalltag und die Problembehebung. Den Ablauf beschreibt der [Workflow](README_WORKFLOW.md), die Einrichtung das [Workspace-Setup](README_WORKSPACE_SETUP.md) und die Prüfstrategie der [Testing-Leitfaden](README_TESTING.md).

---

## 1. Entwicklung starten

### 1.1 Lokale Server
```bash
npm run dev                  # Startet Astro isoliert (Frontend/Doku) auf http://localhost:4321
npx netlify-cli dev          # Astro + Functions + lokale Blobs auf http://localhost:8888
npm run build                # Erzeugt einen produktionsreifen Static-Build im Ordner dist/
npm run preview              # Startet einen lokalen Webserver zur Vorschau des dist/-Builds
```

Bei Beiträgen und Modulen bestimmt `GITHUB_BRANCH` keinen Datenstand. `npx netlify-cli dev` verwendet einen dauerhaften lokalen Blob-Store unter `.netlify\blobs-serve\`; er überschreibt sich beim Branch-Wechsel nicht aus den versionierten Snapshots. Wenn der lokale Stand trotz aktuellem `data\blob-snapshot\` veraltet ist:

```powershell
# Netlify Dev zuerst vollständig stoppen, dann:
Remove-Item -Recurse -Force .netlify\blobs-serve
npx netlify-cli dev
```

Nur den lokalen Blob-Ordner löschen; er liegt in `.gitignore` und ist von den Netlify-Cloud-Daten getrennt. Beim Neustart werden vorhandene Keys aus `data\blob-snapshot\contributions.json` und `data\blob-snapshot\modules.json` initialisiert. Der Export `npx netlify-cli env:list --plain > .env` bleibt der Standardbefehl; unter Windows PowerShell 5.1 kann die Datei dabei jedoch UTF-16LE statt UTF-8 erhalten. Nur in diesem Fall die Datei als UTF-8 neu speichern; siehe [Workspace-Setup](README_WORKSPACE_SETUP.md) und die [Blob-Referenz](features/README_FEAT_NETLIFYBLOB.md#architektur-und-datenfluss).

### 1.2 Häufige Git-Kommandos

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

## 2. Inhalte und Features

Für den Ablauf von Branch-Erstellung bis zur Archivierung siehe [Workflow](README_WORKFLOW.md). Bei der Implementierung: Typen definieren, Logik in `src/lib/` schreiben, Tests ergänzen, UI-Komponenten kapseln und Inhalte in `src/content/docs/` anbinden. Architekturdetails stehen in [README_ASTROSTRUCTURE.md](README_ASTROSTRUCTURE.md).

### 2.1 MDX-Frontmatter und Seitenleisten

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

---

## 3. Branches umbenennen

### 3.1 Lokaler Branch

#### 3.1.1 Prüfen, wo der Branch liegt
```bash
git branch -a
```

Die Liste unterscheidet lokale und Remote-Branches; ein Remote-Branch unter `remotes/` ist nicht automatisch lokal vorhanden.

#### 3.1.2 Branch lokal auschecken
```bash
git checkout <branch-name>
```

#### 3.1.3 Zurück auf `main` wechseln (falls gewünscht)
```bash
git checkout main
```

#### 3.1.4 Branch lokal umbenennen
```bash
git branch -m <branch-name> archive/<branch-name>
```

#### 3.1.5 Neuen Branch pushen
```bash
git push origin -u archive/<branch-name>
```

#### 3.1.6 Alten Remote-Branch löschen (optional)
```bash
git push origin --delete <branch-name>
```


### 3.2 Branch nur auf GitHub umbenennen

#### 3.2.1 Remote-Branch unter neuem Namen pushen
```bash
git push origin origin/<branch-name>:refs/heads/archive/<branch-name>
```

#### 3.2.2 Alten Remote-Branch löschen (optional)
```bash
git push origin --delete <branch-name>
```


## 4. Problembehebung

Vor überschreibenden oder löschenden Befehlen den Arbeitsstand sichern und die Auswirkungen prüfen. `git reset --hard` und `git clean -fd` löschen lokale Änderungen beziehungsweise ungetrackte Dateien.

### 4.1 Windows/Git-Lock-Datei blockiert
Wenn ein Prozess unerwartet abgebrochen wurde und Git blockiert ist:
```powershell
Remove-Item .git\index.lock -Force -ErrorAction SilentlyContinue
```

```bash
# Linux / macOS / Codespaces
rm -f .git/index.lock
```

### 4.2 Lokalen Stand verwerfen und mit GitHub synchronisieren
Falls sich dein lokaler Branch in einem inkonsistenten Zustand befindet:
```bash
git fetch origin
git reset --hard origin/<branch-name>
git clean -fd
```

### 4.3 Letzten nicht gepushten Commit korrigieren
```bash
# Nur die Commit-Nachricht korrigieren:
git commit --amend -m "feat: korrigierte nachricht"

# Dateien vergessen? Datei stagen und Commit ergänzen:
git add <vergessene-datei>
git commit --amend --no-edit
```


### 4.4 Worktree mit anderem Branchstand füllen

Die folgenden Restore- und Reset-Befehle können lokale Änderungen überschreiben oder löschen; vorher sichern.

#### 4.4.1 Älteren Branch aktivieren
```bash
git switch <aelteren-branch>
git fetch origin
```

#### 4.4.2 Arbeitsbaum mit Zielbranch auffüllen
```bash
git restore --source=origin/<aktuellsten-branch> --worktree -- .
```

#### 4.4.3 Rückgängig machen
Den älteren Branch als Ziel im Abschnitt [Lokalen Stand verwerfen und mit GitHub synchronisieren](#42-lokalen-stand-verwerfen-und-mit-github-synchronisieren) verwenden. Dabei gehen lokale Änderungen und ungetrackte Dateien verloren.

#### 4.4.4 Commit bei Konflikt in den Worktree holen
```bash
git reset --mixed HEAD~1
```
#### 4.4.5 Stash vor `pull --rebase` wiederherstellen
```bash
git stash push -u
git pull --rebase
git stash pop
```