# Mein Entwicklungsworkflow

`main` ist der Hauptbranch und wird nur selten deployed. Neue Features entstehen auf `feat/<featurename>`; abgeschlossene Features werden unter `archive/feat/<featurename>` gesichert.

## 1. Workspace vorbereiten

Im neuen Workspace das Repository einrichten und den benötigten Branch auschecken: [Workspace-Setup](README_WORKSPACE_SETUP.md). Alltagsbefehle stehen im [Cheatsheet](README_CHEATSHEET.md).

Vor einem Workspace-Wechsel Änderungen prüfen, committen und den aktuellen Branch pushen. Nicht eingecheckte Daten separat und sicher übertragen.

Nach Paket- oder Netlify-Änderungen den Workspace erneut synchronisieren:

1. Sind in `package.json` neue Pakete ergänzt oder wurden Abhängigkeiten geändert, anschließend erneut `npm install` ausführen und `package-lock.json` mit committen.
2. Nach neuen Netlify-Einstellungen oder Änderungen an der Site-Verknüpfung erneut bei Netlify anmelden und die Verknüpfung prüfen:

```bash
npx netlify-cli login
npx netlify-cli status
```

Die Netlify CLI bezieht die benötigten Informationen aus der Anmeldung und der
Site-Verknüpfung. Ein Export der Netlify-Umgebungsvariablen in eine lokale
`.env` ist für dieses Projekt nicht erforderlich.

3. Danach einen laufenden `npx netlify-cli dev`-Prozess vollständig stoppen und mit der aktualisierten Umgebung neu starten.

Bei Modul-Builder, Beiträgen und anderen Netlify-Functions ausschließlich `http://localhost:8888` öffnen. Port `4321` ist der von der Netlify CLI intern gestartete reine Astro-Server; dort fehlen die Backend-Routen und Browserfehler mit HTML-Antworten sind dann erwartbar. Eine `404 text/html` von `/api/modules` oder `/api/contributions` bedeutet daher zuerst: richtige URL und richtigen Server prüfen.

Die Blob-Transferbefehle verwenden die Anmeldung aus `npx netlify-cli login`
und benötigen weder `NETLIFY_AUTH_TOKEN` noch die früheren `GITHUB_*`-Werte in
einer lokalen `.env`.

## 2. Feature entwickeln

Vom aktuellen `main` einen neuen Feature-Branch erstellen:

```bash
git switch main
git pull origin main
git switch -c feat/<featurename>
```

Auf diesem Branch entwickeln und Änderungen regelmäßig committen und pushen. Soll ein neues Feature auf einem noch nicht in `main` übernommenen Feature aufbauen, bewusst von dessen Archiv-Branch abzweigen statt von `main`.

Beiträge und Lernmodule verwenden bereits Netlify Blobs (`mymusic-hub-data`). Lokal und online verwenden jedoch unterschiedliche Speicherstände:

- `npx netlify-cli dev` liest und schreibt einen eigenen dauerhaften Store unter `.netlify/`, derzeit `.netlify\blobs-serve\`.
- Ein leerer lokaler Store wird aus `data\blob-snapshot\contributions.json` und `data\blob-snapshot\modules.json` initialisiert.
- Schon vorhandene lokale Blob-Keys haben Vorrang. Ein Git-Branch-Wechsel lädt deshalb keine neueren Snapshot-Daten in diesen Store.
- Lokale Schreibvorgänge über die Functions aktualisieren zusätzlich die versionierten Snapshots, ändern aber noch nicht die Cloud.
- `npm run blobs:push` erstellt vorher ein Cloud-Backup und lädt danach beide lokalen Snapshots in den siteweiten Store.
- Branch Deploys und Deploy Previews teilen den Cloud-Store mit Production, überschreiben ihn aber nicht mehr aus ihrem Build.
- Der im Repository konfigurierte Build importiert keine Snapshots. Der Online-Store bleibt beim Deploy maßgeblich; ein gegebenenfalls separat konfigurierter Snapshot-Import in Netlify muss dafür deaktiviert sein.
- Admins können auf dem veröffentlichten Produktions-Deploy Sicherungen anlegen und nach Vorschau wiederherstellen (siehe [Blob-Referenz](features/README_FEAT_NETLIFYBLOB.md#online-backups-im-admin-bereich)).

Wenn der lokale Stand nach einem Branch-Wechsel hinter dem versionierten Snapshot zurückbleibt, Netlify Dev zuerst stoppen und den benannten Reset-Befehl verwenden:

```bash
npm run blobs:reset
npx netlify-cli dev
```

Das entfernt ausschließlich `.netlify/blobs-serve`. Vorher nicht als Snapshot
gesicherte lokale Änderungen erhalten. Für eine frische lokale Kopie des
aktuellen Online-Stands:

```bash
npm run blobs:pull
npm run blobs:reset
npx netlify-cli dev
```

Nach lokalen Änderungen die Snapshot-Diff prüfen und ausdrücklich hochladen:

```bash
git diff -- data/blob-snapshot
npm run blobs:push
```

Der Push erstellt vor dem überschreibenden Zugriff ein Archiv beider Cloud-Blobs.
Token-Regeln und Deploy-Verhalten stehen in der
[Blob-Referenz](features/README_FEAT_NETLIFYBLOB.md).

## 3. Automatisch testen

Keine Tests automatisch nach einzelnen Änderungen ausführen. Copilot fragt nach jeweils zehn Nutzer-Prompts im laufenden Chat, ob passende Unit- und Komponententests (Stufen 1 und 2) ausgeführt werden sollen. Erst nach Zustimmung oder ausdrücklichem Testauftrag testen. Kein Preflight für Zwischenschritte, Zwischen-Commits oder Zwischen-Pushes. Details und Befehle: [Testing](README_TESTING.md).

Bei Bedarf kann Biome sichere Formatierungs- und Lint-Korrekturen direkt anwenden:

```bash
npm run fix
```

Die anschließende Validierung mit Biome, Astro und TypeScript läuft als Stufe 0 ausschließlich im manuell vom Nutzer gestarteten `npm run preflight`; `npm run validate` nicht separat starten. Der Preflight ersetzt weder die gezielten Tests während der Entwicklung noch das separate manuelle `npm run audit`.

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
