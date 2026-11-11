# Tägliche Workflows & Entwickler-Cheatsheet

Dieses Dokument dient als tägliches Handbuch für die fortlaufende Entwicklung, Feature-Erstellung, Fehlersuche und Qualitätssicherung.

---

## 1. Schnelles Alltags-Cheatsheet (Terminal & Skripte)

Die folgende Tabelle bündelt alle im Entwickleralltag am häufigsten benötigten Befehle. Eine detaillierte Erläuterung der einzelnen Phasen und Workflows folgt direkt im Anschluss.

### 1.1 Lokale Entwicklungsserver
```bash
npm run dev                  # Startet Astro isoliert (Frontend/Doku) auf http://localhost:4321
npx netlify-cli dev          # Startet Fullstack-Umgebung (Astro + Functions) auf http://localhost:8888
npm run build                # Erzeugt einen produktionsreifen Static-Build im Ordner dist/
npm run preview              # Startet einen lokalen Webserver zur Vorschau des dist/-Builds
```

### 1.2 Statische Code-Hygiene & Typenprüfung
```bash
npm run lint                 # Führt den Biome-Linter aus (Syntax, Stil, ungenutzte Imports)
npm run format               # Schreibt Formatierungsanpassungen direkt in die Dateien
npm run check                # Prüft Astro-Templates, Frontmatter-Typen und Props (astro check)
npx tsc --noEmit             # Führt strikte TypeScript-Typprüfung im gesamten Projekt aus
```

### 1.3 Testpyramide & Verifikation
```bash
npm test                     # Startet alle Unit-Tests via Node-Test-Runner / Vitest
npm run test:watch           # Startet Tests im interaktiven Watch-Modus während des Programmierens
npm run test:unit            # Führt gezielt Notations- und Rechenlogik-Tests aus
npm run test:component       # Führt isolierte DOM-/Komponententests mit happy-dom aus
npm run test:integration     # Testet API-Handler und GitHub-Schnittstellen via Mocks
npm run test:e2e             # Startet automatisierte Playwright-Browsertests
npm run test:e2e:ui          # Öffnet das grafische Playwright Test-Dashboard
npm run test:visual          # Aktualisiert visuelle Golden-Master-Screenshots
```

### 1.4 Das zentrale Pre-Flight Quality Gate
```bash
npm run preflight            # Kombinierte Kette vor jedem Push / Pull Request:
                             # Lint -> Check -> tsc -> Audit -> Test -> Build -> Git-Diff
```

### 1.5 Häufigste Git-Kommandos
```bash
git switch main              # Zurück zum Hauptbranch wechseln
git switch <branch-name>   # Zu einem vorhandenen Feature-Branch wechseln
git switch -c feature/<name> # Neuen isolierten Feature-Branch erstellen und dorthin wechseln
git fetch origin             # Remote-Änderungen abfragen ohne lokalen Code zu veränder
n
git status                   # Zeigt modifizierte, gelöschte und ungetrackte Dateien an
git add .                    # Alle Änderungen für den nächsten Commit stagen
git commit -m "feat: text"   # Commit mit konventioneller Nachricht erstellen
git push -u origin <branch>  # Neuen lokalen Branch erstmals auf GitHub veröffentlichen
git push                     # Nachfolgende Commits auf den Tracking-Branch übertragen
git pull origin main         # Lokalen Stand mit dem Remote-Hauptbranch synchronisieren
git merge main               # Neueste Änderungen aus main in den aktuellen Feature-Branch holen
git reset HEAD~1             # Letzten Commit verwerfen (Dateiänderungen bleiben im Editor)
git reset --hard origin/<b.> # Lokalen Branch hart mit dem Remote-Stand überschreiben (Vorsicht!)
git clean -fd                # Alle ungetrackten Dateien und Verzeichnisse restlos löschen
```

---

## 2. Der 4-Stufen Feature-Entwicklungszyklus

Um Regressionsfehler, fehlerhafte Seiten-Builds und instabile Zustände auf `main` zu verhindern, wird ausnahmslos der folgende strukturierte Entwicklungszyklus angewandt:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ STUFE 1: Feature-Branch isolieren                                          │
│ └── Ausgehend von einem sauberen 'main' isoliert abzweigen.                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ STUFE 2: Feature modular entwickeln (Lego-Prinzip)                          │
│ └── Typdefinition -> Reines TS/Logik -> Tests -> UI-Komponente -> Doku.    │
├─────────────────────────────────────────────────────────────────────────────┤
│ STUFE 3: Lokales Quality Gate ausführen                                    │
│ └── Statische Analyse -> Unit-Tests -> Build-Test -> Git-Diff.              │
├─────────────────────────────────────────────────────────────────────────────┤
│ STUFE 4: Integration via Pull Request & Deploy Preview                      │
│ └── Netlify Deploy Preview im Browser prüfen -> Merge nach main.           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Stufe 1: Feature-Branch vorbereiten
Arbeite niemals direkt auf dem Branch `main`. Stelle vor Beginn sicher, dass dein lokaler Hauptbranch aktuell ist:
```bash
git switch main
git pull origin main
git switch -c feature/mein-neues-feature
```

### Stufe 2: Feature entwickeln (Reihenfolge einhalten)
1. **Typen definieren (`src/lib/` oder `src/types/`):** Definiere Schnittstellen, Interfaces und Schemata.
2. **Reine Logik schreiben (`src/lib/`):** Schreibe zustandslose Berechnungen und Algorithmen in reinem TypeScript – frei von UI- oder Astro-Abhängigkeiten.
3. **Unit-Tests anlegen (`tests/`):** Führe Tests begleitend im Watch-Modus aus:
   ```bash
   npm run test:watch
   ```
4. **UI-Komponente kapseln (`src/components/`):** Erstelle die `.astro`-Komponente, die als Bindeglied dient, Logik einbindet und visuelles Markup erzeugt.
5. **Inhalt / Dokumentation anbinden (`src/content/docs/`):** Binde die Komponente deklarativ in Markdown/MDX ein.

### Stufe 3: Qualitätssicherung vor dem Commit
Führe vor dem Festschreiben von Code die statischen Prüfungen durch:
```bash
# 1. Formatierung und Linting
npm run format
npm run lint

# 2. Astro- und TypeScript-Prüfung
npm run check
npx tsc --noEmit

# 3. Alle Unit- und Komponententests
npm test

# 4. Probe-Build zur Absicherung der Static Site Generation
npm run build
```

### Stufe 4: Veröffentlichen & Mergen
Wenn alle Tests grün sind, übertrage den Branch auf GitHub und erstelle einen Pull Request:
```bash
git add .
git commit -m "feat(notation): neue akkordtransponierung hinzugefuegt"
git push -u origin feature/mein-neues-feature
```
* **Deploy Preview:** Öffne die von Netlify im PR generierte Vorschau-URL und prüfe die Komponente auf Desktop und Mobilgeräten.
* **Merge:** Nach erfolgreicher visueller und automatisierter Prüfung mergst du den Pull Request in `main`.

---

### Stufe 5: Branch umbenennen ( wenn Branch lokal ist)

# 0. Prüfen wo der Branch liegt
git branch -a

Wenn Branch in der Liste nur in Rot angezeigt wird, ist er nicht lokal

# 1. Branch lokal auschecken
git checkout <branch-name>

# 2. Zurück auf main wechseln (falls gewünscht)
git checkout main

# 3. Nun lokal umbenennen
git branch -m <branch-name> archive/<branch-name>

# 4. Den neuen Branch pushen
git push origin -u archive/<branch-name>

# 5. Den alten Remote-Branch löschen
git push origin --delete <branch-name>


### Branch umbenennen ( wenn Branch nur auf Github ist)

# 1. Den Remote-Branch unter neuem Namen pushen
git push origin origin/<branch-name>:refs/heads/archive/<branch-name>

# 2. Den alten Remote-Branch löschen
git push origin --delete <branch-name>


## 3. Notfall-Workflows & Problembehebung

### Windows/Git-Lock-Datei blockiert
Wenn ein Prozess unerwartet abgebrochen wurde und Git blockiert ist:
```powershell
Remove-Item .git\index.lock -Force -ErrorAction SilentlyContinue
```

```bash
# Linux / macOS / Codespaces
rm -f .git/index.lock
git checkout -f main
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

### Älteren Branch aktivieren
git switch <aelteren-branch>
git fetch origin

### Arbeitsbaum gezielt mit dem Stand des Zielbranches auffüllen
git restore --source=origin/<aktuellsten-branch> --worktree -- .

### Rückgängig
```bash
git reset --hard origin/<aelteren-branch>
git clean -fd
```