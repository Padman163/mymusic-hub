# Mein Musik-Hub
## GitHub-Repository erstellen
## Astro-Starlight-Vorlage erstellen
### Im Terminal:
```npm create astro@latest -- --template starlight```


## Anwendung starten 
1. ```npm install```
2. ```npm run dev```

## IssueTracker-Beiträge speichern
Die Netlify Function unter `netlify/functions/contributions.ts` nimmt Beiträge entgegen und speichert sie zunächst in `data/contributions.json` im GitHub-Repository. In Netlify müssen dafür folgende Umgebungsvariablen gesetzt werden:

- `GITHUB_TOKEN`: Fine-grained Personal Access Token mit Lese- und Schreibzugriff auf den Repository-Inhalt.
- `GITHUB_REPOSITORY`: Repository im Format `owner/repository`.
- `GITHUB_BRANCH`: Zielbranch (optional, Standard: `main`).
- `GITHUB_DATA_PATH`: Speicherpfad (optional, Standard: `data/contributions.json`).

Das Token darf nicht im Frontend oder in eingecheckten Dateien hinterlegt werden. Bis eine Anmeldung oder ein anderer Zugriffsschutz ergänzt ist, kann jeder Besucher die öffentliche API zum Einreichen von Beiträgen aufrufen. Die Einträge sind entsprechend der Sichtbarkeit des Repositorys einsehbar; vertrauliche Daten sollten daher nicht eingereicht werden. Die API ist von der Speicherung getrennt, sodass später die GitHub-Speicherung durch eine Datenbankanbindung ersetzt werden kann.

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