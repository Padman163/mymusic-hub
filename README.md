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
| [README_WORKSPACE_SETUP.md](README_WORKSPACE_SETUP.md) | Einrichtung, Netlify und Umgebungsvariablen |
| [README_FEATURES.md](README_FEATURES.md) | Funktionen und Fachmodule |
| [README_FEAT_MODULEBUILDER.md](README_FEAT_MODULEBUILDER.md) | Lernpfad und Autorenwerkbank |
| [README_CLEANUP.md](README_CLEANUP.md) | Wiederholbare Repository-Bereinigung in fünf Schritten |
| [README_WORKFLOW.md](README_WORKFLOW.md) | Persönlicher Entwicklungs- und Archivierungsablauf |
| [README_NOTATION.md](README_NOTATION.md) | API und Architektur der Notation |
| [README_PROMPTS.md](README_PROMPTS.md) | Komponenten-Prompts |

---

## Qualitätssicherung (Pre-Flight)

Vor einem Push oder Pull Request das lokale Quality Gate ausführen:

```bash
npm run preflight
```
Details stehen im [Testing-Leitfaden](README_TESTING.md).

---

## Release-Checkliste

Die folgenden offenen Prüfpunkte fassen das [Release-Audit](README_TESTING.md#5-der-5-phasen-release-audit-vor-dem-release) zusammen; sie sind keine Aussage über den aktuellen Prüfstatus:

- [ ] Code-Hygiene, Tests und Build prüfen.
- [ ] Inhalte und Didaktik prüfen.
- [ ] Mobilgeräte und Browser prüfen.
- [ ] Performance, SEO und Barrierefreiheit prüfen.
- [ ] Rechtliches und Serverless-Infrastruktur prüfen.