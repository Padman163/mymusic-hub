## Projektinstruktionen: Mein Musik-Hub

### Projekt und Referenzen
* Musiklern- und Dokumentationsplattform mit Astro Starlight, MDX und TypeScript. Abhängigkeiten und Skripte stehen in `package.json`.
* **Architektur & Struktur:** [README_ASTROSTRUCTURE.md](../README_ASTROSTRUCTURE.md).
* **Features & Subsysteme:** [README_FEAT.md](../features/README_FEAT.md), [Notations-API](../features/README_FEAT_NOTATION.md), [Modul-Builder & Lernpfad](../features/README_FEAT_MODULEBUILDER.md) und [Netlify Blobs](../features/README_FEAT_NETLIFYBLOB.md).
* **Setup, Tests & Workflow:** [README_WORKSPACE_SETUP.md](../README_WORKSPACE_SETUP.md), [README_TESTING.md](../README_TESTING.md) und [README_WORKFLOW.md](../README_WORKFLOW.md).

### Architektur und Umsetzung
* **Wiederverwendung & Kapselung:** Vor Änderungen vorhandene Komponenten, Controller und Stores in `src/lib/` und `src/components/` prüfen und wiederverwenden. Fachlogik und Zustandsverwaltung in `src/lib/` von DOM-Interaktion und Astro-Templates trennen.
* **Notationssystem:** Notationsdarstellungen ausschließlich über `src/lib/notation-renderer.ts` und Komponenten in `src/components/notation/` umsetzen. Den nativen SVG-Renderer strikt unabhängig von AlphaTab (`SheetMusicPlayer.astro`) und MusicXML halten.
* **Modul-Builder & Lernpfad:** Schemata (`src/lib/module-schema.ts`), Store (`src/lib/module-store.ts`), XP-Tags (`src/lib/xp-tags.ts`) und UI-Controller (`src/lib/module-builder-ui.ts`, `src/lib/module-player-ui.ts`) als zentrale Quellen nutzen.
* **Schlanke UI & MDX-Seiten:** Lektionsseiten in `src/content/docs/` deklarativ halten und wiederverwendbare Komponenten einbinden. Admin-Oberflächen (`ModuleBuilderForm`, `IssueTrackerForm`) nicht mit langen Handbuchtexten überladen – nutzerorientierte Bedienungsanleitungen gehören ins Wiki unter `src/content/docs/wiki/`.
* **Styling & Bundles:** Gemeinsame Styles unter `src/styles/` pflegen; bestehende lokale `<style>`-Blöcke und dynamische CSS-Variablen respektieren. KaTeX läuft über `remark-math` und `rehype-katex`; schwere Bibliotheken (AlphaTab, KaTeX) nur dort laden, wo sie benötigt werden.
* **Persistenz:** Netlify Functions (`netlify/functions/`) nutzen Netlify Blobs (`@netlify/blobs`); nur der reine Astro-Dev-Server nutzt für Module die lokale Datei-API.

### Testing, Dokumentation & Arbeitsweise
* **Test-Stack:** Unit- und DOM-Tests laufen über **Vitest + happy-dom** (`tests/`), E2E-Tests über **Playwright**, Link- und Skript-Prüfungen über `tests/documentation.test.ts`. Neue Funktionen und Bugfixes immer mit passenden Tests absichern.
* **Dokumentation (Single Source of Truth):** Technische Feature-Referenzen in `features/README_FEAT_<NAME>.md` pflegen und in `features/README_FEAT.md` verlinken. Für nutzerseitig bedienbare Features eine Anleitung im Wiki erstellen oder aktualisieren und mit der Oberfläche verknüpfen; keine redundanten Volltexte in `README.md` anlegen.
* **Keine Quellen-Zitate:** Keine HTML-Zitat-Tags, Fußnoten-Zitate oder generierte Quellenmarker in Code, Markdown-Dateien, Dokumentation oder Antworten ausgeben.
* **Token-Sparmodus:** Gezielte Diffs statt kompletter unveränderter Dateien ausgeben. Vor Feature-Abschluss `npm run preflight` (bzw. `npm test` und `npx astro check`) ausführen und nach Abschluss einer angeforderten Aufgabe stoppen.
