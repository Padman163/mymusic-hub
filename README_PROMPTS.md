# Leitfaden: Komponenten-Architektur & Token-Sparende Copilot-Prompts

Dieses Dokument definiert die verbindliche Ordnerstruktur für Komponenten in `mymusic-hub` sowie standardisierte, hochgradig token-sparende Prompt-Templates für die tägliche Arbeit mit GitHub Copilot.

---

## 1. Verbindliche Ordnerstruktur

Um das **Lego- und Manager-Prinzip** strikt einzuhalten, werden Komponenten nach Verantwortlichkeit getrennt. Keine Komponente darf gleichzeitig Rendering-Mathematik, Datenhaltung und interaktive DOM-Events als Monolith bündeln.

```text
src/
├── components/notation/   # Notation, NotationVisual, NotationKeyboard, NotationBuilder
├── components/ui/         # Wiederverwendbare Anzeige-Bausteine
├── components/            # Weitere Komponenten, learning/ und project/
├── lib/                   # Renderer, musikalische Logik, Controller und Stores
└── styles/                # Gemeinsame Styles
tests/                     # Vitest- und Playwright-Tests
```

CSS-Regeln gehören in Dateien unter `src/styles/`, nicht in Komponenten. Dynamische Werte wie die Taktzahl und die berechnete Skalierung können weiterhin zur Laufzeit gesetzt werden.

---

## 2. Grundregeln für Token-Sparsamkeit in Copilot

1. **Kontext vorab einschränken:** Nutze in Copilot Chat gezielte Dateireferenzen (`#file:src/lib/notation-renderer.ts`) anstatt `@workspace`.
2. **Keine Höflichkeitsfloskeln:** Halte Prompts imperativ und stichpunktartig.
3. **Ausgabe-Format diktieren:** Verbiete Copilot ausdrücklich, unveränderten Code oder Begleitprosa zu wiederholen.
4. **Stufenweise bauen:** 
   * Schritt A: TypeScript-Interfaces & Types
   * Schritt B: Reine Berechnungslogik (`.ts`) + Unit-Test
   * Schritt C: Astro-Template (`.astro`)

---

## 3. Standard-Prompts für Copilot (Copy & Paste)

### Prompt 1: Neue Manager-Komponente anlegen (API & Props)
> **Zweck:** Erstellt das Gerüst einer Manager-Komponente, die schlanke Props für `.mdx`-Dateien entgegennimmt.

```markdown
Erstelle die Astro-Komponente `src/components/[Name]Pattern.astro`.

Anforderungen:
- Importiere Typen aus `src/lib/[modul].ts` falls nötig.
- Definiere ein striktes TypeScript-Interface `Props`.
- Props:
  - `title?: string`
  - `[SpezifischeProps]` (z.B. tempo, timeSignature, bars)
  - `interactive?: boolean` (Default: false)
- Trenne Strikt:
  1. Frontmatter (`---`): Props entpacken, Validierung, Berechnungs-Helfer aufrufen.
  2. Template: Barrierefreies HTML/SVG, CSS-Klassen statt Inline-Styles.
  3. Optionaler `<script>`-Block: Nur wenn `interactive === true`.
- Gib ausschließlich den vollständigen Code der Datei aus, keine Erklärungen davor oder danach.
```

---

### Prompt 2: Kleine Hilfs- / Präsentations-Komponente (Subkomponente)
> **Zweck:** Erstellt einen atomaren Baustein unter `src/components/notation/` oder `src/components/ui/`.

```markdown
Erstelle die Subkomponente `src/components/notation/[Name].astro`.

Zweck: Rendert ausschließlich [z.B. Taktstriche / Artikulationszeichen / Vorzeichen].
Vorgaben:
- Props-Interface:
  - `[prop1: typ]`
  - `[prop2: typ]`
- Nutze Klassen aus `src/styles/notation.css`.
- Keine globale State-Verwaltung, rein zustandslos (Pure Component).
- Falls Glyphen benötigt werden: Nutze vorhandene SMuFL-Helfer aus `src/lib/svg.ts` und den gemeinsamen Notationsrenderer.
- Gib nur den Code der Komponente aus.
```

---

### Prompt 3: Reine Berechnungslogik auslagern (`.ts`)
> **Zweck:** Schreibt reine TypeScript-Funktionen für `src/lib/` (ideal testbar).

```markdown
Erstelle das TypeScript-Modul `src/lib/[thema].ts`.

Aufgabe:
- Funktionen:
  1. `calculate[X](param: Typ): ReturnTyp`
  2. `validate[X](param: Typ): boolean`
- Exportiere alle Typen und Enums.
- Keine Abhängigkeiten zu Astro, React oder DOM-APIs (reine Funktionen).
- Randfälle absichern: ungültige Werte werfen Fehler oder liefern sichere Fallbacks.
- Gib nur den TypeScript-Code aus.
```

---

### Prompt 4: Unit-Test für Modul erstellen (Vitest)
> **Zweck:** Generiert sofortige Regressionstests mit Vitest.

```markdown
Erstelle die Testdatei `tests/[thema].test.ts` für `#file:src/lib/[thema].ts`.

Vorgaben:
- Verwende Vitest: `import { describe, it, expect } from 'vitest'`.
- Teste:
  1. Standardfälle (Happy Path)
  2. Grenzwerte und Edge Cases (0, negative Zahlen, leere Arrays)
  3. Fehlerbehandlung bei ungültigen Eingaben
- Muss ausführbar sein via: `npx vitest run tests/[thema].test.ts`.
- Gib nur den Code der Testdatei aus.
```

---

### Prompt 5: Komponente refaktorieren / optimieren (Diff-Modus)
> **Zweck:** Verhindert das Neugenerieren riesiger Dateien und spart bis zu 80 % Tokens.

```markdown
Refaktoriere `#file:src/components/[ZielDatei.astro]`.

Ziel: [Konkretes Ziel, z.B. Inline-Styles durch Klassen ersetzen / Logik in Helfer auslagern].
Regeln:
1. Verändere nicht die existierende Props-Schnittstelle.
2. Generiere NICHT die gesamte Datei neu.
3. Zeige mir ausschließlich:
   - Die neu hinzugefügten Imports
   - Die konkret geänderten Code-Abschnitte mit 2 Zeilen Kontext davor und danach.
```

---

### Prompt 6: Interaktivität via Client-Script ergänzen
> **Zweck:** Ergänzt clientseitige Interaktion (Klicks, Töne, Umschalten) ohne schwere Frameworks wie React/Vue.

```markdown
Ergänze in `#file:src/components/[Komponente.astro]` die clientseitige Interaktion.

Anforderungen:
- Schreibe einen isolierten `<script>`-Tag am Ende der Astro-Datei.
- Datenübergabe von Astro an JavaScript ausschließlich über `data-*`-Attribute am Wurzel-Element.
- Kapsle die Logik in eine Klasse oder Funktion, um Namensraum-Kollisionen bei mehrfacher Einbindung zu verhindern.
- Event-Handling über Event Delegation.
- Gib nur den `<script>`-Block aus.
```

---
