# `<Notation />` – Vollständige Feature-Dokumentation & Cheat Sheet

Diese Dokumentation beschreibt die vereinheitlichte, deklarative **`<Notation />`**-Komponente (`src/components/notation/Notation.astro`) auf Basis des hauseigenen Bravura-SVG-Renderers (`src/lib/notation-renderer.ts` und `src/lib/system-layout.ts`).

---

## Inhaltsverzeichnis

1. [Architektur, Leitplanken & Invarianten](#1-architektur-leitplanken--invarianten)
2. [Schnellstart & Import in `.mdx`](#2-schnellstart--import-in-mdx)
3. [Cheat Sheet nach Bereichen](#3-cheat-sheet-nach-bereichen)
   - [3.1 Eingabe-Modi (`notes` vs. `measures`)](#31-eingabe-modi-notes-vs-measures)
   - [3.2 Layout, Zeilenumbruch, Taktbreiten & Skalierung](#32-layout-zeilenumbruch-taktbreiten--skalierung)
   - [3.3 Musikalischer Kontext & Vererbung (`clef`, `timeSignature`, `accidentals`)](#33-musikalischer-kontext--vererbung-clef-timesignature-accidentals)
   - [3.4 Kopfbereich & Takt-Metadaten (`title`, `subtitle`, `tempo`, `measureNumber`)](#34-kopfbereich--takt-metadaten-title-subtitle-tempo-measurenumber)
   - [3.5 Noten, Pausen, Tonhöhen (`step`) & Balkengruppen (`beamGroup`)](#35-noten-pausen-tonhöhen-step--balkengruppen-beamgroup)
   - [3.6 Artikulation & Bögen (`articulation`, `curves`)](#36-artikulation--bögen-articulation-curves)
   - [3.7 Taktstriche, Wiederholungen, Agogik & Dynamik (`hairpin`)](#37-taktstriche-wiederholungen-agogik--dynamik-hairpin)
4. [Tonhöhen-Referenz (`step`-Koordinatensystem)](#4-tonhöhen-referenz-step-koordinatensystem)
5. [Layout-Engine im Detail](#5-layout-engine-im-detail)
6. [Vertikale Sicherheitszonen & A4-Druck (`@media print`)](#6-vertikale-sicherheitszonen--a4-druck-media-print)
7. [Praxis-Rezepte (Copy & Paste MDX-Vorlagen)](#7-praxis-rezepte-copy--paste-mdx-vorlagen)
8. [Validierungsregeln & Fehlermeldungen](#8-validierungsregeln--fehlermeldungen)

---

## 1. Architektur, Leitplanken & Invarianten

Die `<Notation />`-Komponente folgt dem **Lego-Prinzip** des Projekts und kombiniert reine TypeScript-Layoutfunktionen mit schlanken Astro-Präsentationsbausteinen ohne externe Laufzeitabhängigkeiten (kein AlphaTab/MusicXML im SVG-Renderer):

```text
[ Notation.astro ]
       │
       ├──► normalizeNotationInput()     (Polymorphe Eingabe: notes → measures + Kontext-Vererbung)
       ├──► omitUnchangedTimeSignatures() (Unterdrückt identische Folge-Taktarten)
       ├──► arrangeNotationSystems()     (Zeilenumbruch, Vorzeichen-Fortführung, Spalten- & Blocksatz-Mathematik)
       │
       └──► [ NotationVisual.astro (embedded) ]
                   ├──► renderNotationSvg()  (Bravura-SVG: Linien, Schlüssel, Taktart, Noten, Balken, Bögen, Dynamik)
                   ├──► <MeasureNumber />    (Taktzahlen-Overlay)
                   ├──► <TempoLabel />       (Tempo-Overlay)
                   └──► <FinalBar />         (Doppelter Schlussstrich)
```

### Feste Layout-Invarianten
1. **Präfix-Reihenfolge am Takt-/Zeilenanfang:** Immer strikt **Notenschlüssel → Taktart → Tonartvorzeichnung → Wiederholungsanfang (`repeatStart`) → erste Note**.
2. **Tonart-Persistenz & Auflösungszeichen:** Tonartvorzeichnungen (`accidentals`) bleiben über Zeilenumbrüche hinweg aktiv und werden am Beginn jeder neuen Zeile automatisch wiederholt. Bei Tonartwechseln mitten im Stück setzt die Engine automatisch die erforderlichen Auflösungszeichen (`natural`).
3. **Taktart-Vererbung:** Eine gesetzte `timeSignature` gilt für die rhythmische Positionierung aller Folgetakte weiter (`layoutTimeSignature`), wird aber optisch nur bei Änderungen erneut gezeichnet.
4. **Spaltenweise Synchronisation (`firstNoteX`):** In mehrzeiligen Systemen werden die Startpositionen der ersten Noten spaltenweise über alle Zeilen hinweg synchronisiert.
5. **Standardmäßig kein horizontales Scrollen (`scrollable = false`):** Das Notensystem passt sich automatisch der verfügbaren Containerbreite an (`data-fit-to-width`).

---

## 2. Schnellstart & Import in `.mdx`

```mdx
import Notation from "../../../../../components/notation/Notation.astro";

{/* Einzeltakt-Kurzform */}
<Notation
  notes={[
    { duration: "quarter", step: 2 },
    { duration: "quarter", step: 4 },
    { duration: "half", step: 6 },
  ]}
/>
```

---

## 3. Cheat Sheet nach Bereichen

### 3.1 Eingabe-Modi (`notes` vs. `measures`)

`<Notation />` akzeptiert **entweder** `notes` (für einen einzelnen Takt) **oder** `measures` (für ein oder mehrere Takte). Die gleichzeitige Übergabe beider Props wird durch TypeScript verhindert.

| Prop | Typ | Pflicht | Beschreibung |
| :--- | :--- | :---: | :--- |
| `notes` | `NotationEvent[]` | Wahlweise (statt `measures`) | **Einzeltakt-Kurzform:** Erzeugt automatisch ein 1-Takt-System über die gesamte Zeile (`100 %`). Ohne explizite `timeSignature` wird keine Taktart gerendert. Alle Einzel-Takt-Props (`rightBarStyle`, `curves`, `hairpin` usw.) können direkt auf `<Notation />` gesetzt werden. |
| `measures` | `NotationMeasure[]` | Wahlweise (statt `notes`) | **Mehrtakt-Modus:** Array von Takt-Objekten (`{ notes: [...], ... }`). Unterstützt automatischen oder festen Zeilenumbruch, Taktnummerierung, Tonart-/Taktartwechsel und Zeilenausgleich. |

---

### 3.2 Layout, Zeilenumbruch, Taktbreiten & Skalierung

Steuert, wie Takte auf Zeilen umgebrochen, horizontal gewichtet und skaliert werden.

| Prop (auf `<Notation />`) | Typ | Standard | Beschreibung |
| :--- | :--- | :---: | :--- |
| `layout` | `'auto' \| number \| number[]` | `'auto'` | **Zeilenumbruch-Modus:**<br>• `'auto'`: Bricht Zeilen automatisch anhand der summierten Mindestbreite (`minWidth`) der Takte um (Standardbudget: `600px / scale`).<br>• `number` (z. B. `layout={3}`): Feste maximale Taktzahl pro Zeile. Hat die letzte Zeile weniger Takte, greift der proportionale Blocksatz-Ausgleich.<br>• `number[]` (z. B. `layout={[3, 1]}`): Explizite Taktanzahl für jede Zeile. Die Summe muss der Gesamtzahl der Takte entsprechen; jede so definierte Zeile gilt als vollständig (`100 %` Breite). |
| `measureWidth` | `'rhythmic' \| 'equal'` | `'rhythmic'` | **Spaltenbreiten-Modus innerhalb einer Zeile:**<br>• `'rhythmic'`: Takte erhalten Spaltengewichte proportional zu ihrer inhaltlichen/rhythmischen Mindestbreite (dichte Achteltakte bekommen mehr Platz als ein Takt mit einer ganzen Note).<br>• `'equal'`: Alle Takte einer Zeile sind exakt gleich breit (`1fr`), sodass die Taktstriche über mehrere Zeilen hinweg exakt vertikal untereinander stehen. |
| `stretchLastRow` | `boolean` | `false` | Wenn `true`, wird auch bei `layout="auto"` oder `layout={number}` eine unvollständige letzte Zeile auf volle `100 %` Zeilenbreite gestreckt (statt proportional begrenzt). |
| `pickup` | `boolean` | `false` | **Auftakt-Modus:** Prüft automatisch, dass sich der erste Takt (Auftakt) und der letzte Takt (Schlusstakt) exakt zu einem vollständigen Takt der aktiven `timeSignature` ergänzen (z. B. $\frac{1}{4} + \frac{3}{4} = \frac{4}{4}$), und berechnet deren `layoutTimeSignature` sowie ihre proportionalen Spaltenbreiten ($\text{Gewicht}_{\text{Auftakt}} + \text{Gewicht}_{\text{Schluss}} = 1{,}0\text{ Volltakt}$) automatisch ohne manuelle `spacing`-Werte. |
| `scale` | `number` | `1.0` | **Spatium-Skalierungsfaktor:** Skaliert das gesamte Notensystem relativ zum Basis-Linienabstand (`SPATIUM = 10px`). `scale={0.85}` verkleinert für kompakte Übersichten, `scale={1.25}` vergrößert für Detailbeispiele. |
| `compact` | `boolean` | `false` | **Kompakt-Modus:** Beschränkt das Notensystem auf seine minimale inhaltliche Breite (`fit-content`), statt die volle Zeilenbreite (`100 %`) auszufüllen. Ideal für Quiz-Fragen, Inline-Darstellungen oder kurze Notenbeispiele. |
| `scrollable` | `boolean` | `false` | • `false` (Standard): Horizontales Scrollen ist **deaktiviert** (`overflow-x: hidden`), das System skaliert bei schmalen Viewports verlustfrei in die Containerbreite (`data-fit-to-width`).<br>• `true`: Aktiviert bei Überbreite einen horizontalen Scrollbalken (`overflow-x: auto`). |

#### Takt-spezifische Breitensteuerung (innerhalb von `measures[...]`)

| Prop (auf `NotationMeasure`) | Typ | Standard | Beschreibung |
| :--- | :--- | :---: | :--- |
| `spacing` | `number \| 'rhythmic' \| 'equal'` | `undefined` | Überschreibt im `'rhythmic'`-Modus das berechnete Spaltengewicht (`columnWeight`) eines einzelnen Takts mit einem benutzerdefinierten numerischen Gewicht. |
| `noteStart` | `number` | `0` | Zusätzlicher linker Mindestabstand (in Pixeln) vor der ersten Note des Takts. |
| `firstNoteX` | `number` | automatisch | Erzwingt eine exakte X-Koordinate (in Pixeln) für die erste Note (muss $\ge$ `minimumFirstNoteX` sein). Wird im Mehrtaktbetrieb automatisch spaltenweise synchronisiert. |

---

### 3.3 Musikalischer Kontext & Vererbung (`clef`, `timeSignature`, `accidentals`)

Diese Props können sowohl **global auf `<Notation />`** (werden dann automatisch auf Takt 1 gesetzt und an Folgetakte vererbt) als auch **pro Takt in `measures[...]`** angegeben werden.

| Prop | Typ | Standard | Beschreibung |
| :--- | :--- | :---: | :--- |
| `clef` | `'treble' \| 'bass' \| false` | `'treble'` | **Notenschlüssel:**<br>• `'treble'`: Violinschlüssel (G-Schlüssel).<br>• `'bass'`: Bassschlüssel (F-Schlüssel).<br>• `false`: Kein Schlüssel (nur bei Einzelbeispielen ohne Zeilenumbruch möglich).<br>*Hinweis:* Pro Takt kann ein anderer Schlüssel übergeben werden (z. B. für Vergleiche mit `layout={1}`); bei Verwendung der Hilfsfunktion `assertNoClefChanges()` wird ein Schlüsselwechsel hingegen mit Validierungsfehler abgewiesen. |
| `timeSignature` | `{ numerator: number, denominator: number }` | `undefined` | **Sichtbare Taktartangabe:** z. B. `{{ numerator: 4, denominator: 4 }}` oder `{{ numerator: 6, denominator: 8 }}`. Der Zähler muss eine positive ganze Zahl, der Nenner eine Zweierpotenz ($1, 2, 4, 8, 16, \dots$) sein. Wird automatisch an Folgetakte vererbt und nur bei Taktartwechseln erneut gezeichnet. |
| `layoutTimeSignature` | `{ numerator: number, denominator: number }` | `undefined` | **Unsichtbare Taktart für die Rhythmus-Mathematik:** Positioniert Noten/Pausen im Takt exakt nach diesem Metrum (z. B. für unvollständige Takte oder Auftakte), **ohne** die Taktart-Ziffern im System zu zeichnen. |
| `accidentals` | `{ type: 'sharp' \| 'flat', step: number }[]` | `[]` | **Tonartvorzeichnung (Key Signature):** Array von Kreuzen (`'sharp'`) oder b-Vorzeichen (`'flat'`) mit ihrer vertikalen `step`-Position.<br>• Wird automatisch am Anfang jeder neuen Zeile wiederholt.<br>• Übergibt ein späterer Takt ein neues `accidentals`-Array, berechnet das Layout automatisch die nötigen Auflösungszeichen (`natural`).<br>• `accidentals: []` in einem späteren Takt löst alle bisherigen Vorzeichen nach C-Dur/a-Moll auf. |

**Typische Tonartvorzeichnungen im Violinschlüssel (`clef="treble"`):**
```ts
// G-Dur / e-Moll (1 Kreuz: Fis auf step 8)
accidentals={[{ type: "sharp", step: 8 }]}

// D-Dur / h-Moll (2 Kreuze: Fis auf step 8, Cis auf step 5)
accidentals={[{ type: "sharp", step: 8 }, { type: "sharp", step: 5 }]}

// F-Dur / d-Moll (1 b: B auf step 4)
accidentals={[{ type: "flat", step: 4 }]}

// B-Dur / g-Moll (2 b: B auf step 4, Es auf step 7)
accidentals={[{ type: "flat", step: 4 }, { type: "flat", step: 7 }]}
```

---

### 3.4 Kopfbereich & Takt-Metadaten (`title`, `subtitle`, `tempo`, `measureNumber`)

| Prop | Ebene | Typ | Beschreibung |
| :--- | :---: | :--- | :--- |
| `title` | `<Notation />` | `string` | Zentrierter Haupttitel im Kopfbereich oberhalb des ersten Notensystems. |
| `subtitle` | `<Notation />` | `string` | Zentrierter, kursiver Untertitel direkt unter `title`. |
| `tempo` | `<Notation />` oder `NotationMeasure` | `string` | **Tempobezeichnung** (z. B. `"Allegro"`, `"Moderato"`).<br>• Auf `<Notation />`: Erscheint linksbündig im Kopfbereich des Stücks.<br>• Auf einem Takt in `measures[...]`: Erscheint direkt über dem jeweiligen Takt (aktiviert automatisch die obere Safe-Zone der Zeile). |
| `tempoDetail` | `<Notation />` oder `NotationMeasure` | `string` | **Metronom-/Zusatzangabe** hinter `tempo` (z. B. `"♩ = 90"` → wird als `Allegro · ♩ = 90` gerendert). |
| `measureNumber` | `<Notation />` oder `NotationMeasure` | `string \| number` | **Taktzahl** links oben über dem Taktanfang (z. B. `1`, `5`, `"12a"`). Aktiviert automatisch die obere vertikale Sicherheitszone der Zeile und wird per `measureNumberOffset` dynamisch rechts hinter Schlüssel, Taktart, Vorzeichen und Wiederholungszeichen (`prefixEnd`) positioniert. |

---

### 3.5 Noten, Pausen, Tonhöhen (`step`) & Balkengruppen (`beamGroup`)

Jedes Element im `notes`-Array ist ein `NotationEvent` und gehört zu einer von **drei Varianten**:

#### Variante A: Rhythmische Note (Standardfall mit `duration`)
```ts
{
  duration: "whole" | "half" | "quarter" | "eighth" | "sixteenth",
  step: number,                  // Ganzzahl von -2 bis 10 (siehe Abschnitt 4)
  dotted?: boolean,              // Punktierung (verlängert den Wert um die Hälfte)
  accidental?: "sharp" | "natural" | "flat", // Versetzungszeichen direkt vor der Note
  beamGroup?: string,            // Balkengruppen-ID für Achtel/Sechzehntel
  articulation?: "staccato" | "tenuto" | "accent" | "marcato",
  articulationPosition?: "above" | "below",
  dynamic?: NotationDynamic,     // Standard-Dynamiksymbol oder -text (siehe Abschnitt 3.7)
  dynamicText?: string,          // Freier kursiver Dynamik-/Vortragstext (z. B. "cresc.", "dolce")
  hairpinStart?: "crescendo" | "decrescendo", // Startet eine Dynamikgabel an dieser Note (auch taktübergreifend)
  hairpinEnd?: boolean,          // Beendet die aktive Dynamikgabel an dieser Note
}
```

#### Variante B: Zeitlose didaktische Note (nur Notenkopf mit `type`, ohne Rhythmuswert)
Ideal für Tonleiter-, Intervall- oder Linien-Erklärungen, bei denen alle Notenköpfe gleichmäßig über den Takt verteilt werden:
```ts
{
  type: "filled" | "empty",      // "filled" = schwarzer Kopf, "empty" = hohler Kopf
  step: number,                  // Ganzzahl von -2 bis 10
  stem?: boolean,                // Optionaler Notenhals (Standard: false)
  accidental?: "sharp" | "natural" | "flat",
  articulation?: "staccato" | "tenuto" | "accent" | "marcato",
  articulationPosition?: "above" | "below",
  dynamic?: NotationDynamic,
  dynamicText?: string,
  hairpinStart?: "crescendo" | "decrescendo",
  hairpinEnd?: boolean,
}
```

#### Variante C: Pause (`type: "rest"`)
```ts
{
  type: "rest",
  duration: "whole" | "half" | "quarter" | "eighth" | "sixteenth",
  dotted?: boolean,              // Punktierte Pause
}
```
> **Besonderheit Ganze Pause:** Besteht ein Takt aus genau einer unpunktierten ganzen Pause (`[{ type: "rest", duration: "whole" }]`), wird sie nach klassischer Stichregel automatisch **exakt in der Taktmitte (`50 %`)** zentriert.

#### Regeln für Balkengruppen (`beamGroup`)
- Verbindet aufeinanderfolgende Achtel- (`"eighth"`) oder Sechzehntelnoten (`"sixteenth"`) mit einem gemeinsamen Balken statt einzelner Fähnchen.
- Unterstützt neben Noten desselben Werts auch die klassische punktierte Kombination **punktierte Achtel (`duration: "eighth", dotted: true`) + Sechzehntel (`duration: "sixteenth"`)** inklusive kurzem Sechzehntel-Teilbalken (Haken).
- Alle Noten mit derselben `beamGroup`-ID innerhalb eines Takts müssen:
  1. **direkt aufeinanderfolgen** (lückenlos),
  2. **denselben Notenwert** (`"eighth"` oder `"sixteenth"`) besitzen *oder* eine Kombination aus **punktierter Achtel + Sechzehntel** sein,
  3. **mindestens 2 Noten** umfassen.
- Alle Notenhälse einer `beamGroup` zeigen einheitlich in dieselbe Richtung: entschieden über die Mehrheit der Noten unter vs. auf/über der Mittellinie (`step: 4`), bei Gleichstand über die größte Entfernung zur Mittellinie und danach standardmäßig nach unten; die Balkensteigung wird linear zwischen der ersten und letzten Note berechnet.

---

### 3.6 Artikulation & Bögen (`articulation`, `curves`)

#### Artikulationszeichen (pro Note in `notes[...]`)

| Wert für `articulation` | Bezeichnung | Symbol-Verhalten |
| :--- | :--- | :--- |
| `'staccato'` | Staccato-Punkt | Kurzes Absetzen der Note. |
| `'tenuto'` | Tenuto-Strich | Volles Halten / leichtes Betonen der Note. |
| `'accent'` | Akzent (`>`) | Dynamische Betonung des Tonbeginns. |
| `'marcato'` | Marcato (`^`) | Starke, markante Betonung. |

- **`articulationPosition` (`'above' | 'below'`):** Optional. Standardmäßig wird die Artikulation auf der dem Notenhals abgewandten Seite (Notenkopfseite) platziert; bei expliziter Angabe auf der Halsseite wandert das Zeichen kollisionsfrei über/unter das Halsende.

#### Bögen (`curves` auf Takt- oder Top-Level-Ebene)

```ts
curves={[
  {
    from: number,                // Start-Notenindex im notes-Array (0-basiert)
    to: number,                  // Ziel-Notenindex im notes-Array (muss > from sein)
    type: "tie" | "slur",        // "tie" = Haltebogen, "slur" = Bindebogen (Legato)
    placement?: "above" | "below" // Optional; Standard richtet sich nach der Notenhöhe
  }
]}
```
- **`type: "tie"` (Haltebogen):** Verbindet zwei Noten gleicher Tonhöhe; darf **keine Pause** überspannen.
- **`type: "slur"` (Bindebogen):** Phrasierungs-/Legatobogen über zwei oder mehr Noten (darf Pausen zwischen Start- und Zielnote überspannen, muss aber an echten Noten beginnen und enden).

---

### 3.7 Taktstriche, Wiederholungen, Agogik & Dynamik (`hairpin`)

Alle folgenden Props können pro Takt (`measures[...]`) oder im Einzeltakt-Modus direkt auf `<Notation />` gesetzt werden:

| Prop | Typ | Standard | Beschreibung |
| :--- | :--- | :---: | :--- |
| `showLeftBar` | `boolean` | `false` | Zeichnet einen einfachen Taktstrich ganz links am Taktbeginn (`x = 0`). |
| `showRightBar` | `boolean` | `true` | Zeichnet den rechten Taktabschlussstrich (`x = 100%`). Wird bei `repeatEnd: true` automatisch durch das Wiederholungszeichen ersetzt. |
| `rightBarStyle` | `'single' \| 'final'` | `'single'` | • `'single'`: Einfacher Taktstrich.<br>• `'final'`: Doppelter Schlussstrich (dünne Linie + breiter Balken) am Taktende. Reserviert automatisch `8px` End-Clearance. |
| `repeatStart` | `boolean` | `false` | Zeichnet ein Wiederholungsanfangszeichen (`\|\|:`) direkt nach Schlüssel, Taktart und Vorzeichnung. |
| `repeatEnd` | `boolean` | `false` | Zeichnet ein Wiederholungsendezeichen (`:\|\|`) am rechten Taktrand und reserviert automatisch `16px` Platz vor den Punkten. |
| `ritAt` | `number` | `undefined` | 0-basierter Notenindex im Takt, über dem kursiv `rit.` (ritardando) gerendert wird. |
| `aTempoAt` | `number` | `undefined` | 0-basierter Notenindex im Takt, über dem kursiv `a tempo` gerendert wird. Wenn sowohl `ritAt` als auch `aTempoAt` im selben Takt gesetzt sind, müssen mindestens 2 Notenpositionen Abstand dazwischen liegen (`\|aTempoAt - ritAt\| >= 2`). |
| `hairpin` | `'crescendo' \| 'decrescendo' \| { type, from?, to? }` | `undefined` | Zeichnet unterhalb des Takts eine reine Dynamikgabel (`<` bzw. `>`) zwischen der ersten und letzten Note (oder optional zwischen den Notenindizes `from` und `to`). Vollständig unabhängig von Dynamikstufen (`dynamic` auf den einzelnen Noten). Hat die Start- oder Endnote ein `dynamic`-Zeichen (`p`, `f`, `mf` usw.), hält die Gabel automatisch horizontalen Abstand zum Symbol. |

#### Verfügbare Dynamik-Symbole & -Texte pro Note (`dynamic` & `dynamicText`)

| Kategorie | Werte für `dynamic` | Darstellung |
| :--- | :--- | :--- |
| **Lautstärkestufen (leise → laut)** | `'pppp'`, `'ppp'`, `'pp'`, `'p'`, `'mp'`, `'mf'`, `'pf'`, `'f'`, `'ff'`, `'fff'`, `'ffff'`, `'n'` (*niente*) | Offizielle Bravura-SMuFL-Glyphen (`U+E520`–`U+E531`), zentriert unter der Note. |
| **Akzent- & Impuls-Dynamik** | `'fp'` (*fortepiano*), `'fz'` (*forzando*), `'sf'` (*sforzando*), `'sfp'`, `'sfpp'`, `'sfz'` (*sforzato*), `'sffz'`, `'rf'`, `'rfz'` (*rinforzando*) | Offizielle Bravura-SMuFL-Glyphen (`U+E534`–`U+E53D`), zentriert unter der Note. |
| **Standard-Verlaufstexte** | `'cresc.'`, `'decresc.'`, `'dim.'`, `'poco cresc.'`, `'poco dim.'`, `'molto cresc.'`, `'molto dim.'`, `'più p'`, `'più f'`, `'sub. p'`, `'sub. f'`, `'sempre p'`, `'sempre f'` | Kursive Georgia-Serif-Vortragsbezeichnung unter der Note. |
| **Freier Zusatztext (`dynamicText`)** | Beliebiger `string` (z. B. `dynamicText: "poco a poco"`, `"dolce"`, `"espr."`) | Wird allein zentriert unter der Note gerendert oder – falls zusätzlich `dynamic` gesetzt ist (z. B. `dynamic: "p", dynamicText: "cresc."`) – direkt rechts neben dem Dynamiksymbol platziert. |

---

## 4. Tonhöhen-Referenz (`step`-Koordinatensystem)

Die vertikale Position jeder Note und jedes Vorzeichens wird über den ganzzahligen Parameter **`step`** (`-2` bis `10`) angegeben:
- **`step = 0`** ist die **unterste (1.) Notenlinie**.
- Jeder Schritt (`+1`) entspricht einem halben Spatium (`5px` bei `scale = 1.0`), wechselt also zwischen **Linie** (gerade Zahlen) und **Zwischenraum** (ungerade Zahlen).
- **`step = 4`** ist die **mittlere (3.) Notenlinie** (Umschaltpunkt für die automatische Halsrichtung: `step < 4` → Hals nach oben, `step >= 4` → Hals nach unten).
- **`step = -2`** und **`step = 10`** erhalten automatisch eine **Hilfslinie (Ledger Line)**.

| `step` | Geometrische Lage im Fünfliniensystem | Ton im Violinschlüssel (`treble`) | Ton im Bassschlüssel (`bass`) | ऑटो-Halsrichtung |
| :---: | :--- | :---: | :---: | :---: |
| **`10`** | 1. Hilfslinie **über** dem System | **A5** ($a''$) | **C4** ($c'$ – Schloss-C) | nach unten (`↓`) |
| **`9`** | Raum über der 5. Linie | **G5** ($g''$) | **B3** ($h$) | nach unten (`↓`) |
| **`8`** | **5. Linie (oberste Linie)** | **F5** ($f''$) | **A3** ($a$) | nach unten (`↓`) |
| **`7`** | 4. Zwischenraum | **E5** ($e''$) | **G3** ($g$) | nach unten (`↓`) |
| **`6`** | **4. Linie** | **D5** ($d''$) | **F3** ($f$) | nach unten (`↓`) |
| **`5`** | 3. Zwischenraum | **C5** ($c''$) | **E3** ($e$) | nach unten (`↓`) |
| **`4`** | **3. Linie (Mittellinie)** | **B4** ($h'$) | **D3** ($d$) | nach unten (`↓`) |
| **`3`** | 2. Zwischenraum | **A4** ($a'$ – Kammerton) | **C3** ($c$) | nach oben (`↑`) |
| **`2`** | **2. Linie (Notenschlüssel-Linie G)** | **G4** ($g'$) | **B2** ($H$) | nach oben (`↑`) |
| **`1`** | 1. Zwischenraum | **F4** ($f'$) | **A2** ($A$) | nach oben (`↑`) |
| **`0`** | **1. Linie (unterste Linie)** | **E4** ($e'$) | **G2** ($G$) | nach oben (`↑`) |
| **`-1`** | Raum unter der 1. Linie | **D4** ($d'$) | **F2** ($F$) | nach oben (`↑`) |
| **`-2`** | 1. Hilfslinie **unter** dem System | **C4** ($c'$ – Eingestrichenes C) | **E2** ($E$) | nach oben (`↑`) |

---

## 5. Layout-Engine im Detail

### 5.1 Berechnung der Mindestbreite (`estimateMeasureMinWidth`)
Für jeden Takt berechnet `system-layout.ts` vorab die kollisionsfreie Mindestbreite in Pixeln aus:
1. **Präfix-Breite (`firstNoteX`):** Notenschlüssel (`36px`), Taktart (`17px` pro Ziffernstelle + `10px`), Tonartvorzeichnung (`12px` pro Vorzeichen), Wiederholungsanfang (`12px`) sowie Sicherheitsabstand (`1.5 * NOTE_WIDTH = 20.25px`) plus linke Ausdehnung des ersten Events (inkl. Hilfslinie oder Versetzungszeichen).
2. **Rhythmischer Mindestabstand:** Für jedes benachbarte Event-Paar $(i-1, i)$ wird sichergestellt, dass zwischen dem rechten Rand von Event $i-1$ (inkl. Punktierung oder Fähnchen) und dem linken Rand von Event $i$ (inkl. Vorzeichen/Hilfslinie) mindestens `1 Spatium (10px)` freier Zwischenraum verbleibt:
   $$\text{minWidth} \ge \text{noteInset} + \text{endInset} + \frac{\text{right}_{i-1} + 10\text{px} + \text{left}_i}{\text{fraction}_i - \text{fraction}_{i-1}}$$
3. **End-Clearance (`endInset`):** Reserviert Platz zum rechten Taktstrich, Schlussstrich (`8px`) oder Wiederholungsende (`16px`).

### 5.2 Blocksatz-Ausgleich der letzten Zeile (`widthRatio`)
- **Volle Zeilen:** Strecken sich immer auf `100 %` der Systembreite (`widthRatio = 1`).
- **Unvollständige letzte Zeile** (bei `layout="auto"` oder `layout={number}`, wenn die letzte Zeile weniger Takte hat als die vollen Zeilen darüber):
  - Bei `measureWidth="equal"`: $\text{widthRatio} = \frac{\text{Takte der letzten Zeile}}{\text{Takte einer vollen Zeile}}$ (z. B. 1 Takt bei 3er-Zeilen → `33.33 %`, exakt deckungsgleich mit Spalte 1 darüber).
  - Bei `measureWidth="rhythmic"`: Proportional zum Verhältnis des Spaltengewichts der letzten Zeile zum Referenzgewicht einer vollen Zeile ($\text{widthRatio} < 1$).
- **Explizite Zeilen-Arrays (`layout={[3, 1]}`) oder `stretchLastRow={true}`:** Setzen `widthRatio = 1`, sodass sich der letzte Takt über die gesamten `100 %` der Zeile erstreckt.

---

## 6. Vertikale Sicherheitszonen & A4-Druck (`@media print`)

### 6.1 Vertikale Safe-Zones (in `src/styles/notation.css`)
Jede `.notation-row` prüft automatisch, welche Overlays in ihren Takten vorkommen, und reserviert nur bei Bedarf zusätzlichen vertikalen Raum:
- **`.has-row-measure-number`:** `+6px` oberer Puffer für Taktzahlen (`<MeasureNumber />`).
- **`.has-row-tempo`:** `+16px` oberer Puffer für Takt-Tempoangaben (`<TempoLabel />`).
- **`.has-row-hairpin`:** `+32px` unterer Puffer für Dynamikgabeln und `cresc.`/`decresc.`-Beschriftungen (im SVG gerendert über `dynamics.ts`).

### 6.2 A4-Druckoptimierung (`@media print`)
Beim Drucken oder PDF-Export im Browser greifen automatisch folgende Regeln:
- **Kein Zerschneiden von Systemen:** `break-inside: avoid` und `page-break-inside: avoid` auf `.notation-component` und jeder einzelnen `.notation-row`.
- **Reiner Notendruck ohne Web-Dekor:** Entfernt `border`, `border-radius`, `box-shadow`, Hintergrundfarben und horizontales Clipping (`overflow: visible !important`).
- **Tiefschwarzer Kontrast (`#000`):** Alle Notenlinien, Schlüssel, Notenköpfe, Hälse, Balken, Bögen, Dynamikgabeln und Texte werden auf reines `#000000` gesetzt.

---

## 7. Praxis-Rezepte (Copy & Paste MDX-Vorlagen)

### Rezept 1: Einzeltakt ohne Taktart (Didaktische Notenköpfe / Tonleiter)
```mdx
<Notation
  clef="treble"
  notes={[
    { type: "filled", step: -2 },
    { type: "filled", step: -1 },
    { type: "filled", step: 0 },
    { type: "filled", step: 1 },
    { type: "empty", step: 2, stem: true },
  ]}
/>
```

### Rezept 2: Rhythmischer Vergleich mit festem Spaltenraster (`measureWidth="equal"`)
Alle Taktstriche liegen exakt untereinander; die unvollständige zweite Zeile ist auf 1/3 Breite begrenzt:
```mdx
<Notation
  clef="treble"
  timeSignature={{ numerator: 4, denominator: 4 }}
  layout={3}
  measureWidth="equal"
  measures={[
    { notes: [{ duration: "whole", step: 2 }] },
    {
      notes: [
        { duration: "half", step: 2 },
        { duration: "half", step: 2 },
      ],
    },
    {
      notes: [
        { duration: "quarter", step: 2 },
        { duration: "quarter", step: 2 },
        { duration: "quarter", step: 2 },
        { duration: "quarter", step: 2 },
      ],
    },
    {
      rightBarStyle: "final",
      notes: [
        { duration: "eighth", step: 2, beamGroup: "b1" },
        { duration: "eighth", step: 2, beamGroup: "b1" },
        { duration: "eighth", step: 2, beamGroup: "b1" },
        { duration: "eighth", step: 2, beamGroup: "b1" },
        { duration: "eighth", step: 2, beamGroup: "b2" },
        { duration: "eighth", step: 2, beamGroup: "b2" },
        { duration: "eighth", step: 2, beamGroup: "b2" },
        { duration: "eighth", step: 2, beamGroup: "b2" },
      ],
    },
  ]}
/>
```
*(Tipp: Ersetze `layout={3}` durch `layout={[3, 1]}` oder ergänze `stretchLastRow`, damit der 4. Takt über die gesamte zweite Zeile läuft.)*

### Rezept 3: Komplettes Übungsstück mit Kopfbereich, Wiederholung, Bögen, Agogik & Dynamik
```mdx
<Notation
  title="Etüde in D-Dur"
  subtitle="Übung für Artikulation, Bögen und Dynamik"
  tempo="Allegro"
  tempoDetail="♩ = 108"
  clef="treble"
  timeSignature={{ numerator: 4, denominator: 4 }}
  accidentals={[
    { type: "sharp", step: 8 },
    { type: "sharp", step: 5 },
  ]}
  layout={2}
  measureWidth="rhythmic"
  measures={[
    {
      measureNumber: 1,
      repeatStart: true,
      hairpin: "crescendo",
      initialDynamic: "piano",
      curves: [{ from: 0, to: 1, type: "slur", placement: "above" }],
      notes: [
        { duration: "quarter", step: 1 },
        { duration: "quarter", step: 3 },
        { duration: "quarter", step: 5, articulation: "staccato" },
        { duration: "quarter", step: 6, articulation: "accent" },
      ],
    },
    {
      measureNumber: 2,
      repeatEnd: true,
      ritAt: 0,
      aTempoAt: 2,
      notes: [
        { duration: "quarter", step: 5, accidental: "natural" },
        { duration: "quarter", step: 4 },
        { duration: "half", step: 3, dotted: true },
      ],
    },
    {
      measureNumber: 3,
      timeSignature: { numerator: 3, denominator: 4 },
      accidentals: [],
      hairpin: "decrescendo",
      initialDynamic: "forte",
      rightBarStyle: "final",
      notes: [
        { duration: "half", step: 2 },
        { type: "rest", duration: "quarter" },
      ],
    },
  ]}
/>
```

---

## 8. Validierungsregeln & Fehlermeldungen

Der Renderer prüft beim Build/Dev-Lauf alle musikalischen Invarianten strikt ab und wirft sprechende deutsche Fehlermeldungen, wenn Daten inkonsistent sind:

| Bedingung | Fehlermeldung |
| :--- | :--- |
| `step` außerhalb von `-2..10` oder keine ganze Zahl | `Ungültige Notenposition: <step>.` |
| Zähler $\le 0$ oder Nenner keine Zweierpotenz | `Ungültige Taktart: Der Zähler muss eine positive ganze Zahl und der Nenner eine positive Zweierpotenz sein.` |
| Schlüsselwechsel bei Prüfung mit `assertNoClefChanges()` (z. B. `treble` → `bass`) | `Ein Notenschlüsselwechsel von treble zu bass ist im Notationsstück "Notensystem" nicht erlaubt.` |
| `natural` direkt in `accidentals` (Tonartvorzeichnung) übergeben | `Eine Tonartvorzeichnung darf nur Kreuze oder b-Vorzeichen enthalten.` *(Auflösungszeichen werden bei Tonartwechseln automatisch generiert.)* |
| `beamGroup` mit nur 1 Note oder nicht-benachbarten Noten | `Balkengruppe "<id>" benötigt mindestens zwei Noten.` / `... muss zusammenhängende Noten desselben Werts enthalten.` |
| `beamGroup` auf Viertel-/Halbenoten | `Balkengruppen benötigen einen Namen und dürfen nur Achtel- oder Sechzehntelnoten enthalten.` |
| Bogen (`curves`) startet oder endet an einer Pause | `Ein Bogen muss an Noten beginnen und enden, nicht an Pausen.` |
| Haltebogen (`type: "tie"`) überspannt eine Pause | `Ein Haltebogen darf keine Pause überspannen.` |
| `ritAt` und `aTempoAt` liegen zu nah beieinander | `Zwischen "rit." und "a tempo" müssen mindestens zwei Notenpositionen liegen.` |
| Summe von `layout={[...]}` stimmt nicht mit `measures.length` überein | `Die Taktzahlen der Systeme müssen zusammen alle Takte umfassen.` |
