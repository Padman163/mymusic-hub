# Mein Musik-Hub
## GitHub-Repository erstellen
## Astro-Starlight-Vorlage erstellen
### Im Terminal:
```npm create astro@latest -- --template starlight```


## Anwendung starten 
1. ```npm install```
2. ```npm run dev```

## Netlify
```npx netlify-cli login```
```npx netlify-cli link```
```npx netlify-cli dev```

## Aktuellsten Branch holen
1. ```git switch <aktuellsten-branch>```
2. ```git fetch origin```
3. ```git reset --hard origin/<aktuellsten-branch>```

## Älteren Branch holen
1. ```git switch <älteren-branch>```
2. ```git fetch origin```
3. ```git reset --hard origin/<älteren-branch>```

## Älteren Branch holen und worktree auffüllen zu aktuellstem branch
1. ```git switch <älteren-branch>```
2. ```git fetch origin```
3. ```git reset --hard origin/<älteren-branch>```
4. ```git restore --source=origin/<aktuellsten-branch> --worktree -- .```

5. Löscht anstehende commits: ```git clean -fd```
6. Löscht push :  ```git reset --hard origin/<älteren-branch>```

## Sonstige Befehle
1. Kopiert branch mit anderem Namen in z.b. das Archiv ```git branch -m <kopierter-branch> archive/<eingefügter-branch>```
2. Pusht den kopierten branch auf GitHub ```git push origin -u archive/<eingefügter-branch>```
3. Löscht einen branch ```git push origin --delete <branch>```
4. Neuen branch erstellen ```git switch -c <neuer-branch>```

5. Prozesse abbrechen und auf mein wechseln 
```Remove-Item .git\index.lock -Force -ErrorAction SilentlyContinue```
```git checkout -f main```

## IssueTracker-Beiträge speichern
Die Netlify Function unter `netlify/functions/contributions.ts` nimmt Beiträge entgegen und speichert sie zunächst in `data/contributions.json` im GitHub-Repository. In Netlify müssen dafür folgende Umgebungsvariablen gesetzt werden:

- `GITHUB_TOKEN`: Fine-grained Personal Access Token mit Lese- und Schreibzugriff auf den Repository-Inhalt.
- `GITHUB_REPOSITORY`: Repository im Format `owner/repository`.
- `GITHUB_BRANCH`: Zielbranch (optional, Standard: `main`).
- `GITHUB_DATA_PATH`: Speicherpfad (optional, Standard: `data/contributions.json`).

Das Token darf nicht im Frontend oder in eingecheckten Dateien hinterlegt werden. Bis eine Anmeldung oder ein anderer Zugriffsschutz ergänzt ist, kann jeder Besucher die öffentliche API zum Einreichen von Beiträgen aufrufen. Die Einträge sind entsprechend der Sichtbarkeit des Repositorys einsehbar; vertrauliche Daten sollten daher nicht eingereicht werden. Die API ist von der Speicherung getrennt, sodass später die GitHub-Speicherung durch eine Datenbankanbindung ersetzt werden kann.

Die Beitragsübersicht unter `projektierung/beitraege` liest die Einträge bei jedem Aufruf über dieselbe Netlify Function und denselben konfigurierten GitHub-Branch wie das Formular. Für die Übersicht muss die JSON-Datei auf dem konfigurierten Branch vorhanden sein und ein Array enthalten. Die Übersicht und ihre API sind ebenfalls öffentlich zugänglich, auch wenn das Repository privat ist. Das lokale `npm run dev` startet keine Netlify Functions; zum Testen wird eine Netlify-Umgebung benötigt.

### Deploy Preview für die Entwicklung

1. Das GitHub-Repository in Netlify verknüpfen, `main` als Produktionsbranch wählen und Deploy Previews aktivieren.
2. Einen Pull Request vom Feature-Branch nach `main` öffnen. Netlify baut dafür eine eigene Preview-URL, ohne die Produktionsseite zu veröffentlichen.
3. Weitere Änderungen auf den Feature-Branch pushen; der offene Pull Request erhält automatisch eine aktualisierte Preview.
4. Erst nach Abschluss der Tests den Pull Request nach `main` mergen.

Für den Deploy-Preview-Kontext müssen die Umgebungsvariablen in Netlify separat gesetzt werden, wenn auch das Speichern getestet werden soll. Ohne explizites `GITHUB_BRANCH` schreibt die Function nach `main`, auch in einer Preview. Für isolierte Tests empfiehlt sich daher ein separates Test-Repository mit eigenem, darauf eingeschränktem Token und einer bestehenden leeren JSON-Array-Datei. `GITHUB_REPOSITORY`, `GITHUB_TOKEN` und gegebenenfalls `GITHUB_BRANCH` im Kontext **Deploy Previews** entsprechend setzen. Nach Änderungen an den Umgebungsvariablen die Preview erneut deployen.

Die Produktionskonfiguration in `netlify.toml` überspringt Builds, wenn seit dem letzten erfolgreichen Build ausschließlich `data/contributions.json` geändert wurde. Dadurch löst nicht jeder gespeicherte Beitrag einen Produktions-Deploy aus. Wird `GITHUB_DATA_PATH` geändert, muss die Ignore-Regel entsprechend angepasst werden. Dokumentationsseiten unter `src/content/docs` bleiben buildrelevant.

Deploy Previews haben laut aktueller Netlify-Preisliste keine Produktions-Deploy-Gebühr, sind aber nicht grundsätzlich ohne Credit-Verbrauch: Zugriffe, Datenverkehr und Function-Ausführungen können Credits verbrauchen. Die genauen Konditionen hängen vom Tarif ab und sind im Netlify-Dashboard und in der [Preisliste](https://www.netlify.com/pricing/) zu prüfen.
