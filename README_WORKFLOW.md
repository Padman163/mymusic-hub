# Mein Entwicklungsworkflow

`main` ist der Hauptbranch und wird nur selten deployed. Neue Features entstehen auf `feat/<featurename>`; abgeschlossene Features werden unter `archive/feat/<featurename>` gesichert.

## 1. Workspace vorbereiten

Im neuen Workspace das Repository einrichten und den benötigten Branch auschecken: [Workspace-Setup](README_WORKSPACE_SETUP.md). Alltagsbefehle stehen im [Cheatsheet](README_CHEATSHEET.md).

Vor einem Workspace-Wechsel Änderungen prüfen, committen und den aktuellen Branch pushen. Lokale `.env`-Dateien und nicht eingecheckte Daten separat und sicher übertragen.

Nach Paket- oder Netlify-Änderungen den Workspace erneut synchronisieren:

1. Sind in `package.json` neue Pakete ergänzt oder wurden Abhängigkeiten geändert, anschließend erneut `npm install` ausführen und `package-lock.json` mit committen.
2. Nach neuen Netlify-Einstellungen oder Änderungen an der Site-Verknüpfung erneut bei Netlify anmelden und die Verknüpfung prüfen:

```bash
npx netlify-cli login
npx netlify-cli env:list --plain > .env
npx netlify-cli status
```

Die lokale `.env` ist damit nicht die Datenquelle der Netlify Blobs; sie enthält nur exportierte Umgebungswerte. `GITHUB_BRANCH` beeinflusst daher weiterhin nicht, welche lokalen Blob-Daten geladen werden. Unter Windows PowerShell 5.1 kann `>` die Datei als UTF-16LE schreiben. Bash, Codespaces und PowerShell 7 verwenden üblicherweise UTF-8. Falls nach dem Export unerwartete Zeichen auftreten, die Datei bewusst als UTF-8 neu speichern; Details stehen im [Workspace-Setup](README_WORKSPACE_SETUP.md).

3. Danach einen laufenden `npx netlify-cli dev`-Prozess vollständig stoppen und mit der aktualisierten Umgebung neu starten.

Bei Modul-Builder, Beiträgen und anderen Netlify-Functions ausschließlich `http://localhost:8888` öffnen. Port `4321` ist der von der Netlify CLI intern gestartete reine Astro-Server; dort fehlen die Backend-Routen und Browserfehler mit HTML-Antworten sind dann erwartbar. Eine `404 text/html` von `/api/modules` oder `/api/contributions` bedeutet daher zuerst: richtige URL und richtigen Server prüfen.

Die `.env` darf nicht committet werden. `NETLIFY_AUTH_TOKEN` bleibt ausschließlich als geheime Netlify-Build-Variable im Dashboard; gelangt der Wert trotz Sicherheitsmaskierung in die lokale Datei, vor dem Commit und vor der Weitergabe wieder aus `.env` entfernen. `GITHUB_BRANCH`, `GITHUB_DATA_PATH`, `GITHUB_REPOSITORY` und `GITHUB_TOKEN` werden für die Netlify-Blob-Datenspeicherung nicht benötigt und können aus der aktuellen lokalen `.env` entfernt werden.

## 2. Feature entwickeln

Vom aktuellen `main` einen neuen Feature-Branch erstellen:

```bash
git switch main
git pull origin main
git switch -c feat/<featurename>
```

Auf diesem Branch entwickeln und Änderungen regelmäßig committen und pushen. Soll ein neues Feature auf einem noch nicht in `main` übernommenen Feature aufbauen, bewusst von dessen Archiv-Branch abzweigen statt von `main`.

Beiträge und Lernmodule verwenden bereits Netlify Blobs (`mymusic-hub-data`). `GITHUB_BRANCH` ist dafür wirkungslos. Lokal und online verwenden jedoch unterschiedliche Speicherstände:

- `npx netlify-cli dev` liest und schreibt einen eigenen dauerhaften Store unter `.netlify/`, derzeit `.netlify\blobs-serve\`.
- Ein leerer lokaler Store wird aus `data\blob-snapshot\contributions.json` und `data\blob-snapshot\modules.json` initialisiert.
- Schon vorhandene lokale Blob-Keys haben Vorrang. Ein Git-Branch- oder `.env`-Wechsel lädt deshalb keine neueren Snapshot-Daten in diesen Store.
- Lokale Schreibvorgänge über die Functions aktualisieren zusätzlich die versionierten Snapshots. Diese Änderungen müssen committet und gepusht werden, damit ein späterer Netlify-Deploy sie in den siteweiten Cloud-Store importiert.
- Branch Deploys, Deploy Previews und Production derselben Netlify-Site teilen den Cloud-Store und können ihn gegenseitig überschreiben.

Wenn der lokale Stand nach einem Branch-Wechsel hinter dem versionierten Snapshot zurückbleibt, Netlify Dev zuerst stoppen und nur den ignorierten lokalen Store zurücksetzen:

```powershell
Remove-Item -Recurse -Force .netlify\blobs-serve
npx netlify-cli dev
```

Das entfernt ausschließlich lokale Daten. Vorher lokale, nicht gespeicherte Teständerungen sichern. Cloud-Keys dürfen für diesen Ablauf nicht gelöscht werden. Vor Deploys den aktuellen Snapshot- und Cloud-Datenstand gemäß [Blob-Referenz](features/README_FEAT_NETLIFYBLOB.md) sichern und abgleichen; isolierte Online-Abnahmen benötigen eine separate Netlify-Site.

## 3. Automatisch testen

Keine Tests automatisch nach einzelnen Änderungen ausführen. Copilot fragt nach jeweils zehn Nutzer-Prompts im laufenden Chat, ob passende Unit- und Komponententests (Stufen 1 und 2) ausgeführt werden sollen. Erst nach Zustimmung oder ausdrücklichem Testauftrag testen. Kein Preflight für Zwischenschritte, Zwischen-Commits oder Zwischen-Pushes. Details und Befehle: [Testing](README_TESTING.md).

## 4. Cleanup und Abschlussprüfung

Die fünf Schritte der [Cleanup-Anleitung](README_CLEANUP.md) durchgehen. Löschungen und Migrationen erst nach Prüfung und Freigabe durchführen. Stufen 0, 3 und 4 laufen erst am fertigen Branch im manuell vom Nutzer gestarteten `npm run preflight`. Er umfasst auch die vollständigen Unit- und Komponententests sowie Lighthouse; `npm run audit` führt der Nutzer separat aus. Copilot startet diese Abschlussprüfung nicht. Anschließend den endgültigen Stand committen.


## 5. Manuelle Featureprüfung und Dokumentationsanpassung
Kopiere den folgenden Prompt direkt in Copilot; Eingabefelder müssen nicht ausgefüllt werden:

> Prüfe das aktuell entwickelte Feature und passe seine Dokumentation an. Ermittle den Kontext selbst aus dem Repository:
>
> 1. Lies `git branch --show-current`, `git status --short`, die Commits seit der Abzweigung von `main` und die dazugehörigen Änderungen. Bestimme das Feature aus dem aktiven Branch, den geänderten Dateien und vorhandenen Feature-Dokumenten. Verwende den Teil des Branch-Namens nach `feat/` als technischen Slug und leite zusammen mit Code und Historie den sprechenden Feature-Namen sowie den passenden Dokumentations-Slug ab. Verwende vorhandene passende `features/README_FEAT_*.md`-Dateien, statt eine parallele Referenz anzulegen. Suche einen zugehörigen Handoff selbstständig; falls es keinen gibt, ist das kein Hindernis.
> 2. Wenn der aktuelle Branch kein `feat/`-Branch ist oder Branch, Änderungen und vorhandene Dokumentation kein eindeutiges Feature ergeben, ändere nichts und melde knapp, welche Zuordnung geklärt werden muss. Erfinde keine Feature-Identität und behaupte nicht, Cleanup oder `npm run preflight` seien bereits erfolgreich gewesen: prüfe den tatsächlichen Arbeitsstand.
> 3. Arbeite in zwei Stufen:
>    - **Dokumentation zuerst:** Prüfe die betroffenen Root-Leitfäden (`README.md`, `README_ASTROSTRUCTURE.md`, `README_CHEATSHEET.md`, `README_TESTING.md`, `README_WORKSPACE_SETUP.md`, `README_CLEANUP.md`, `README_WORKFLOW.md`), `.github/copilot-instructions.md`, `features/README_FEAT.md`, alle fachlich passenden Feature-Referenzen sowie einschlägige Seiten unter `src/content/docs/`. Ergänze nur die fachlich zuständigen Dokumente und vermeide Dopplungen. Aktualisiere die vorhandene führende Feature-Referenz oder lege sie nach dem Namensschema des Repositories an. Beschreibe nur verifizierte Implementierung: Zweck, Einbindung, Architektur und Dateien, Verhalten, Props/Konfiguration, Randfälle sowie passende Tests. Erstelle oder aktualisiere zusätzlich für nutzerseitig bedienbare Features eine Anleitung im Wiki unter `src/content/docs/wiki/`: Was können Nutzer tun und wie bedienen sie es? Verlinke sie in der Wiki-Navigation und bei der zugehörigen Oberfläche; technische Details gehören in die Feature-Referenz. Erstelle keine manuelle Abnahmeliste in der Feature-Dokumentation. Passe Setup-, Test-, Cheatsheet- oder globale Architekturregeln nur an, wenn sich diese tatsächlich geändert haben. Vergleiche die Dokumentation mit dem aktuellen Code und den Tests; behandle ältere Beschreibungen und Handoffs nicht automatisch als aktuellen Stand.
>    - **IssueTracker-Beitrag danach:** Leite den Feature-Beitrag aus der aktualisierten Feature-Referenz ab. Prüfe für den aktuellen API-Vertrag bei Bedarf `src/components/IssueTrackerForm.astro`, die zentralen Beitragstypen, Bereichs-, Prioritäts-, Status- und Checklisten-Helfer unter `src/lib/` sowie `netlify/functions/contributions.ts`. Suche zuerst nach einem passenden bestehenden Beitrag und ergänze diesen, statt ein Duplikat anzulegen. Verwende die ermittelten gültigen Werte; leite den Bereich aus dem Feature ab, nimm bei unklarer Priorität `Mittel` und bei einem neuen Beitrag `New`.
> 4. Der Beitrag hat den Typ `Feature`, einen prägnanten Titel mit höchstens 120 Zeichen, eine kurze Beschreibung mit Verweis auf die Feature-Referenz und einzelne Checklistenpunkte, die aus den dokumentierten Teil-Features abgeleitet werden. Übernimm bekannte Prüfstände und erhalte bei bestehenden Beiträgen bereits gesetzte Häkchen; erfinde keine erfolgreichen Prüfungen. Jeder Punkt darf höchstens 200 Zeichen lang sein; maximal 100 Punkte. Prüfe diese Grenzen vor dem Senden.
> 5. Sende den Beitrag nach erfolgreicher Dokumentationsanpassung über `POST /api/contributions`. Bevorzuge den lokalen Netlify-CLI-Endpunkt unter `http://localhost:8888`, der den lokalen Blob-Speicher verwendet. Schreibe nicht in einen gemeinsamen oder produktiven Netlify-Blob-Store: Deploy-Kontexte derselben Netlify-Site teilen Daten. Online nur auf einer nachweislich isolierten Site und wenn die Umgebung dafür ausdrücklich vorgesehen ist. Ist der sichere Endpunkt nicht verfügbar oder eine vorhandene Änderung wegen eines Konflikts nicht sicher aktualisierbar, stoppe den Schreibzugriff und nenne den nächsten nötigen Schritt.
> 6. Eine ausdrückliche Bitte um vorherige Prüfung oder einen Stopp verhindert den POST bis zur Freigabe. Gib bei bestehenden Markdown-Dateien im Chat nur geänderte Abschnitte oder einen knappen Diff aus, nicht die vollständigen Dateien.

## 6. Feature archivieren und neues beginnen

Auf dem fertigen Feature-Branch:

```bash
git branch -m archive/feat/<featurename>
git push -u origin archive/feat/<featurename>
git push origin --delete feat/<featurename>
```

Den Archiv-Branch auf GitHub prüfen. Ein bereits gepushter `feat/`-Branch bleibt dort bestehen; eine spätere Löschung ist eine separate Entscheidung.

Vor dem Archivieren eines Features prüfen, ob neue Snapshots unter `data/blob-snapshot/` entstehen und vollständig im Branch enthalten sind. Vor einem späteren Deploy Branch-Freigabe, Netlify-Umgebungsvariablen und Cloud-Datenbackup getrennt prüfen. Das Archivieren des Codes sichert keine Daten in Netlify Blobs.

Archivieren übernimmt **keine** Änderungen nach `main`. Eine Übernahme per Pull Request und ein Deployment werden später separat entschieden. Danach mit Schritt 2 das nächste Feature beginnen.
