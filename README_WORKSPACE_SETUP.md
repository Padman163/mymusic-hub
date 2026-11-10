# Workspace-Setup & Initialisierungs-Leitfaden

Dieser Leitfaden beschreibt Schritt für Schritt, wie ein bestehendes Projekt in einem neuen Workspace (z. B. GitHub Codespaces, Gitpod oder auf einem neuen Rechner) fehlerfrei eingerichtet wird. Er trennt den initialen Erstaufbau vom schnellen Alltagsstart.

---

## 1. Erstmaliges Setup (Schritt-für-Schritt)

Wenn du das Repository frisch geklont hast, aktiviere die Subsysteme in der folgenden Reihenfolge, um Fehlern gezielt vorzubeugen:

### Schritt 1: Laufzeitumgebung validieren
Astro, moderne ES-Module und der native Test-Runner setzen eine aktuelle Node.js-Laufzeitumgebung voraus:
```bash
node -v
npm -v
```
* **Anforderung:** Node.js $\ge 22.0.0$ und npm $\ge 10.0.0$.
* **Warum dieser Schritt nötig ist:** Veraltete Node-Versionen unterstützen native ES-Importe, moderne WebCrypto-APIs und den Node-Testrunner nicht, was zu Syntaxfehlern beim Build führt.

### Schritt 2: Abhängigkeiten installieren
```bash
npm install
```
* **Warum dieser Schritt nötig ist:** Ein frisch geklonter Workspace enthält keinen Ordner `node_modules/`. Dieser Befehl liest die `package-lock.json` ein und installiert exakt die benötigten Frameworks (Astro, Starlight, Sharp, KaTeX, Biome, Vitest, Playwright).

### Schritt 3: Basis-Frontend starten & prüfen (Isolierter Modus)
```bash
npm run dev
```
* **URL:** Öffne `http://localhost:4321` im Browser.
* **Was geprüft wird:** Lädt das Astro-Frontend? Werden Styles, die Starlight-Sidebar und statische Komponenten gerendert?
* **Warum dieser Schritt nötig ist:** Serverless Functions und externe APIs bleiben inaktiv. Du stellst sicher, dass die Kern-Anwendung fehlerfrei kompiliert, ohne von Backend-Token oder externen Diensten abhängig zu sein.

### Schritt 4: Statische Hygiene & Code-Validierung prüfen
Stelle sicher, dass im geklonten Branch keine Typen- oder Syntaxkonflikte vorliegen:
```bash
npm run validate
```
**Was geprüft wird:** 

```biome check .```: Prüft Code-Style, Formatting und Linter-Regeln.

```astro check```: Validiert Astro-Templates, Props und TypeScript-Typen über das gesamte Projekt hinweg.

### Schritt 5: Netlify CLI verknüpfen, Umgebungsvariablen für das Backend einrichten & Fullstack starten
```bash
# Einmalige Authentifizierung im Browser
npx netlify-cli login

# Workspace mit deinem Netlify-Projekt verknüpfen
npx netlify-cli link

# .env im Projekt erstellen lassen und GitHub-Infos eintragen lassen
npx netlify-cli env:list --plain > .env

# GitHub-API-Zugang für den IssueTracker / Datenspeicher werden in .env erstellt
GITHUB_TOKEN=ghp_deinPersoenlicherFineGrainedTokenHier
GITHUB_REPOSITORY=owner/repository-name
GITHUB_BRANCH=main
GITHUB_DATA_PATH=data/contributions.json

# Fullstack-Entwicklungsserver starten
npx netlify-cli dev
```
* **URL:** Öffne `http://localhost:8888`.
* **Warum dieser Schritt nötig ist:** Dieser Befehl führt das Astro-Frontend und die Serverless Functions synchron zusammen. Erst hier funktioniert der vollständige Lebenszyklus des IssueTrackers (Erstellen, Filtern, Checklisten abhaken).

* Die Netlify Function `netlify/functions/contributions.ts` benötigt Schreibrechte über die GitHub REST API, um Beiträge in `data/contributions.json` zu persistieren. Fehlen diese Schlüssel, antwortet die Schnittstelle mit HTTP 503.

### Schritt 6: E2E-Testbrowser & Lighthouse CI einrichten (Optional)

```bash
# 1. Chromium inklusive Systemabhängigkeiten für Playwright installieren
npx playwright install --with-deps chromium
npx playwright install --with-deps webkit

```

```bash

# 2. Lighthouse CI CLI installieren (falls noch nicht in devDependencies vorhanden)
npm install -D @lhci/cli@latest

#create lighthouserc.cjs
module.exports = {
  ci: {
    collect: {
      // Testet direkt den generierten Astro-Build-Ordner ohne separaten Server-Prozess
      staticDistDir: './dist',
      numberOfRuns: 1,
      settings: {
        // Unverzichtbar in Linux-Container-/Codespace-Umgebungen
        chromeFlags: '--no-sandbox --headless --disable-gpu',
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', { minScore: 0.8 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['warn', { minScore: 0.9 }],
        'categories:seo': ['warn', { minScore: 0.9 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};

#create CHROME_PATH
export CHROME_PATH=$(node -p "require('@playwright/test').chromium.executablePath()")
```

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
