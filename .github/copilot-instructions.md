# Projektinstruktionen: Mein Musik-Hub

## Projekt und Referenzen

- Musiklern- und Dokumentationsplattform mit Astro Starlight, MDX und TypeScript. Abhängigkeiten und Skripte stehen in `package.json`.
- Architektur und Projektstruktur: [README_ASTROSTRUCTURE.md](../README_ASTROSTRUCTURE.md). Feature-Übersicht und Notationsreferenz: [README_FEAT.md](../features/README_FEAT.md) und [README_FEAT_NOTATION.md](../features/README_FEAT_NOTATION.md).
- Einrichtung und Teststrategie: [README_WORKSPACE_SETUP.md](../README_WORKSPACE_SETUP.md) und [README_TESTING.md](../README_TESTING.md). Den Entwicklungs- und Abschlussablauf beschreibt [README_WORKFLOW.md](../README_WORKFLOW.md).

## Architektur und Umsetzung

- Vor Änderungen vorhandene Komponenten, Helfer und Muster prüfen und wiederverwenden. Fachlogik nach Möglichkeit von Darstellung und DOM-Interaktion trennen; `src/lib/` enthält auch Controller und Stores.
- Notationsdarstellungen über den gemeinsamen Renderer `src/lib/notation-renderer.ts` und wiederverwendbare Komponenten in `src/components/notation/` und `src/components/ui/` umsetzen. Neue gemeinsame Glyphen und Positionierungsregeln zentral ergänzen, nicht in einzelnen Übersichten oder Quizzen duplizieren.
- Den nativen SVG-Renderer unabhängig von AlphaTab und MusicXML halten. `SheetMusicPlayer.astro` nutzt AlphaTab für Partituren; Audiowiedergabe benötigt eine SoundFont.
- Lektionsseiten in `src/content/docs/` möglichst übersichtlich halten und wiederverwendbare Darstellungen als Komponenten einbinden. Vorhandene lokale `<style>`-Blöcke und dynamische Inline-Werte sind Teil der bestehenden Architektur; gemeinsame Styles liegen unter `src/styles/`.
- KaTeX verarbeitet mathematische Ausdrücke über `remark-math` und `rehype-katex`. Große Bibliotheken nur dort einbinden, wo sie benötigt werden.
- Netlify Functions für Beiträge und Module verwenden Netlify Blobs (`@netlify/blobs`). Nur der reine Astro-Dev-Server nutzt für Module die lokale Datei-API; siehe [Blob-Referenz](../features/README_FEAT_NETLIFYBLOB.md).
- Änderungen gezielt halten, bestehendes Verhalten erhalten und relevante Dokumentation sowie geeignete Tests aktualisieren. Vor Feature-Abschluss das Quality Gate `npm run preflight` gemäß Workflow ausführen.

## Intervallfarben

Für Intervall-Darstellungen die bestehende Palette verwenden; sie beschreibt Intervallrollen, nicht beliebige Ton- oder UI-Farben.

| Intervall | Farbe |
| :--- | :--- |
| Grundton (`1`) | `#F38181` |
| Kleine Sekunde (`♭2`) | `#FFAAA6` |
| Große Sekunde (`2`) | `#F4C7AB` |
| Kleine Terz (`♭3`) | `#EAA0E3` |
| Große Terz (`3`) | `#D382DC` |
| Reine Quarte (`4`) | `#B862D3` |
| Tritonus (`♭5` / `♯4`) | `#7F8BE8` |
| Reine Quinte (`5`) | `#64C4ED` |
| Kleine Sexte (`♭6`) | `#52DEE5` |
| Große Sexte (`6`) | `#6BE4C6` |
| Kleine Septime (`♭7`) | `#83E8BA` |
| Große Septime (`7`) | `#CBDD7B` |

## Inhalte und Kommunikation

- Lehrinhalte auf Deutsch prägnant und fachlich korrekt schreiben; Tabellen, Listen und Formeln einsetzen, wenn sie das jeweilige Thema verständlicher machen.
- In Antworten Änderungen und Prüfergebnisse knapp zusammenfassen; unveränderte Dateien nicht vollständig wiedergeben, außer wenn ausdrücklich angefordert.
