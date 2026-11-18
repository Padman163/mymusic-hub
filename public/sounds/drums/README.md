# Drum-Soundfiles

Hier liegen die One-Shot-Samples für Drum-Patterns. Aktuell sind folgende
Dateien eingecheckt; ihre genaue Schreibweise ist Teil der öffentlichen URL:

| Datei | Öffentlicher Pfad | Quelle, Urheber und Lizenz |
| --- | --- | --- |
| `Click.wav` | `/sounds/drums/Click.wav` | Noch nicht dokumentiert |
| `HiHat.wav` | `/sounds/drums/HiHat.wav` | Noch nicht dokumentiert |
| `Kick.wav` | `/sounds/drums/Kick.wav` | Noch nicht dokumentiert |
| `Snare.wav` | `/sounds/drums/Snare.wav` | Noch nicht dokumentiert |

Die vorhandenen Dateien belegen keine Freigabe zur Veröffentlichung.
Quelle, Urheber, Lizenz und gegebenenfalls Namensnennung müssen vor einem
Deployment geklärt und hier ergänzt werden; es werden keine Rechte zugesichert.

- Formate: `.wav`, `.mp3`, `.ogg`; die tatsächliche Unterstützung hängt vom Browser ab.
- Für neue Dateien kurze, kleingeschriebene Namen mit Bindestrichen verwenden:
  `kick.wav`, `snare.wav`, `hihat-closed.wav`.
- Öffentlicher Pfad: beispielsweise `/sounds/drums/kick.wav` (ohne `public`).
  Die vorhandene `Kick.wav` heißt dagegen exakt `/sounds/drums/Kick.wav`;
  auf Linux-/Netlify-Systemen ist die Groß-/Kleinschreibung relevant.
- Kurze, sauber geschnittene Samples ohne Stille am Anfang vermeiden hörbare
  Verzögerungen. Die Dateien werden einmal pro Seitenlauf geladen und decodiert.
- Nur selbst erzeugte oder zur Web-Veröffentlichung freigegebene Sounds verwenden.
  Vor dem Einchecken Quelle, Urheber, Lizenz und gegebenenfalls erforderliche
  Namensnennung pro Datei hier ergänzen. Keine Samples ohne geklärte Nutzungsrechte
  hochladen.

Fehlende oder nicht decodierbare Dateien lassen das Pattern weiterhin bedienbar;
beim Abspielversuch erscheint ein Hinweis, technische Details stehen in der Konsole.
