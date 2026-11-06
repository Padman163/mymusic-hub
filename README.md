# Mein Musik-Hub
## GitHub-Repository erstellen
## Astro-Starlight-Vorlage erstellen
### Im Terminal:
```npm create astro@latest -- --template starlight```
## Anwendung starten 
1. ```cd mymusic-hub```
2. ```npm install```
3. ```npm run dev```

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