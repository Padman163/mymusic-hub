# Workspace-Setup & Initialisierungs-Leitfaden

Dieser Leitfaden beschreibt Schritt für Schritt, wie ein bestehendes Projekt in einem neuen Workspace (z. B. GitHub Codespaces, Gitpod oder auf einem neuen Rechner) fehlerfrei eingerichtet wird. Er trennt den initialen Erstaufbau vom schnellen Alltagsstart.

---

## 1. Erstmaliges Setup (Schritt-für-Schritt)

```bash
cd <FOLDER>
git clone <REPO_URL>
cd <REPO_VERZEICHNIS>
git switch main
git fetch origin
```

Wenn du das Repository frisch geklont hast, aktiviere die Subsysteme in der folgenden Reihenfolge, um Fehlern gezielt vorzubeugen:

### Schritt 1: Laufzeitumgebung validieren
Astro und Vitest setzen eine aktuelle Node.js-Laufzeitumgebung voraus:
```bash
node -v
npm -v
```
* **Anforderung:** Node.js 24 LTS und npm 10 oder neuer; die genauen Anforderungen stehen in den `engines` der installierten Abhängigkeiten.
* **Warum dieser Schritt nötig ist:** Veraltete Laufzeitversionen können mit Astro oder Vitest inkompatibel sein.

### Schritt 2: Abhängigkeiten installieren
```bash
# Installiert /node_modules
npm install

```
* **Warum dieser Schritt nötig ist:** Ein frisch geklonter Workspace enthält keinen Ordner `node_modules/`. Der Befehl installiert die Abhängigkeiten anhand von `package.json` und `package-lock.json`.
* **Netlify Blobs:** `@netlify/blobs` wurde mit `npm install @netlify/blobs` ins Projekt aufgenommen und wird beim normalen Setup mitinstalliert.

### Schritt 3: Basis-Frontend starten & prüfen (Isolierter Modus)
```bash
# Aktualisiert /.astro und startet die App ohne Netlify Functions
npm run dev
```
* **URL:** Öffne `http://localhost:4321` im Browser.
* **Was geprüft wird:** Lädt das Astro-Frontend? Werden Styles, die Starlight-Sidebar und statische Komponenten gerendert?
* **Warum dieser Schritt nötig ist:** Netlify Functions bleiben inaktiv. Die lokale Modul-API startet ohne Katalogdatei leer und erzeugt `data/modules.json` beim ersten Speichern. Die Datei bleibt lokal und wird nicht eingecheckt.

### Schritt 4: Prüfablauf beachten
Nach Änderungen im Workspace gelten die kurzen Prüfungen aus dem [Testing-Leitfaden](README_TESTING.md). Die statische Projektprüfung mit Biome, Astro und TypeScript (Stufe 0) läuft erst im manuell vom Nutzer gestarteten Preflight am Branch-Ende, nicht beim Workspace-Setup.

```bash
npm run fix
```
**Was angepasst wird:** 

```biome check --write .```: Wendet automatische Korrekturen für all das an: Er formatiert den Code, sortiert Imports und behebt automatisch behebbare Linter-Warnungen direkt in den Dateien.

Verwende ```npm run fix``` im Alltag, um alles Automatische (Formatierung + sichere Lint-Korrekturen) auf einmal schreiben zu lassen.

Typfehler, die Astro oder TypeScript im Preflight meldet, müssen manuell behoben werden.

### Schritt 5: Netlify CLI verknüpfen, Umgebungsvariablen für das Backend einrichten & Fullstack starten

```bash
# Einmalige Authentifizierung im Browser
npx netlify-cli login

# Workspace mit deinem Netlify-Projekt verknüpfen
npx netlify-cli link
```

Beiträge und Module verwenden Netlify Blobs; die ehemalige GitHub-basierte Datenspeicherung ist auf diesem Stand nicht mehr aktiv.

* **Workspace:** Die lokale `.env` kann mit `npx netlify-cli env:list --plain > .env` erzeugt werden. Die Datei liefert Umgebungswerte, ist aber nicht die Datenquelle der Netlify Blobs. `GITHUB_BRANCH`, `GITHUB_DATA_PATH`, `GITHUB_REPOSITORY` und `GITHUB_TOKEN` wählen bei Netlify Blobs weder Branch noch Datenstand. `.env` niemals committen oder mit geheimen Build-Token teilen.
* **Dashboard:** Unter **Site configuration → Build & deploy → Continuous deployment → Branches and deploy contexts** den gewünschten Branch freigeben bzw. bewusst als Production Branch setzen. `NETLIFY_AUTH_TOKEN` muss für Production, Deploy Previews und Branch Deploys als geheimes Build-Secret gesetzt sein, damit der Build den Snapshot synchronisieren kann. Es gehört nicht in die lokale `.env` oder ins Repository.
* **Kodierung unter Windows:** In Bash, Codespaces und PowerShell 7 ist der Export mit `npx netlify-cli env:list --plain > .env` in der Regel in Ordnung. Windows PowerShell 5.1 kann mit `>` jedoch UTF-16LE statt UTF-8 schreiben. Der Fehler liegt dann nicht am Netlify-Befehl, sondern an der Kodierung der umgeleiteten Datei. Falls die Datei als UTF-16LE vorliegt, kann sie nach dem Export explizit als UTF-8 ohne BOM neu geschrieben werden:

```powershell
$envText = npx netlify-cli env:list --plain
[IO.File]::WriteAllText(
  (Join-Path (Get-Location) '.env'),
  ($envText -join [Environment]::NewLine) + [Environment]::NewLine,
  (New-Object System.Text.UTF8Encoding($false))
)
```

Anschließend prüfen, dass keine geheimen oder abgelösten Werte versehentlich in `.env` übernommen wurden.

Die Details zum Datenumzug und zu gemeinsam genutzten Cloud-Daten stehen in der [Blob-Referenz](features/README_FEAT_NETLIFYBLOB.md).

```bash
# Umgebungsvariablen exportieren
npx netlify-cli env:list --plain > .env

# Projektverknüpfung prüfen
npx netlify-cli status

# Fullstack-Entwicklungsserver starten
npx netlify-cli dev
```
* **URL:** Öffne `http://localhost:8888`.
* **Lokaler Blob-Speicher:** Die CLI startet Astro, die Functions und einen lokalen Blob-Server. Dessen Daten bleiben unter `.netlify/` erhalten, in der aktuellen CLI unter `.netlify\blobs-serve\`. Dieser lokale Store wird nicht mit Netlify in der Cloud synchronisiert.
* **Initialisierung:** Nur wenn ein lokaler Key fehlt, wird er aus `data\blob-snapshot\contributions.json` beziehungsweise `data\blob-snapshot\modules.json` angelegt. Bereits vorhandene lokale Keys bleiben beim Neustart und Branch-Wechsel bestehen.
* **Prüfen:** `/api/modules` und `/api/contributions` auf Port 8888 aufrufen. Änderungen laufen über Blobs, nicht über den Astro-Datei-Fallback.

Zeigt Netlify Dev nach einem Branch-Wechsel weiterhin einen alten Datenstand, obwohl der versionierte Snapshot aktuell ist:

```powershell
# Netlify Dev zuerst vollständig stoppen und lokale Teständerungen sichern.
Remove-Item -Recurse -Force .netlify\blobs-serve

# Lokalen Store aus den Snapshots neu initialisieren.
npx netlify-cli dev
```

Nur den ignorierten lokalen Blob-Ordner zurücksetzen. Dabei niemals Cloud-Keys löschen; die Deploy-Preview und der siteweite Cloud-Store sind davon getrennt.

### Schritt 6: E2E-Testbrowser & Lighthouse CI einrichten (Optional)

```bash
# 1. Chromium inklusive Systemabhängigkeiten für Playwright installieren
npx playwright install --with-deps chromium
npx playwright install --with-deps webkit

```

Lighthouse CI ist bereits in den Entwicklungsabhängigkeiten und in `lighthouserc.cjs` konfiguriert. Nach `npm run build` startet `npm run audit:lhci` den Audit mit Playwright-Chromium. Die aktuelle Konfiguration lädt Berichte in einen temporären **öffentlichen** Speicher hoch; nur mit zur Veröffentlichung geeigneten Daten ausführen.

### Lighthouse CI: `autorun` im Detail

Der Befehl `lhci autorun` ist der primäre All-in-One-Ausführungsbefehl der **Lighthouse CI CLI (`@lhci/cli`)**. Anstatt einzelne Teilprozesse manuell im Terminal oder Skript zu verketten, steuert `autorun` den gesamten Lebenszyklus eines Audits als automatisierte 4-Phasen-Pipeline.

---

### Die 4 Phasen der Pipeline

```text
[ 1. healthcheck ] ──▶ [ 2. collect ] ──▶ [ 3. assert ] ──▶ [ 4. upload ]
```

### 1. `lhci healthcheck` (Umgebungsprüfung)
* **Ziel:** Sicherstellen, dass das System alle technischen Voraussetzungen für den Testlauf erfüllt.
* **Ablauf:**
  * Prüft, ob eine Konfigurationsdatei (`lighthouserc.cjs`, `lighthouserc.js` oder `lighthouserc.json`) existiert.
  * Validiert Schreibrechte für das lokale Arbeitsverzeichnis (`.lighthouseci/`).
  * Überprüft, ob ein lauffähiger Chrome- bzw. Chromium-Browser gefunden wird (z. B. via Systempfad oder `CHROME_PATH`).
* **Fehlerfall:** Fehlt eine Voraussetzung (z. B. Browser nicht auffindbar), bricht der gesamte Lauf sofort vor der Messung mit Exit-Code `1` ab.

---

### 2. `lhci collect` (Messungen durchführen)
* **Ziel:** Webseiten automatisiert aufrufen und Performance-/Qualitätsmetriken erheben.
* **Ablauf:**
  * **Server-Bereitstellung:** Startet entweder einen temporären integrierten Webserver für statische Dateien (`staticDistDir: './dist'`) oder wartet auf einen benutzerdefinierten Server-Befehl (`startServerCommand`).
  * **Headless-Browser:** Startet Chromium im Hintergrund mit den definierten Flags (z. B. `--no-sandbox --headless`).
  * **Messläufe:** Öffnet jede konfigurierte URL mehrfach (gesteuert durch `numberOfRuns`, Standard: `3`), um Schwankungen durch Netzwerklatenz oder CPU-Spikes zu mitteln.
  * **Artefakte:** Speichert Rohdaten (JSON-Auditdaten und interaktive HTML-Reports) lokal im Verzeichnis `.lighthouseci/`.

---

### 3. `lhci assert` (Qualitätsgrenzen prüfen)
* **Ziel:** Automatisierte Qualitätskontrolle gegen definierte Zielwerte (SLA/Budgets).
* **Ablauf:**
  * Vergleicht die aggregierten Messergebnisse mit den Regeln im Block `assert.assertions` der Konfiguration.
  * Unterscheidet zwischen zwei Eskalationsstufen:
    * `'warn'`: Gibt eine Warnung in gelber Schrift aus; der Build läuft weiter.
    * `'error'`: Markiert den Test als fehlgeschlagen (rotes Terminal-Highlight).
* **Auswirkung auf CI/CD:** Sobald eine einzige Assertion mit `'error'` fehlschlägt, beendet sich `lhci` mit einem Exit-Code ungleich 0 (`Exit Code 1`). In Plattformen wie GitHub Actions bricht der Job ab und markiert den Pull Request mit einem roten Statuskreuz.

---

### 4. `lhci upload` (Berichterstellung & Ablage)
* **Ziel:** Bereitstellung der Ergebnisse für Entwickler und Teams.
* **Optionen je nach Konfiguration:**
  * `target: 'temporary-public-storage'`: Lädt Berichte auf einen temporären Google-Cloud-Bucket hoch und generiert sofort anklickbare Links im Konsolen-Output (Verfallszeit: wenige Tage).
  * `target: 'lhci'`: Übermittelt Daten an einen selbst gehosteten Lighthouse CI Server für historische Trendanalysen.
  * `target: 'filesystem'`: Belässt die Berichte rein lokal zur Weiterverarbeitung.
* **GitHub Integration:** Kann Status-Checks oder Kommentare direkt an Pull Requests anhängen.

---

## 2. Der Alltägliche Start (Daily Routine)

Sobald der Workspace einmalig eingerichtet ist, genügen im Alltag wenige Befehle.

### Variante A: Reines Frontend & Dokumentation (Schnellstart)
Wenn du Lektionen schreibst, Komponenten layoutest oder CSS anpasst:
```bash
git pull origin main
npm run dev
```
* Öffne `http://localhost:4321`.
* Blitzschnelles Hot-Reloading, minimale Systemressourcen.

### Variante B: Fullstack mit Netlify Functions & IssueTracker
Wenn du an Serverless Endpunkten, Formularen oder Beitrags-Checklisten arbeitest:
```bash
git pull origin main
npx netlify-cli dev
```
* Öffne `http://localhost:8888`.
* Astro und Backend-Functions laufen parallel.
