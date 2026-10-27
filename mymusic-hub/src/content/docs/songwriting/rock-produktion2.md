---
title: "Schritt 3: Produktion (Strophe & Vor-Refrain)"
---

Dieses Dokument beschreibt die MIDI- und VST-Programmierung der ersten 12 Takte (Strophe und Vor-Refrain). Das Ziel ist es, in der DAW gezielt Energie wegzunehmen und langsam wieder aufzubauen, um den Einstieg in das bestehende Refrain-Fundament massiv zu verstärken.


## 1. DAW-Vorbereitung und Projektanpassung

Da wir nach der „Hook-First“-Methode arbeiten und unser Refrain aus Schritt 1 bereits auf den ersten Takten liegt, müssen wir im Projektraum zunächst Platz für die neuen Abschnitte schaffen. 

* **Verschiebung im Arranger:** Alle vorhandenen MIDI-Blöcke (der komplette Refrain) werden markiert und auf **Takt 13** verschoben. 
* **Neuer Arbeitsbereich:** Der Schleifenbereich (Loop) wird nun von **Takt 1.01 bis Takt 13.01** (genau 12 Takte) gesetzt.
* **Spuren-Kontinuität:** Die Belegung und das Routing der fünf VST-Spuren bleiben identisch zu Schritt 1. Wir zeichnen lediglich neue MIDI-Informationen (Noten, Anschlagstärken und Tastenumschaltungen) in die nun leeren 12 Takte ein.

## 2. Arrangement-Struktur und Zeitachse

Um den Refrain musikalisch aufzuwerten, wird ihm ein 12-taktiger Aufbau vorangestellt. Die Energie wird in der Strophe stark reduziert (abgedämpfte Saiten, geringere Anschlagstärke) und im Vor-Refrain gezielt wieder aufgebaut, um sich im Refrain zu entladen.

| Songabschnitt | Takte | Harmonien (Akkorde) | Dynamik-Stufe | 
| :--- | :--- | :--- | :--- | 
| **Strophe** | 8 Takte | `Em - Em - C - C` (2x wiederholt) | 🟦 Niedrig (Zurückhaltend) | 
| **Vor-Refrain** | 4 Takte | `C - C - D - D` (1x) | 🟦🟦 Mittel (Steigend) | 
| *(Refrain)* | *8 Takte* | `Em - C - G - D` *(aus Schritt 1)* | 🟦🟦🟦🟦 Hoch (Explosion) | 


## 3. Schlagzeug (Spur 4: EZdrummer 3)

### 3.1 Strophe (Takt 1–8)

* **Grundrhythmus:** Das Muster aus dem Refrain (Kick auf 1 und 3, Snare auf 2 und 4, Achtel-Hi-Hat) wird 1:1 kopiert.

* **Anschlagstärke:** Die Energie wird deutlich reduziert. Alle Snare- und Hi-Hat-Noten werden markiert und die Anschlagstärke wird auf ca. **70–75** gesenkt. Die Bassdrum bleibt bei ca. **90**, um das Fundament zu sichern.

* **Ergebnis:** Der Rhythmus bleibt stabil, wirkt aber deutlich zurückhaltender und lässt Raum für den Gesang.

### 3.2 Vor-Refrain (Takt 9–12)

* **Takt 9 und 10 (C-Dur):** Das Muster der Strophe wird fortgeführt, die Anschlagstärke steigt leicht an (ca. **85**). Die Hi-Hat kann leicht geöffnet werden (`Hi-Hat - Open`).

* **Takt 11 und 12 (D-Dur / Der Spannungsaufbau):**

  * Programmierung eines klassischen Spannungs-Wirbels (Build-Up).

  * **Bassdrum und Snare:** Durchgehende Achtelnoten (jeweils 8 Schläge pro Takt).

  * **Anschlagstärke (Crescendo):** Die Anschlagstärke dieser Achtelnoten steigt von Takt 11 bis Ende Takt 12 linear von **70** hoch auf **115**. Das schiebt den Track massiv in den Refrain.

## 4. Bass (Spur 3: EZbass)

### 4.1 Strophe (Takt 1–8)

* **Töne:** `E1` (Takt 1–2 und 5–6) und `C1` (Takt 3–4 und 7–8) als durchgehende Achtelnoten.

* **Anschlagstärke:** Um der Strophe die Schwere zu nehmen, wird die Anschlagstärke von 102 auf ca. **85** gesenkt. Der Bass rückt klanglich in den Hintergrund.

### 4.2 Vor-Refrain (Takt 9–12)

* **Töne:** `C1` (Takt 9–10) und `D1` (Takt 11–12) als durchgehende Achtelnoten.

* **Anschlagstärke:** Kehrt zurück auf **102**. Das Fundament verdichtet sich, der Druck nimmt wieder zu.

## 5. Rhythmusgitarre (Spur 1: Shreddage 3 Hydra)

### 5.1 Strophe (Takt 1–8)

* **Akkorde:** `E5` (Takt 1–2, 5–6) und `C5` (Takt 3–4, 7–8) als durchgehende Achtelnoten.

* **Spielweise (Abgedämpft):** In der Tastenumschaltung (Keyswitch-Spur) wird für Takt 1 bis 8 eine durchgehende Steuernote auf **`C#-1`** gezeichnet. Shreddage 3 Hydra spielt nun stramme, perkussiv abgedämpfte Powerchords (Palm Muting).

* **Anschlagart:** `42 - Picking Mode: Down` (reine Abschläge) bleibt aktiviert. Die Anschlagstärke liegt bei ca. **85–90**.

### 5.2 Vor-Refrain (Takt 9–12)

* **Akkorde:** `C5` (Takt 9–10) und `D5` (Takt 11–12).

* **Spielweise (Offen):** Die Tastenumschaltung springt auf Schlag 1 in Takt 9 zurück auf **`C-1` (Sustain)**. Die Gitarre macht klanglich auf und drängt nach vorn. Die Anschlagstärke kehrt auf **102** zurück.

## 6. Leadgitarre (Spur 2: Shreddage 3 Hydra)

* **Takt 1 bis 12:** Komplett **stumm** (leeres Ereignis / keine MIDI-Noten).

* **Funktion:** Indem die Leadgitarre im gesamten ersten Teil pausiert, entsteht massiv Raum für den erzählenden Gesang. Ihr Einsatz ab Takt 13 (Refrain) wirkt dadurch umso wuchtiger und belohnender.

## 7. Gesang (Spur 5: Synthesizer V – Liam AI)

In der Strophe fungiert der Gesang als Geschichtenerzähler. Die Melodie liegt tief und rhythmisch eng am Beat. Im Vor-Refrain weiten sich die Notenwerte, und die Tonhöhe steigt stufenweise an, um den Höhepunkt des Refrains (das hohe `D4`) unüberhörbar vorzubereiten.

### 7.1 Strophe (Takt 1–8)

* **Melodieführung:** Tiefe, rhythmische Phrasierung mit Sprechgesang-Charakter. Die Töne bewegen sich ausschließlich zwischen dem Grundton `E3` und der Mollterz `G3`.

* **Rhythmik:** Überwiegend Viertel- und Achtelnoten, exakt auf den Zählzeiten, ohne lange gehaltene Vokale.

* **Text & Notenskizze (Mehrzeilige Eingabe `Strg + L`):**

  * Takt 1–4: `Look- ing in the mir- ror wait- ing for a sign` (Töne: E3 und G3 im Wechsel)

  * Takt 5–8: `Sha- dows all a- round us run- ning out of time` (Töne: E3 und G3 im Wechsel)

### 7.2 Vor-Refrain (Takt 9–12)

* **Melodieführung:** Die Töne werden länger (Viertel- und Halbe Noten) und die Tonhöhe steigt auf `A3` (über C-Dur) und `B3` (über D-Dur) an. Wir vermeiden ganz bewusst noch das `D4`, da dies exklusiv für die Explosion im Refrain reserviert ist.

* **Text & Notenskizze:**

  * Takt 9–10 (über C-Dur): `Hear the voic- es call- ing` (Gehaltener Zielton: `A3`)

  * Takt 11–12 (über D-Dur): `Leave it all be- hind` (Gehaltener Zielton: `B3`)

* **Ki-Parameter:** Durch die länger gehaltenen Noten auf `A3` und `B3` generiert Synthesizer V hier automatisch längere Vibrato-Kurven, die die steigende Intensität zum Refrain hin perfekt unterstützen.