## TEIL 2: Entwickler-Workflows & Git-Cheatsheet

### 1. Start in einem neuen / geklonten Workspace

#### Anwendung starten (ohne Netlify)
Für reines Frontend- und Dokumentations-Testing:
```bash
npm install
npm run dev
```
*Startet den Astro-Devserver unter `http://localhost:4321`. Serverless Functions sind inaktiv.*

#### Anwendung starten (mit Netlify)
Für vollständige lokale Entwicklung inklusive Serverless Functions und Datenspeicherung:
```bash
npm install
npm run build
npx netlify-cli login
npx netlify-cli link
npx netlify-cli dev
```
*Startet Frontend und Netlify Functions synchron unter `http://localhost:8888`.*

---

### 2. Pre-Flight Qualitätsprüfung vor jedem Commit
Vor jedem Push müssen alle Prüfschritte lokal fehlerfrei mit Exit-Code `0` durchlaufen:
```bash
# 1. Linter & Formatter ausführen
npx @biomejs/biome check .

# 2. Astro Komponenten- und Typenprüfung
npx astro check

# 3. Strikte TypeScript-Prüfung
npx tsc --noEmit

# 4. Automatisierte Unit-Tests
npm test

# 5. Produktions-Build testen
npm run build

# 6. Whitespace- und Git-Konflikte prüfen
git diff --check
```

---

### 3. Git-Alltags-Workflows & Befehlsübersicht

#### Neuen Branch erstellen & wechseln
```bash
# Neuen Feature-Branch anlegen und direkt aktivieren
git switch -c <neuer-branch>

# Vorhandenen Branch wechseln
git switch main
git switch <neuer-branch>

# Alle lokalen und entfernten Branches anzeigen
git branch -a
```

#### Aktuellsten Branch holen
```bash
git fetch origin
git switch <aktuellsten-branch>
git reset --hard origin/<aktuellsten-branch>
```

#### Älteren Branch holen
```bash
git switch <älteren-branch>
git fetch origin
git reset --hard origin/<älteren-branch>
```

#### Älteren Branch holen und Worktree auffüllen zu aktuellstem Branch
```bash
git switch <älteren-branch>
git fetch origin
git reset --hard origin/<älteren-branch>
git restore --source=origin/<aktuellsten-branch> --worktree -- .
```
*Zusätzliche Aufräumbefehle:*
* **Löscht anstehende / ungetrackte Dateien:** `git clean -fd`
* **Löscht Push / setzt Arbeitsbaum zurück:** `git reset --hard origin/<älteren-branch>`

#### Commits löschen / zurücknehmen & HEAD-Erklärung
```bash
git reset HEAD~1
```
* **`HEAD`:** Zeiger auf deinen aktuellen Commit.
* **`HEAD~1`:** Direkter Vorgänger-Commit (1 Schritt zurück).
* **`HEAD~2`:** Vor-Vorgänger-Commit (2 Schritte zurück).
*(Die Code-Änderungen bleiben bei `git reset HEAD~1` im Arbeitsverzeichnis erhalten).*

#### Auf Origin zurücksetzen
```bash
git reset --hard origin/<branch-name>
```
*(Verwirft alle lokalen Änderungen und setzt den Branch exakt auf den Remote-Stand).*

#### Mergen des Branch
```bash
# Neuesten Stand vom Server laden
git fetch origin

# Änderungen aus dem Remote-Main in den aktuellen Branch integrieren
git merge origin main
```

#### Sonstige Befehle (Archivieren, Löschen & Notfall-Fixes)
1. **Branch umbenennen / ins Archiv verschieben:**
   ```bash
   git branch -m <kopierter-branch> archive/<eingefügter-branch>
   ```
2. **Kopierten / archivierten Branch auf GitHub pushen:**
   ```bash
   git push origin -u archive/<eingefügter-branch>
   ```
3. **Branch auf dem Remote-Server löschen:**
   ```bash
   git push origin --delete <branch>
   ```
4. **Prozesse abbrechen und erzwungen auf main wechseln:**
   ```powershell
   Remove-Item .git\index.lock -Force -ErrorAction SilentlyContinue
   git checkout -f main
   ```
   *(Entfernt blockierende Lock-Dateien nach Terminal-Abstürzen und erzwingt den Wechsel auf `main`).*

---