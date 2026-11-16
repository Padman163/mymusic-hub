# Repository-Cleanup: Anleitung in fünf Schritten

Diese Anleitung ist bei Bedarf wiederholbar. Ausgangspunkt ist das Repository-Root. Erst prüfen, dann Änderungen gezielt und nach Freigabe durchführen; fremde oder ungesicherte Änderungen nicht überschreiben.

## Vorbereitung

```bash
git status --short
git branch --show-current
```

Arbeitsstand und offene Änderungen prüfen und die Bereinigung möglichst auf einem eigenen Branch durchführen. Keine Reset- oder Clean-Befehle als Abkürzung verwenden.

## 1. Git-Hygiene und Artefakte

- `.gitignore` auf `dist/`, `.astro/`, `node_modules/`, `test-results/`, `playwright-report/`, `.lighthouseci/` und `.env` prüfen.
- Prüfen, ob ignorierte Dateien bereits im Index liegen:

  ```bash
  git ls-files -- test-results .lighthouseci .env
  git check-ignore --no-index -v dist/ .astro/ node_modules/ test-results/ playwright-report/ .lighthouseci/ .env
  ```

- `.gitignore` entfernt bereits getrackte Dateien nicht aus dem Index. Nur nach Prüfung und Freigabe die betroffenen Ordner einzeln aus dem Index entfernen; lokale Dateien bleiben erhalten:

  ```bash
  git rm -r --cached -- test-results
  git rm -r --cached -- .lighthouseci
  ```

  Nur für tatsächlich getrackte Ordner ausführen. Die Entfernung wird für den nächsten Commit vorgemerkt und entfernt die Dateien dort aus dem Repository; sie kann andere Checkouts betreffen. `.env` und Zugangsdaten nicht veröffentlichen.
- Beim letzten Cleanup blieben Dateien in `test-results/` und `.lighthouseci/` bewusst im Index. Aktuellen Stand erneut prüfen.

## 2. Dokumentation konsolidieren

1. `README.md` mit den führenden Leitfäden in der [Dokumentationsübersicht](README.md#dokumentation) vergleichen. Einmalige Befehle, Umgebungsvariablen und Checklisten vor dem Kürzen in den passenden Leitfaden übernehmen.
2. Einstieg, Schnellstart, Verweise, Preflight und Release-Checkliste in `README.md` erhalten. Keine ungeprüften Release-Erfolge behaupten.
3. Encoding von Prompt-Dokumenten prüfen, zum Beispiel `file README_PROMPTS.md`; Inhalte nur nach Prüfung und bei Bedarf nach UTF-8 konvertieren.
4. Handoffs auf Abschluss und offene Punkte prüfen. Eine Archivierung nach `archive/handoffs/` nur vorschlagen und nach Freigabe durchführen; Links aktualisieren.
5. Den automatischen Dokumentationscheck aus [README_TESTING.md](README_TESTING.md#dokumentationscheck) ausführen.

## 3. Ungenutzte Dateien und Assets untersuchen

```bash
rg --files src/components src/lib src/styles public/scores
rg -n 'NotationVisual|NotationKeyboard|/scores/|musicXmlUrl|import\.meta\.glob' src data tests
```

Alle Komponenten und Assets einzeln auf Importe und tatsächliche Verwendung prüfen. Insbesondere dynamisch zusammengesetzte MusicXML-Pfade, Konfigurationen, Tests, öffentliche URLs und gespeicherte Daten berücksichtigen. Kommentare, Sonderfall-Vergleiche oder Markdown-Codebeispiele sind keine aktiven Aufrufe. Auch nicht referenzierte öffentliche Dateien können extern genutzt werden.

Eine Tabelle mit Pfad, Fundstellen und Empfehlung **Behalten**, **Prüfen** oder **Löschen** erstellen. Keine Datei oder leeren Ordner ohne Freigabe löschen; nach Löschungen Referenzen und Funktionen erneut prüfen.

## 4. Abgelöste Features und Wrapper prüfen

- Dateien in `src/components/notation/` und ihre direkten und indirekten Aufrufer untersuchen. Gemeinsamen Renderer und wiederverwendbare Komponenten erhalten.
- Zwischen intern benötigten Bausteinen, interaktiven Features und tatsächlich obsoleten Wrappern unterscheiden. `NotationVisual` ist beispielsweise ein interner Baustein von `Notation`; `NotationKeyboard` ergänzt ein verbundenes Klaviersystem.
- Für jeden möglichen Ersatz Props, Layout, Interaktion, gespeicherte Daten und visuelles Ergebnis vergleichen. Eine 1:1-Migration nicht behaupten, wenn die Ziel-API sie nicht unterstützt.
- Migrations- und Löschliste vorlegen. Erst nach Freigabe Aufrufe und Dokumentation anpassen, Wrapper entfernen und Regressionstests einschließlich visueller Prüfung ausführen.

## 5. Tests und Abschluss

1. [README_TESTING.md](README_TESTING.md), `vitest.config.ts`, Testdateien und `package.json` mit dem tatsächlichen Stand vergleichen. Testauswahl und Skripte prüfen; keine Umbenennung nur um der Einheitlichkeit willen.
2. Gezielte Tests für geändertes Verhalten ausführen. Anschließend:

   ```bash
   npm run preflight
   git status --short
   git diff --check
   ```

3. Fehler und Warnungen untersuchen und das Gate nach Korrekturen erneut ausführen. `npm run audit` scheitert erst ab `high`; niedrigere gemeldete Schwachstellen separat bewerten.
4. Änderungen und verbleibende Risiken zusammenfassen. Lighthouse, manuelle Release-Prüfungen und externe Asset-Verwendungen sind nicht automatisch durch Preflight abgedeckt.
