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

### Schritt 6: E2E-Testbrowser installieren (Optional)
Wenn End-to-End-Browsertests ausgeführt werden sollen:
```bash
npx playwright install --with-deps chromium
```

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
