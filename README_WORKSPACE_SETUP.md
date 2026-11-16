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

### Schritt 3: Basis-Frontend starten & prüfen (Isolierter Modus)
```bash
# Aktualisiert /.astro und startet die App ohne Netlify Functions
npm run dev
```
* **URL:** Öffne `http://localhost:4321` im Browser.
* **Was geprüft wird:** Lädt das Astro-Frontend? Werden Styles, die Starlight-Sidebar und statische Komponenten gerendert?
* **Warum dieser Schritt nötig ist:** Netlify Functions bleiben inaktiv. Die lokale Modul-API liest und schreibt `data/modules.json` direkt im Workspace, ohne GitHub-Token oder `GITHUB_BRANCH`.

### Schritt 4: Statische Hygiene & Code-Validierung prüfen und anpassen
Stelle sicher, dass im geklonten Branch keine Typen- oder Syntaxkonflikte vorliegen:
```bash
npm run validate
```
**Was geprüft wird:** 

```biome check .```: Prüft Code-Style, Formatting und Linter-Regeln. Enthält: ```biome lint .```

```astro check```: Validiert Astro-Templates, Props und TypeScript-Typen über das gesamte Projekt hinweg.

```tsc --noEmit```: Führt die echte Typüberprüfung über dein gesamtes Projekt hinweg durch. Das Flag --noEmit sorgt dafür, dass nur Fehler gemeldet werden, ohne kompilierte .js-Dateien auf die Festplatte zu schreiben.

```bash
npm run fix
```
**Was angepasst wird:** 

```biome check --write .```: Wendet automatische Korrekturen für all das an: Er formatiert den Code, sortiert Imports und behebt automatisch behebbare Linter-Warnungen direkt in den Dateien.

Verwende ```npm run fix``` im Alltag, um alles Automatische (Formatierung + sichere Lint-Korrekturen) auf einmal schreiben zu lassen.

Typfehler, die danach noch bei npm run validate durch astro check oder tsc gemeldet werden, müssen manuell behoben werden.

### Schritt 5: Netlify CLI verknüpfen, Umgebungsvariablen für das Backend einrichten & Fullstack starten
```bash
# Einmalige Authentifizierung im Browser
npx netlify-cli login

# Workspace mit deinem Netlify-Projekt verknüpfen
npx netlify-cli link
```

Trage die GitHub-Konfiguration in die lokale `.env` ein oder passe sie dort an:
```dotenv
GITHUB_REPOSITORY=Padman163/mymusic-hub
GITHUB_TOKEN=<github-token>
GITHUB_BRANCH=<aktuellen Branch>
GITHUB_DATA_PATH=data/contributions.json
GITHUB_MODULES_PATH=data/modules.json
```
* **Branch:** `GITHUB_BRANCH` bestimmt für beide Netlify Functions den GitHub-Branch zum Lesen und Schreiben von Beiträgen **und** Modulen. Er folgt nicht automatisch dem ausgecheckten Git-Branch. Für die Arbeit auf `<aktuellen Branch>` diesen Wert setzen; für einen anderen Ziel-Branch entsprechend ändern. Ohne Wert verwenden beide Functions `main`.
* **Dateien:** `GITHUB_DATA_PATH` und `GITHUB_MODULES_PATH` sind optional; die oben gezeigten Pfade sind die Standardwerte. Der Ziel-Branch muss die gewünschten Daten enthalten. API-Änderungen werden auf GitHub im konfigurierten Branch gespeichert und nicht automatisch in die lokale Arbeitsdatei übernommen.
* **Token:** Der GitHub-Token braucht Zugriff auf das Repository und Contents-Lese- und Schreibrechte. `.env` und Token nicht committen oder öffentlich teilen.
* **Netlify:** Die lokale `.env` konfiguriert nicht automatisch die veröffentlichte Website. Für das jeweilige Netlify-Deploy die entsprechenden Umgebungsvariablen dort separat setzen und danach neu deployen. Ein Branch-Wechsel betrifft beide Datenspeicher, auch auf der veröffentlichten Website.

```bash
# Verknüpfung und den im lokalen Netlify-Kontext wirksamen Branch prüfen
npx netlify-cli status
# Erstellung von .env im Projekt
npx netlify-cli env:list --plain > .env
# .env anpassen, damit Posts auf aktuellen Branch geladen werden und gezogen
GITHUB_BRANCH=<aktuellen Branch>


# Fullstack-Entwicklungsserver starten
npx netlify-cli dev
```
* **URL:** Öffne `http://localhost:8888`.
* **Warum dieser Schritt nötig ist:** Dieser Befehl führt das Astro-Frontend und die Netlify Functions zusammen. So lassen sich IssueTracker und Modul-API mit GitHub-Persistenz verwenden.
* **Prüfen:** `/api/modules` im Browser öffnen und die Modultitel mit der Datei im konfigurierten GitHub-Branch vergleichen. Fehlen `GITHUB_TOKEN` oder `GITHUB_REPOSITORY`, antworten die Functions mit HTTP 503.

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
