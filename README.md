# Mein Musik-Hub
## GitHub-Repository erstellen
## Astro-Starlight-Vorlage erstellen
### Im Terminal:
```npm create astro@latest -- --template starlight```


## Anwendung starten ( ohne Netlify )
```npm install```
```npm run dev```

## Anwendung starten ( mit Netlify )
```npm install```
```npm run build```
```npx netlify-cli login```
```npx netlify-cli link```
```npx netlify-cli dev```

## Aktuellsten Branch holen
```git fetch origin``` 
```git switch/checkout <aktuellsten-branch>```
```git reset --hard origin/<aktuellsten-branch>```

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

## Commits die abgeschickt sind löschen
```git reset HEAD```

HEAD ist der Zeiger auf deinen aktuellen Commit.

HEAD~1 ist der direkte Vorgänger-Commit (1 Schritt zurück).

HEAD~2 ist der Vor-Vorgänger-Commit (2 Schritte zurück).

## Auf Origin zurücksetzen
```git reset --hard origin/<branch-name>```


## Mergen des Branch
```git merge origin main```
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

# Environment

- `GITHUB_TOKEN`: Fine-grained Personal Access Token mit Lese- und Schreibzugriff auf den Repository-Inhalt. Darf NICHT als Secret definiert werden
- `GITHUB_REPOSITORY`: Repository im Format `owner/repository`.
- `GITHUB_BRANCH`: Zielbranch (optional, Standard: `main`).
- `GITHUB_DATA_PATH`: Speicherpfad (optional, Standard: `data/contributions.json`).

Das Token darf nicht im Frontend oder in eingecheckten Dateien hinterlegt werden. Bis eine Anmeldung oder ein anderer Zugriffsschutz ergänzt ist, kann jeder Besucher die öffentliche API zum Einreichen von Beiträgen aufrufen. Die Einträge sind entsprechend der Sichtbarkeit des Repositorys einsehbar; vertrauliche Daten sollten daher nicht eingereicht werden. Die API ist von der Speicherung getrennt, sodass später die GitHub-Speicherung durch eine Datenbankanbindung ersetzt werden kann.

Die Beitragsübersicht unter `projektierung/beitraege` liest die Einträge bei jedem Aufruf über dieselbe Netlify Function und denselben konfigurierten GitHub-Branch wie das Formular. Dort lassen sich Beiträge erstellen, bearbeiten und löschen; Änderungen erscheinen als Commits und bleiben in der Git-Historie nachvollziehbar. Beim Erstellen werden der Bereich `Theorie`, `Praxis` oder `Komponente` und die Priorität `Hoch`, `Mittel` oder `Niedrig` ausgewählt. Neue Beiträge erhalten standardmäßig die Priorität `Mittel`; ältere Beiträge ohne Priorität werden ebenfalls als `Mittel` angezeigt und erst beim Bearbeiten mit Priorität gespeichert. Ältere Beiträge ohne Bereich werden als „Ohne Bereich“ angezeigt und können beim Bearbeiten zugeordnet werden. Neue Beiträge erhalten den Status `New`; bestehende Beiträge ohne Status werden ebenfalls als `New` angezeigt und erst beim Bearbeiten mit Status gespeichert. Im Bearbeitungsmodus stehen außerdem `Active` und `Resolved` zur Auswahl. Ohne Zugriffsschutz kann jeder Besucher Beiträge bearbeiten oder löschen. Für die Übersicht muss die JSON-Datei auf dem konfigurierten Branch vorhanden sein und ein Array enthalten. Die Übersicht und ihre API sind ebenfalls öffentlich zugänglich, auch wenn das Repository privat ist. Das lokale `npm run dev` startet keine Netlify Functions; zum Testen wird eine Netlify-Umgebung benötigt.

Die Beschreibung ist optional. Beiträge können bis zu 100 Checklistenpunkte mit je maximal 200 Zeichen enthalten. Punkte werden beim Erstellen oder Bearbeiten hinzugefügt und entfernt; das Abhaken erfolgt im Bearbeitungsmodus und wird beim Speichern übernommen. Ältere Beiträge ohne Checkliste bleiben unverändert nutzbar.

### Deploy Preview für die Entwicklung

1. Das GitHub-Repository in Netlify verknüpfen, `main` als Produktionsbranch wählen und Deploy Previews aktivieren.
2. Einen Pull Request vom Feature-Branch nach `main` öffnen. Netlify baut dafür eine eigene Preview-URL, ohne die Produktionsseite zu veröffentlichen.
3. Weitere Änderungen auf den Feature-Branch pushen; der offene Pull Request erhält automatisch eine aktualisierte Preview.
4. Erst nach Abschluss der Tests den Pull Request nach `main` mergen.

Für den Deploy-Preview-Kontext müssen die Umgebungsvariablen in Netlify separat gesetzt werden, wenn auch das Speichern getestet werden soll. Ohne explizites `GITHUB_BRANCH` schreibt die Function nach `main`, auch in einer Preview. Für isolierte Tests empfiehlt sich daher ein separates Test-Repository mit eigenem, darauf eingeschränktem Token und einer bestehenden leeren JSON-Array-Datei. `GITHUB_REPOSITORY`, `GITHUB_TOKEN` und gegebenenfalls `GITHUB_BRANCH` im Kontext **Deploy Previews** entsprechend setzen. Nach Änderungen an den Umgebungsvariablen die Preview erneut deployen.

Die Produktionskonfiguration in `netlify.toml` überspringt Builds, wenn seit dem letzten erfolgreichen Build ausschließlich `data/contributions.json` geändert wurde. Dadurch löst nicht jeder gespeicherte Beitrag einen Produktions-Deploy aus. Wird `GITHUB_DATA_PATH` geändert, muss die Ignore-Regel entsprechend angepasst werden. Dokumentationsseiten unter `src/content/docs` bleiben buildrelevant.

Deploy Previews haben laut aktueller Netlify-Preisliste keine Produktions-Deploy-Gebühr, sind aber nicht grundsätzlich ohne Credit-Verbrauch: Zugriffe, Datenverkehr und Function-Ausführungen können Credits verbrauchen. Die genauen Konditionen hängen vom Tarif ab und sind im Netlify-Dashboard und in der [Preisliste](https://www.netlify.com/pricing/) zu prüfen.

# Testing

```npm install --save-dev --save-exact @biomejs/biome```
```npx biome init```
```npx @biomejs/biome check```

### Astro Typen- & Komponentenprüfung (```astro check```)
```npm install --save-dev @astrojs/check typescript```

### Produktions-Build testen (`astro build`)

## 🛠️ Phase 1: Code-Hygiene & Automatisierte Prüfungen

- [ ] **Linter & Formatter (`biome check`)**
  - Installation: ```npm install --save-dev --save-exact @biomejs/biome```
```npx biome init```
  - Befehl: `npx @biomejs/biome check .`
  - Keine Syntaxfehler, ungenutzten Variablen oder toten Imports mehr vorhanden.
- [ ] **Astro Typen- & Komponentenprüfung (`astro check`)**
  - Befehl: `npx astro check`
  - Alle Props, Datenübergaben und `.astro`-Templates sind fehlerfrei typisiert.
- [ ] **Produktions-Build testen (`astro build`)**
  - Befehl: `npm run build`
  - Der Build läuft lokal mit **0 Fehlern** durch und erzeugt den Ordner `dist/`.
- [ ] **Bereinigung von Debug-Code**
  - Keine verbliebenen `console.log(...)`-Befehle im Client-Code.
  - Veraltete Kommentare und Test-Dateien der KI entfernt.
- [ ] **Sicherheit: Geheimnisse & API-Keys**
  - Keine Passwörter, Token oder geheimen Keys im Quellcode oder Git-Repository.
  - Nur öffentlich vorgesehene Variablen nutzen das Präfix `PUBLIC_`.
  - `.env` ist in der `.gitignore` eingetragen; eine `.env.example` dient als Vorlage.

---

## 🧠 Phase 2: Inhalt & Logik-Audit (manuelle Checks)

- [ ] **Vollständige Entfernung von Dummy-Inhalten**
  - Volltextsuche nach Begriffen wie: `Lorem`, `TODO`, `Test`, `Mock`, `Placeholder`, `asdf`.
  - Alle Lektionen, Quizzes und Erklärungen enthalten echte, fachlich geprüfte Inhalte.
- [ ] **Interaktionsprüfung aller Buttons & Links**
  - Keine „Dead Buttons“ mit leerem Link (`href="#"`) oder Dummy-Klickhandlern.
  - Alle internen Links leiten zur richtigen Lektion oder Unterseite.
  - Alle externen Links öffnen korrekt (idealerweise mit `rel="noopener noreferrer"`).
- [ ] **Lernpfad-Navigation & Ablauflogik**
  - Vor- und Zurück-Buttons führen in der didaktisch korrekten Reihenfolge.
  - Abgeschlossene Module werden visuell eindeutig als erledigt gekennzeichnet.
- [ ] **Zustandsspeicherung (State / Progress)**
  - Lernfortschritte (z. B. über `localStorage` gespeichert) bleiben nach Neuladen der Seite erhalten.
  - Falls vorhanden: Reset-Funktion („Fortschritt zurücksetzen“) funktioniert wie erwartet.

---

## 📱 Phase 3: Responsivität & Geräte-Kompatibilität
- [ ] **Echtes Smartphone-Testing**
  - Auf mindestens einem physischen Smartphone (iOS oder Android) getestet.
  - Keine horizontalen Scrollbalken (horizontales Ausbrechen des Layouts).
  - Alle Schaltflächen und Navigationspunkte sind mit dem Daumen gut treffbar (mind. 44x44 Pixel).
- [ ] **Cross-Browser-Gegenprobe**
  - **Chrome / Chromium:** Standardprüfung für Desktop und Android.
  - **Safari (iOS / macOS):** Wichtig, da WebKit CSS-Flexbox/Grid und Abstände oft anders interpretiert.
  - **Firefox:** Prüfung auf Rendering-Auffälligkeiten.
- [ ] **Dark- / Light-Mode (falls integriert)**
  - Texte bleiben in beiden Modi kontrastreich und lesbar.
  - Grafiken und Icons passen sich farblich an.

---

## ⚡ Phase 4: Performance, SEO & Barrierefreiheit (A11y)

- [ ] **Bilder & Medien-Optimierung**
  - Bilder liegen in modernen Formaten vor (WebP oder AVIF).
  - Bilder werden über die Astro-eigene `<Image />`-Komponente geladen (automatische Größenanpassung).
  - Keine unkomprimierten Multi-Megabyte-Dateien im Verzeichnis `public/`.
- [ ] **Barrierefreiheit (Accessibility)**
  - Alle informativen Bilder besitzen ein aussagekräftiges `alt`-Attribut.
  - Logische Überschriftenstruktur eingehalten (nur ein einziges `h1` pro Seite, danach saubere `h2` und `h3`).
  - Text-zu-Hintergrund-Kontraste genügen mindestens dem WCAG AA-Standard.
- [ ] **Favicon & Meta-Informationen**
  - Standard-Astro-Favicon (`favicon.svg`) durch eigenes Logo/Icon ersetzt.
  - Jede Seite verfügt über einen aussagekräftigen `<title>` und eine `<meta name="description">`.
  - Social-Media-Vorschau (Open Graph / Twitter Card Tags inkl. `og:image`) konfiguriert.
- [ ] **Lighthouse-Audit**
  - Google Chrome DevTools -> Lighthouse-Audit ausführen.
  - Ziel: Performance, Accessibility, Best Practices und SEO jeweils bei **90+ Punkten**.

---
## ⚖️ Phase 5: Rechtliches & Server-Infrastruktur

- [ ] **Rechtliche Pflichtseiten (DACH-Raum)**
  - Vollständiges, leicht auffindbares **Impressum** (Diensteanbieter, Anschrift, Kontakt).
  - DSGVO-konforme **Datenschutzerklärung** (Angabe von Hosting-Provider, Analysetools, Schriftarten).
- [ ] **Eigene 404-Fehlerseite (`src/pages/404.astro`)**
  - Nutzerfreundliche Fehlerseite vorhanden.
  - Enthält einen direkten Link zurück zur Startseite oder zum Lernpfad.
- [ ] **Hosting & Domain**
  - SSL/HTTPS-Zertifikat ist aktiv (automatisch bei Vercel, Netlify, Cloudflare Pages etc.).
  - Eigene Domain erfolgreich verbunden (inkl. Weiterleitung von `http` auf `https` und `www` auf non-`www`).
- [ ] **Build-Umgebungsvariablen**
  - Alle für den Produktionsbetrieb nötigen Variablen im Dashboard des Hoster-Dienstes hinterlegt.

---
## 📋 Definition of Done (DoD)

Das Projekt gilt erst dann als **bereit für den Release**, wenn:
1. Alle Befehle des Pre-Flight-Skripts mit Exit-Code `0` durchlaufen:
   ```bash
   npx @biomejs/biome check . && npx astro check && npm run build
   ```
2. Mindestens ein vollständiger Durchlauf des Lernpfads auf einem mobilen Endgerät erfolgreich protokolliert wurde.
3. Impressum, Datenschutzerklärung und 404-Seite funktionstüchtig live geschaltet sind.
