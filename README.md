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
| [Wiki: Beiträge verwalten](src/content/docs/wiki/beitraege.mdx) | Bedienungsanleitung für Nutzer |
| [Wiki: Lernkonto](src/content/docs/wiki/lernstand-konto.mdx) | Anmeldung, Einladungen und geräteübergreifende Synchronisierung |
| [README_FEAT_MODULEBUILDER.md](features/README_FEAT_MODULEBUILDER.md) | Module Builder – Autorenwerkbank & Lernpfad |
| [README_FEAT_NETLIFYBLOB.md](features/README_FEAT_NETLIFYBLOB.md) | Netlify Blobs – Einrichtung, Datenmigration und Abnahme |
| [README_FEAT_NOTATION.md](features/README_FEAT_NOTATION.md) | API und Architektur der Notation |
| [README_CLEANUP.md](README_CLEANUP.md) | Wiederholbare Repository-Bereinigung in fünf Schritten |
| [README_WORKFLOW.md](README_WORKFLOW.md) | Persönlicher Entwicklungs- und Archivierungsablauf |
| [Copilot-Instruktionen](.github/copilot-instructions.md) | Repository-weite Projektregeln für Copilot |

---

## Qualitätssicherung (Pre-Flight)

Während der Entwicklung keine automatischen Tests nach einzelnen Änderungen. Copilot fragt nach jeweils zehn Nutzer-Prompts, ob Stufen 1 und 2 ausgeführt werden sollen, und wartet auf Zustimmung. Stufen 0, 3 und 4 laufen erst am Branch-Ende im manuell vom Nutzer gestarteten `npm run preflight`. Details und Befehle stehen im [Testing-Leitfaden](README_TESTING.md).

---

## Release-Checkliste

Beiträge, Lernmodule und persönliche Lernstände verwenden Netlify Blobs. Hinweise zu gemeinsamen Daten und zur Übernahme stehen in der [Blob-Referenz](features/README_FEAT_NETLIFYBLOB.md); Authentifizierung und Konten sind in der [Authentifizierungs-Referenz](features/README_FEAT_AUTHENTICATION.md) dokumentiert.

Die folgenden offenen Prüfpunkte fassen das [Release-Audit](README_TESTING.md#5-release-audit-vor-dem-release) zusammen; sie sind keine Aussage über den aktuellen Prüfstatus:

- [ ] Code-Hygiene, Tests und Build prüfen.
- [ ] Inhalte und Didaktik prüfen.
- [ ] Mobilgeräte und Browser prüfen.
- [ ] Performance, SEO und Barrierefreiheit prüfen.
- [ ] Rechtliches und Serverless-Infrastruktur prüfen.