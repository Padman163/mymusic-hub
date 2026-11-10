# Mein Musik-Hub

> Modulare Lern- und Dokumentationsplattform für Musiktheorie, Gitarre und Songwriting auf Basis von Astro Starlight, Vektor-Notation und Serverless Functions.

---

## Schnellstart

Für den regulären Entwicklungsstart der Benutzeroberfläche:

```bash
# Abhängigkeiten installieren
npm install

# Lokalen Entwicklungsserver starten (UI & Dokumentation auf Port 4321)
npm run dev
```

*Für den Start inklusive Netlify Serverless Functions (Port 8888) und das Erst-Setup siehe [WORKSPACE_SETUP.md](WORKSPACE_SETUP.md).*

---

## Dokumentations-Hub & Führende Leitfäden

Alle ausführlichen Anleitungen, Architekturrichtlinien und Prüfpläne sind in spezialisierte Dokumente ausgelagert:

| Dokument | Leitfaden & Zweck |
| :--- | :--- |
| **[CHEATSHEET.md](CHEATSHEET.md)** | **Tägliche Workflows:** Terminal-Befehle, Git-Branching, Reset-Befehle, Pre-Flight Gate und 4-Stufen-Entwicklungszyklus. |
| **[ASTROSTRUCTURE.md](ASTROSTRUCTURE.md)** | **Architektur & Scaffolding:** Ordnerstruktur nach dem Lego-Prinzip, Content Collections, Zod-Schemas und Core-Konfigurationen (`astro.config.mjs`, `tsconfig.json`). |
| **[TESTING.md](TESTING.md)** | **Qualitätssicherung:** Vollständige Testpyramide (Biome, TypeScript, Vitest, happy-dom, Playwright, LHCI, npm audit) und 5-Phasen-Release-Audit samt Definition of Done. |
| **[WORKSPACE_SETUP.md](WORKSPACE_SETUP.md)** | **Workspace-Start:** Schrittweise Initialisierung frischer Umgebungen, Netlify CLI-Verknüpfung und Umgebungsvariablen (`.env`). |
| **[FEATURES.md](FEATURES.md)** | **App-Funktionen:** Detaillierte Beschreibung aller Fachmodule (SVG-Notationsrenderer, Fretboard-Visualizer, Pattern-Sequencer, AlphaTab-Player, IssueTracker). |
| **[.INSTRUCTIONS.md](.INSTRUCTIONS.md)** | **KI-Kontext:** Globale Systemregeln und Token-Sparrichtlinien für GitHub Copilot. |

---

## Qualitätssicherung (Pre-Flight)

Vor jedem Commit oder Pull Request muss das automatisierte Quality Gate lokal fehlerfrei durchlaufen:

```bash
npm run preflight
```
*(Ausführliche Test- und Audit-Details siehe [TESTING.md](TESTING.md)).*

---