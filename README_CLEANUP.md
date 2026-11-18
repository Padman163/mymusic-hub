# Repository-Cleanup: Anleitung in fünf Schritten

Diese Anleitung ist bei Bedarf wiederholbar. Ausgangspunkt ist das Repository-Root. Erst prüfen, dann Änderungen gezielt und nach Freigabe durchführen; fremde oder ungesicherte Änderungen nicht überschreiben.

## Automatischer, nicht-destruktiver Bericht

Vom Repository-Root aus:

```bash
npm run cleanup:check
```

Der Bericht geht die fünf Schritte durch und fasst Git-Status, Ignore-Regeln, getrackte Artefakte, Dokumentations- und Linktest, statische Dateiverweise, alte Storage-Bezeichner, Notations-Wrapper und Handoffs zusammen. Mögliche ungenutzte Dateien werden ausschließlich als **Prüfkandidaten** markiert: Eine statische Namenssuche erkennt keine dynamischen Imports oder externen Nutzungen. Es wird nichts gelöscht, verschoben oder aus dem Git-Index entfernt. Der Dokumentationscheck wird ausgeführt; das vollständige `npm run preflight` und manuelle Funktions-, Daten- und Sichtprüfungen bleiben separate Schritte.

## Vorbereitung

```bash
git status --short
git branch --show-current
```

Arbeitsstand und offene Änderungen prüfen und die Bereinigung möglichst auf einem eigenen Branch durchführen. Keine Reset- oder Clean-Befehle als Abkürzung verwenden.

## 1. Git-Hygiene und Artefakte

- `.gitignore` auf `dist/`, `.astro/`, `node_modules/`, `test-results/`, `playwright-report/`, `.lighthouseci/`, `.env` und `.env.*` prüfen. `.env.example` bleibt als mögliche Vorlage erlaubt und darf keine echten Zugangsdaten enthalten.
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
- Beim Cleanup vom 17.11.2026 wurden die Berichtsdateien in `test-results/` und `.lighthouseci/` nach Freigabe aus dem Index entfernt; lokale Dateien blieben erhalten. Aktuellen Stand vor jedem weiteren Cleanup erneut prüfen.
- Lokale Blob-Artefakte unter `.netlify/blobs/` bzw. `.netlify/blobs-serve/` nicht einchecken und nur nach Sicherung oder Freigabe entfernen; siehe [lokaler Blob-Speicher](features/README_FEAT_NETLIFYBLOB.md#architektur-und-datenfluss).

## 2. Dokumentation konsolidieren

1. `README.md` mit den führenden Leitfäden in der [Dokumentationsübersicht](README.md#dokumentation) vergleichen. Einmalige Befehle, Umgebungsvariablen und Checklisten vor dem Kürzen in den passenden Leitfaden übernehmen.
2. Einstieg, Schnellstart, Verweise, Preflight und Release-Checkliste in `README.md` erhalten. Keine ungeprüften Release-Erfolge behaupten.
3. [Copilot-Instruktionen](.github/copilot-instructions.md) auf Aktualität, Widersprüche und Überschneidungen mit den führenden Leitfäden prüfen.
4. Handoffs in `features/` auf Abschluss und offene Punkte prüfen. Eine Archivierung nach `archive/handoffs/` nur vorschlagen und nach Freigabe durchführen; Links aktualisieren.
5. Den automatischen Dokumentationscheck aus [README_TESTING.md](README_TESTING.md#dokumentationscheck) ausführen.

## 3. Ungenutzte Dateien und Assets untersuchen

```bash
rg --files src/components src/lib src/styles public/scores
rg -n 'NotationVisual|NotationKeyboard|/scores/|musicXmlUrl|import\.meta\.glob' src data tests
```

Alle Komponenten und Assets einzeln auf Importe und tatsächliche Verwendung prüfen. Insbesondere dynamisch zusammengesetzte MusicXML-Pfade, Konfigurationen, Tests, öffentliche URLs und gespeicherte Daten berücksichtigen. Kommentare, Sonderfall-Vergleiche oder Markdown-Codebeispiele sind keine aktiven Aufrufe. Auch nicht referenzierte öffentliche Dateien können extern genutzt werden.

Eine Tabelle mit Pfad, Fundstellen und Empfehlung **Behalten**, **Prüfen** oder **Löschen** erstellen. Keine Datei oder leeren Ordner ohne Freigabe löschen; nach Löschungen Referenzen und Funktionen erneut prüfen.

## 4. Abgelöste Features und Wrapper prüfen

- Nach der Blob-Umstellung auf alte Speicherreste prüfen: `GITHUB_TOKEN` und weitere `GITHUB_*`-Zugriffe im Function-Code, `github-contribution-store.ts`, alte `data/**`-Ignore-Regeln in `netlify.toml` und nicht mehr benötigte `GITHUB_*`-Variablen im Netlify Dashboard. Vor dem Löschen Dashboard-Variablen auf andere Verbraucher und Rollback-Abhängigkeiten prüfen.

- Dateien in `src/components/notation/` und ihre direkten und indirekten Aufrufer untersuchen. Gemeinsamen Renderer und wiederverwendbare Komponenten erhalten.
- Zwischen intern benötigten Bausteinen, interaktiven Features und tatsächlich obsoleten Wrappern unterscheiden. `NotationVisual` ist beispielsweise ein interner Baustein von `Notation`; `NotationKeyboard` ergänzt ein verbundenes Klaviersystem.
- Für jeden möglichen Ersatz Props, Layout, Interaktion, gespeicherte Daten und visuelles Ergebnis vergleichen. Eine 1:1-Migration nicht behaupten, wenn die Ziel-API sie nicht unterstützt.
- Migrations- und Löschliste vorlegen. Erst nach Freigabe Aufrufe und Dokumentation anpassen, Wrapper entfernen und Regressionstests einschließlich visueller Prüfung ausführen.

## 5. Tests und Abschluss

1. [README_TESTING.md](README_TESTING.md), `vitest.config.ts`, Testdateien und `package.json` mit dem tatsächlichen Stand vergleichen. Testauswahl und Skripte prüfen; keine Umbenennung nur um der Einheitlichkeit willen.
2. Keine Tests automatisch nach einzelnen Änderungen starten. Copilot fragt nach jeweils zehn Nutzer-Prompts, ob Stufen 1 und 2 ausgeführt werden sollen; Tests laufen nur nach Zustimmung oder ausdrücklichem Testauftrag. Erst am Branch-Abschluss startet der Nutzer den Preflight (einschließlich Stufen 0, 3 und 4) und das separate Audit manuell:

   ```bash
   npm run preflight
   npm run audit
   git status --short
   git diff --check
   ```

3. Fehler und Warnungen untersuchen. Nach Korrekturen startet der Nutzer das Gate erneut manuell. `npm run audit` scheitert erst ab `high`; niedrigere gemeldete Schwachstellen separat bewerten.
4. Änderungen und verbleibende Risiken zusammenfassen. Lighthouse läuft gemäß `package.json` im Preflight mit; Messumfang und öffentlicher Standard-Upload sind im Testing-Leitfaden beschrieben. Manuelle Release-Prüfungen und externe Asset-Verwendungen sind nicht automatisch durch Preflight abgedeckt.
