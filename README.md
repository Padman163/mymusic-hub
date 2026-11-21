# Mein Musik-Hub

Modulare Lern- und Dokumentationsplattform für Musiktheorie, Gitarre und Songwriting auf Basis von Astro Starlight, Vektor-Notation und Serverless Functions.

---

## Schnellstart

```bash
npm install
npm run dev
```

Die Oberfläche läuft unter `http://localhost:4321`. Erst-Setup und Start mit Netlify Functions: [Workspace-Setup](README_WORKSPACE_SETUP.md).

---

## Dokumentation

| Dokument | Leitfaden & Zweck |
| :--- | :--- |
| [README_CHEATSHEET.md](README_CHEATSHEET.md) | Tägliche Befehle und Entwicklungsworkflows |
| [README_ASTROSTRUCTURE.md](README_ASTROSTRUCTURE.md) | Architektur und Projektstruktur |
| [README_TESTING.md](README_TESTING.md) | Teststrategie und Release-Audit |
| [README_WORKSPACE_SETUP.md](README_WORKSPACE_SETUP.md) | Einrichtung und Netlify |
| [README_FEAT.md](features/README_FEAT.md) | Übersicht über Funktionen und Fachmodule |
| [README_FEAT_AUTHENTICATION.md](features/README_FEAT_AUTHENTICATION.md) | Authentifizierung, Einladungen und kontogebundener Lernstand |
| [README_FEAT_AUDIOPLAYER.md](features/README_FEAT_AUDIOPLAYER.md) | Drum-Soundfiles, Spurauswahl und tempoabhängige Wiedergabe |
| [README_FEAT_CONTRIBUTIONS.md](features/README_FEAT_CONTRIBUTIONS.md) | Beiträge & IssueTracker – Erfassung, Filter, Checklisten und API |
| [README_FEAT_MODULEBUILDER.md](features/README_FEAT_MODULEBUILDER.md) | Module Builder – Autorenwerkbank & Lernpfad |
| [README_FEAT_NETLIFYBLOB.md](features/README_FEAT_NETLIFYBLOB.md) | Netlify Blobs – Einrichtung, Datenmigration und Abnahme |
| [README_FEAT_NOTATION.md](features/README_FEAT_NOTATION.md) | API und Architektur der Notation |
| [README_FEAT_XP-SYSTEM.md](features/README_FEAT_XP-SYSTEM.md) | XP-Engine, Humpa-Shop, Inventar und Studio |
| [Wiki: Beiträge verwalten](src/content/docs/wiki/beitraege.mdx) | Bedienungsanleitung für Nutzer |
| [Wiki: Datenstand & Backups](src/content/docs/wiki/datenstand-backups.mdx) | Online-Backups, Restore und Admin-Reset persönlicher Lernstände |
| [Wiki: Lernkonto](src/content/docs/wiki/lernstand-konto.mdx) | Anmeldung, Einladungen und geräteübergreifende Synchronisierung |
| [Wiki: Lernpfad & Dashboard](src/content/docs/wiki/lernpfad.mdx) | Lernpfad, Aufgaben, Hinweise und Abschluss-Quiz bedienen |
| [Wiki: Inventar, Shop & Studio](src/content/docs/wiki/inventar.mdx) | XP-Käufe im Humpa-Shop, Inventar und Studio-Ausrüstung |
| [README_CLEANUP.md](README_CLEANUP.md) | Wiederholbare Repository-Bereinigung in fünf Schritten |
| [README_WORKFLOW.md](README_WORKFLOW.md) | Persönlicher Entwicklungs- und Archivierungsablauf |
| [Copilot-Instruktionen](.github/copilot-instructions.md) | Repository-weite Projektregeln für Copilot |

---

## Qualitätssicherung (Pre-Flight)

Während der Entwicklung keine automatischen Tests nach einzelnen Änderungen. Copilot fragt nach jeweils zehn Nutzer-Prompts, ob Stufen 1 und 2 ausgeführt werden sollen, und wartet auf Zustimmung. Stufen 0, 3 und 4 laufen erst am Branch-Ende im manuell vom Nutzer gestarteten `npm run preflight`. Details und Befehle stehen im [Testing-Leitfaden](README_TESTING.md).