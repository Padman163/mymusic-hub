# Audioplayer für Drum-Patterns

Technischer Slug: `audioplayer` (Branch `feat/audioplayer`).

Der Audioplayer erweitert die bestehende `DrumPattern.astro`-Komponente um
Soundfiles, polyphones Vorhören und eine tempoabhängige Loop-Wiedergabe.
Er verwendet ausschließlich die native Web Audio API, keine zusätzliche
Audio-Bibliothek, kein MusicXML und keine SoundFont. Nach Vorladen und
Browserfreigabe werden Sounds direkt aus dem Speicher gestartet; absolute
Latenzfreiheit des Browsers oder Audiogeräts wird nicht garantiert.

Bedienung: [Wiki: Drum-Pattern anhören](../src/content/docs/wiki/drum-pattern.mdx).
Ein eingebundenes Hörbeispiel steht auf der
[Feature-Seite](../src/content/docs/audio/referenzen-werkzeuge/visualisierungen-erklaert.mdx#drum-pattern-mit-soundfiles).

## Architektur und Einbindung

| Datei | Verantwortung |
| --- | --- |
| [`DrumPattern.astro`](../src/components/DrumPattern.astro) | Serverseitiges Raster, Audio-Datenattribute, lokale Styles und Initialisierung auf der Seite. |
| [`drum-audio.ts`](../src/lib/drum-audio.ts) | Gemeinsamer `DrumAudioEngine`: AudioContext, Laden, Decodieren, Cache, Gain und einzelne Soundquellen. |
| [`drum-playback.ts`](../src/lib/drum-playback.ts) | Tempo-Feld, Play/Stop, Haltewiedergabe, Spurauswahl, Scheduler und laufbezogener Abbruch. |
| [`drum-pattern.ts`](../src/lib/drum-pattern.ts) | Gemeinsamer DOM-Controller `initializeDrumPatterns`, dynamischer Rasteraufbau, Vorschautöne und Anschlag-Editor. |
| [`module-schema.ts`](../src/lib/module-schema.ts) | `DrumPatternProps`, `DrumPatternTrack`, Standardwerte und Validierung für gespeicherte Darstellungen. |
| [`module-theory-notation.ts`](../src/lib/module-theory-notation.ts) und [`module-player-ui.ts`](../src/lib/module-player-ui.ts) | Sichere Auswertung der DrumPattern-Props und Einbindung in Markdown, Builder-Vorschau und Lernpfad. |

Statische MDX-Einbindungen und dynamische Modulinhalte verwenden denselben
Controller und dieselbe Audio-Engine. Mehrfache Initialisierung bindet keine
doppelten Audio-Listener. Browser-Audio wird erst clientseitig angefordert;
SSR benötigt keinen `AudioContext`.

Die Sounds liegen als statische Dateien unter `public/sounds/drums/`.
Es gibt keinen Audio-Upload und keinen Medien-Blob-Store für dieses Feature.
Dateibestand, genaue Schreibweise und offene Lizenzangaben stehen in der
[Asset-Referenz](../public/sounds/drums/README.md).

## Props und Konfiguration

Die Props ergänzen das bestehende visuelle Raster abwärtskompatibel.

| Prop | Standard und Verhalten |
| --- | --- |
| `patternData[].soundUrl?: string` | Optionaler Sound pro Spur; beispielsweise `/sounds/drums/Kick.wav`. Ohne URL bleibt die Spur stumm. |
| `enableAudio?: boolean` | Automatisch aktiv, sobald eine Spur eine `soundUrl` hat. `false` deaktiviert Audio, Vorladen und Audio-Bedienelemente. Ohne Soundspur werden keine Audio-Bedienelemente erzeugt. |
| `patternData[].activeSteps` | Nullbasierte aktive Rasterpositionen. Nur diese Steps werden im Loop abgespielt; `eventPositions` sind visuelle Markierungen, keine zusätzlichen Audioereignisse. |
| `patternData[].velocities?: number[]` | Anschlag pro Step: `0` ist stumm, `127` volle Lautstärke. Fehlende Werte bedeuten für Audio volle Lautstärke. Der Anschlag-Editor aktualisiert auch die Audiowerte. |
| `bpm?: number` | `120`; endliche Zahl größer `0`, immer Viertelnoten pro Minute. Änderungen im sichtbaren Feld gelten lokal und werden nicht gespeichert. |
| `steps?: number` | `8`; die Modul-Validierung erlaubt `1` bis `64`. Die Step-Anzahl bestimmt die Loop-Länge. |
| `timeSignature?: string` | `"4/4"`; beschreibt die Takteinteilung. Die Audio-Berechnung prüft die Taktart. |
| `resolution?: string` | `"1/8"`; für Loops ein positiver Bruch, etwa `"1/16"` oder `"1/12"`. |
| `highlightTrack?: string`, `highlightTracks?: string[]` | Anfangs keine Markierung. Gemeinsam bilden sie die Wiedergabe-Auswahl; Namen müssen bei Modul-Validierung in `patternData` vorkommen. |
| `interactive?: boolean` | `true`; erlaubt Rasterbearbeitung und Änderung der Spurauswahl. `false` erhält Vorhören und Wiedergabe, sperrt aber Raster- und Auswahländerungen. |
| `showPlaybackButton?: boolean` | `true`; Play/Stop links im Header, unabhängig vom Footer. `false` erhält die Haltewiedergabe. |
| `showTempo?: boolean` | `true`; zeigt das Tempo-Feld. Ausblenden ändert den `bpm`-Wert nicht. |
| `showPlaybackHint?: boolean` | `true`; zeigt den allgemeinen Bedienhinweis. |
| `showAudioHelp?: boolean` | `true`; zeigt den Link zur Wiki-Anleitung. Fehlermeldungen bleiben unabhängig davon sichtbar. |
| `showFooter?: boolean`, `showFooterInfo?: boolean` | Beide `true`; steuern Footer und dessen Metadaten, nicht den Header-Button. |

Für neue Samples WAV, MP3 oder OGG entsprechend der Browserunterstützung
verwenden. Öffentliche URLs enthalten kein `public/`; Groß-/Kleinschreibung
muss auch auf Linux- und Netlify-Systemen exakt passen.

## Wiedergabeverhalten

### Einzelne Sounds

Aktive Zellen mit Sound lassen sich anklicken oder mit **Tab** und **Enter**
bedienen. Sie verwenden ihren Anschlagwert. Der Instrumentenname spielt
unabhängig von der Wiedergabe-Auswahl mit voller Lautstärke.
Erfolgreiches Vorhören hebt das Ziel etwa 150 ms hervor.

Bei editierbaren Patterns schaltet ein Zellklick weiterhin den Step um; ein
zuvor aktiver Schlag erklingt dabei vor dem Ausschalten. Leere Zellen und
Spuren ohne URL erzeugen keinen Vorschauton. Eigene Soundquellen erlauben
schnelle, sich überlagernde Schläge.

### Loop, Tempo und Auswahl

- **Play/Stop:** Der Symbol-Button startet ohne Gedrückthalten und wechselt
  sofort zum Stop-Quadrat, auch während der Audiofreigabe. Sein zugänglicher
  Name, Tooltip und `aria-pressed` bilden den Zustand ab. Er ist so hoch wie
  eine Rasterzelle und 1,125-mal so breit.
- **Leertaste halten:** Fokus im Pattern oder auf einer Rasterzelle startet
  denselben Loop. Loslassen stoppt ihn; Tastenwiederholungen starten keinen
  weiteren Lauf. Eingabefelder, Buttons, Links und editierbare Texte sind
  vom Halte-Start ausgenommen.
- **Neustart:** Beide Startarten beginnen bei Step 1. Pausen zählen mit, und
  nach dem letzten Step beginnt der nächste Loop.
- **Spuren:** Keine Markierung spielt alle Spuren mit Sound. Eine oder mehrere
  Markierungen begrenzen den Lauf auf genau diese Spuren; markierte stumme
  Spuren lösen keinen Fallback aus. Spurklick ersetzt die Auswahl,
  Shift+Klick ergänzt oder entfernt Spuren. Auswahlkästchen erlauben dasselbe
  per Touch und Tastatur ohne Vorschauton.
- **Auswahlzeitpunkt:** Änderungen der Wiedergabe-Auswahl gelten beim nächsten
  Start. Die separate `.selected`-Spur der Anschlag-Anzeige ist kein
  Wiedergabefilter; ihr Name ist unterstrichen.
- **Abbruch:** Stop, Tempoänderung, Fenster-/Tabwechsel, Navigation oder
  Entfernen des Patterns beenden den Lauf samt seinen klingenden und
  vorgeplanten Sounds. Fokusverlust aus dem Raster beendet zusätzlich den
  Halte-Lauf, nicht aber einen per Button gestarteten Lauf.

Für die Auflösung `n/d` gilt:

```text
Step-Dauer in Sekunden = 60 / bpm × 4 × n / d
Loop-Dauer in Sekunden = steps × Step-Dauer
```

Bei `120 BPM`, `1/8` und acht Steps dauert ein Step `0,25 s`, der Loop `2 s`.
BPM zählt auch bei `6/8` Viertelnoten, nicht punktierte Viertelnoten.
Eine abweichende Step-Anzahl wird nicht auf einen Takt gestaucht oder gestreckt.

Der Scheduler plant alle 25 ms bis zu 100 ms auf der Web-Audio-Uhr voraus.
DOM-Timer markieren die aktuelle Position, bestimmen aber nicht den hörbaren
Start. Nach längeren Hauptthread-Blockaden werden verpasste Steps übersprungen,
nicht gebündelt nachgeholt.

## Audio-Engine und Fehlerfälle

| API | Verhalten |
| --- | --- |
| `preloadSounds(urls): Promise<void>` | Lädt und decodiert jede URL einmal pro Seitenlauf; parallele Anfragen teilen einen Ladevorgang. Ladefehler werden pro URL gewarnt, ein erneuter Versuch bleibt möglich. |
| `unlock(): Promise<boolean>` | Erzeugt bei Bedarf den Context mit `latencyHint: "interactive"` und fordert `resume()` innerhalb der Nutzerinteraktion an. Blockiertes oder fehlendes Web Audio ergibt eine Warnung und `false`. |
| `playSound(url, velocity?, { when?, signal? }): Promise<boolean>` | Verwendet je Schlag eine eigene BufferSource und einen GainNode. Gain ist `velocity / 127`, begrenzt auf `0…1`, ohne Wert `1`. `when` ist eine absolute Audio-Startzeit; Abbruch stoppt nur zugehörige Quellen. Fehler werden gewarnt und als `false` gemeldet. |

Ein Abbruch verhindert auch verspätete Starts nach noch laufendem Laden oder
Audiofreigeben. Andere Pattern-Läufe und separat vorgehörte Schläge bleiben
unabhängig. Bei einer fehlenden Datei, einem Decodierfehler oder blockiertem
Audio erscheint beim Abspielversuch ein Statushinweis; ein fehlgeschlagener
Loop wird beendet. Die Rasterbedienung bleibt erhalten.

Rein visuelle Auflösungen wie `1/16 + Achteltriole` bleiben darstellbar,
starten aber keinen Audio-Loop und zeigen stattdessen einen Timingfehler.
Patterns ohne Sounds behalten ihr bisheriges visuelles Verhalten.

Die vorhandenen WAV-Dateien sind kein Nachweis geklärter Nutzungsrechte:
Quelle, Urheber und Lizenz sind noch nicht dokumentiert und müssen vor einer
Veröffentlichung geklärt werden. Es werden hier keine Rechte zugesichert.

## Tests und Prüfgrenzen

[`tests/drum-audio.test.ts`](../tests/drum-audio.test.ts) prüft Engine und
DOM-Controller mit gemocktem `fetch` und `AudioContext`: Cache und paralleles
Laden, synchronen Cache-Start, Polyphonie, Gain, Fehler, SSR, Klicks, Enter,
Anschlagänderungen und den unveränderten Betrieb ohne Audio.

Fake-Timer sichern Viertel-BPM, Auflösung, synchrone Spuren, Pausen, Loops,
Stop und Neustart ab. Weitere Fälle prüfen Auswahlfilter, Shift-/Touch-Auswahl,
die Trennung von Anschlagspur und Wiedergabe-Auswahl, Header-Button,
unabhängig ausgeblendete Bedienelemente sowie Abbruch während der
Audiofreigabe oder des Ladens.

Die Tests messen keine reale Audiogeräte-Latenz und ersetzen weder einen
Hörtest noch die Prüfung der Browser-Audiofreigabe. Die E2E-Suite ist kein
Audio-Hörtest. Ein erfolgreicher Cleanup-Bericht belegt keinen vollständigen
Preflight. Prüfablauf und Befehle: [Testing-Leitfaden](../README_TESTING.md).
