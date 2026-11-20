# Netlify Blobs: Persistenz für Beiträge und Lernmodule

Netlify Blobs (`@netlify/blobs`) speichert Beiträge, Module und gemeinsame Lernkonfiguration. Schreibzugriffe erzeugen keine Git-Commits und lösen damit keine Builds aus. Der JSON-Store `mymusic-hub-data` ist vom geplanten Store `mymusic-hub-media` für Audio und Bilder getrennt; Medien werden noch nicht gespeichert. Persönliche Lernstände liegen getrennt im Store `mymusic-hub-user-data`, jeweils unter einem Schlüssel für ein verifiziertes Netlify-Identity-Konto.

## Setup und Branch-Wechsel

Die Abhängigkeiten `@netlify/blobs` und `@netlify/identity` stehen im Manifest. In einem frischen Workspace genügt die normale Installation über das Lockfile.

1. Stelle sicher, dass der Deploy-Branch den Netlify-Blobs-Code und die
Transfer-Skripte enthält.
2. Im Netlify Dashboard unter **Site configuration → Build & deploy → Continuous deployment → Branches and deploy contexts** den Branch für Branch Deploys/Deploy Previews freigeben oder bewusst als Production Branch setzen.
3. Unter **Environment variables** die alten `GITHUB_*`-Variablen für die Datenspeicherung nach dem Wechsel entfernen, sofern sie nicht von anderen Verbrauchern benötigt werden. Für noch aktive alte Deploys oder einen geplanten Rollback erst deren Abhängigkeiten klären. Netlify stellt den Blob-Kontext für die Functions bereit.

**Wichtig:** [`getStore`](https://docs.netlify.com/build/data-and-storage/netlify-blobs/#getstore) ist **siteweit**. Production, Branch Deploys und Previews derselben Site verwenden dieselben Daten und können sie ändern. Für isolierte Online-Abnahmen eine separate Netlify-Site verwenden; Branch-Freigabe und Deploy-Kontext allein isolieren den Store nicht. `getDeployStore` wäre dagegen deployspezifisch und wird hier bewusst nicht verwendet.

## Lernkonten und persönliche Daten

Für konto-gebundene Lernstände wird Netlify Identity verwendet. Identity muss im
Netlify-Dashboard für die Site aktiviert und die Registrierung auf **Invite
only** gestellt werden. Konten werden über Einladungen angelegt; Login,
Einladung und Passwort-Wiederherstellung laufen über die Lernkonto-Oberfläche.
Details zu Rollen, Einladungen und Kontosynchronisierung stehen in der
[Authentifizierungs-Referenz](README_FEAT_AUTHENTICATION.md).

Admins mit der Netlify-Identity-Rolle `admin` können Einladungen unter
**Admin → Konten & Einladungen** versenden und dort den aktuellen
Registrierungsstatus prüfen. Das Backend prüft die Rolle serverseitig und nutzt
den nur in Netlify Functions verfügbaren Identity-Operator-Token für den
Einladungsversand. Die Identity-API bietet hier keine Schreiboperation für den
Registrierungsmodus; Änderungen an **Invite only** bleiben daher in der
Netlify-Site-Konfiguration. Der Admin-Bereich zeigt den Zustand an und
behauptet nicht, eine Änderung vorgenommen zu haben.

`/api/learning-progress` prüft die Netlify-Identity-Sitzung serverseitig. Der
Schlüssel wird ausschließlich aus der bestätigten Konto-ID gebildet; Requests
können daher keine Lernstände anderer Konten lesen oder überschreiben. Diese
Function darf im gehosteten Kontext nur den Lernstand des angemeldeten Kontos
ändern. Gemeinsame Beiträge, Module und die Shop-Konfiguration dürfen nur
Konten mit der serverseitig geprüften Rolle `admin` ändern.

Persönliche Kontodaten liegen nicht in `data/blob-snapshot` oder den
versionskontrollierten Blob-Archiven. Der Blob-Transfer sichert nur den
gemeinsamen Store `mymusic-hub-data`; für `mymusic-hub-user-data` ist ein
separates Backup-/Exportverfahren erforderlich.

Der separate Admin-Endpunkt
[`/api/admin/learning-progress`](../netlify/functions/admin-learning-progress.ts)
liest die Nutzerliste über die serverseitige Netlify-Identity-Admin-API.
Admins sehen XP, Inventar und Lehrgangsstände für das gewählte Konto.
Der bestätigte Reset ist in Production und Deploy Previews möglich und
ersetzt nur den gewählten Lehrgangsstand mit ETag-Prüfung, damit gleichzeitige
Änderungen nicht überschrieben werden. Die Inhaltsbackups enthalten diese
persönlichen Daten weiterhin nicht.

Der Reset bewahrt die IDs der bereits vergüteten Inhalte im selben
persönlichen Lernstand. Ein erneuter Abschluss vergibt für diese Inhalte
keine zusätzlichen XP.

## Empfohlener Datenfluss

Netlify Dev verwendet normalerweise einen getrennten lokalen Blob-Store. Nach
gesicherter Datenübernahme und Deployment der aktuellen Functions kann
`LOCAL_NETLIFY_ONLINE_DATA=true` in der nicht versionierten `.env.local` gesetzt
werden. Dann leiten die lokalen APIs für Module, Beiträge und persönlichen
Lernstand Anfragen an die in `LOCAL_NETLIFY_IDENTITY_ORIGIN` konfigurierte
HTTPS-Site weiter. Die Anmeldung und die Daten müssen zur selben Site gehören.
Netlify Dev nach der Konfigurationsänderung neu starten.

Lokale Schreibzugriffe auf gemeinsame Daten aktualisieren nach erfolgreicher
Online-Speicherung auch die Snapshot-Dateien und bei Modulen die lesbaren
MDX-Kopien. Schlägt dieser lokale Abgleich fehl, meldet die API ausdrücklich,
dass die Online-Speicherung bereits erfolgt ist. Änderungen direkt auf der
Online-Site aktualisieren keine lokalen Dateien. Wer danach lokale Kopien
braucht, kann den neuen Stand mit `npm run blobs:pull` übernehmen.

Der `modules`-Key enthält neben Modulen und Quiz-Einstellungen auch
`learningConfig.shopItems`. Dashboard, XP, Käufe, Inventar und Studio-Ausrüstung
werden dagegen pro Nutzerkonto im separaten Store `mymusic-hub-user-data`
gespeichert und nicht durch `blobs:pull` oder `blobs:push` überschrieben.

Ohne `LOCAL_NETLIFY_ONLINE_DATA=true` initialisiert `npx netlify-cli dev`
fehlende lokale Keys aus den versionierten Snapshots. Vorhandene lokale Keys
bleiben bestehen. Schreibvorgänge aktualisieren dann die Snapshot-Dateien,
aber nicht automatisch die Cloud.

## Online-Backups im Admin-Bereich

[Admin → Datenstand & Backups](../src/pages/admin/datenstand.astro) zeigt den
aktuellen Online-Stand und die Sicherungen. Die
[Bedienungsanleitung](../src/content/docs/wiki/datenstand-backups.mdx)
beschreibt die einzelnen Schritte. Die Übersicht ist für Admins auch in
Previews und lokal über den bestehenden Online-Proxy verfügbar. Erstellen,
Download, Restore-Vorschau und Restore sind für Admins im veröffentlichten
Produktions-Deploy und in Deploy Previews verfügbar. Lokal und in Branch
Deploys bleibt die Oberfläche schreibgeschützt. Deploy Previews nutzen
denselben Backup-Store wie Production; ein Restore ändert den gemeinsamen
Live-Stand der Site.

Online-Backups liegen als einzelne JSON-Dokumente im siteweiten
`mymusic-hub-backups`-Store und sind unabhängig von lokalen CLI-Archiven.
Ein JSON-Download enthält die beiden Datenbestände unter `data.contributions`
und `data.modules`; für den CLI-Notfallweg können sie als separate
`contributions.json` und `modules.json` in einem lokalen Archiv abgelegt
werden. Ein Upload in der Admin-Oberfläche ist nicht vorgesehen.

Der Restore verlangt eine aktuelle Vorschau, die Schreibbestätigung
`WIEDERHERSTELLEN` und ein erfolgreich gespeichertes Sicherheitsbackup.
Die Live-Keys werden einzeln mit ETag-Prüfung ersetzt; Netlify Blobs bietet
dafür keine gemeinsame Transaktion. Bei einem Konflikt am zweiten Key
versucht die Function, den ersten nur dann zurückzusetzen, wenn er seit dem
Restore-Schreibzugriff unverändert geblieben ist. Ein möglicherweise
teilweiser Restore wird samt Sicherheitsbackup-ID gemeldet. Die Oberfläche
ändert keine lokalen Snapshots und keine MDX-Kopien.

## Blob-Befehle: Push, Pull, Restore, Backup und Reset

**Gesichert und wiederhergestellt werden nur die gemeinsamen Beiträge und
Lektionen (Lernmodule)** aus `mymusic-hub-data`. Dazu gehören die Aufgaben,
Quiz-Einstellungen und der gemeinsame Shop-Katalog, weil sie in `modules.json`
gespeichert sind. Konten, Passwörter, persönliche Lernstände, XP, Inventar und
Mediendateien sind nicht enthalten.

| Befehl | Richtung | Wirkung |
| --- | --- | --- |
| `npm run blobs:push` | Lokale Snapshots → Cloud | Fragt nach Bestätigung, sichert den bisherigen Cloud-Stand als datiertes Archiv und überschreibt dann beide Online-Keys vollständig. Kein Merge, kein Schutz vor gleichzeitigen Änderungen. |
| `npm run blobs:pull` | Cloud → lokale Snapshots | Überschreibt `contributions.json` und `modules.json` in `data/blob-snapshot/` mit dem aktuellen Online-Stand. Erstellt kein Archiv und ändert weder die Cloud noch den laufenden lokalen Store. |
| `npm run blobs:restore` | Lokales Archiv → lokale Snapshots | Zeigt die neuesten Backups zuerst. Mit Pfeiltasten und Enter auswählen. Prüft beide Dateien und überschreibt die Snapshots erst nach Bestätigung. Der lokale Store und die Cloud bleiben unverändert. |
| `npm run blobs:backup` | Cloud → lokales Archiv | Speichert beide Dateien in `data/blob-archive/<Zeitstempel>/`. Ändert weder die Cloud noch die Snapshots. Ein neues Archiv ist nur in diesem Workspace verfügbar, bis du es separat überträgst, etwa per Git. |
| `npm run blobs:reset` | Lokalen Store löschen | Entfernt nach Bestätigung `.netlify/blobs-serve/`. Im getrennten lokalen Modus werden fehlende Keys danach aus den Snapshots angelegt. Archive, Snapshots und Cloud bleiben unverändert. Ungesicherte Daten im lokalen Store gehen verloren. |

Für `backup`, `pull` und `push` ist eine Netlify-CLI-Anmeldung und die
Verknüpfung mit der richtigen Site nötig (`npx netlify-cli login`,
`npx netlify-cli link`). `restore` und `reset` arbeiten rein lokal.
`--yes` überspringt bei `push` und `reset` die Bestätigung und ist nur für
bewusst automatisierte Abläufe gedacht.

### Online-Stand oder Backup lokal ansehen

1. Netlify Dev stoppen und ungesicherte lokale Änderungen sichern.
2. In `.env.local` `LOCAL_NETLIFY_ONLINE_DATA=false` setzen. Mit `true` zeigt
   Netlify Dev weiterhin den Online-Stand.
3. Für den aktuellen Online-Stand `npm run blobs:pull` ausführen. Für ein
   älteres Backup stattdessen `npm run blobs:restore` ausführen.
4. `npm run blobs:reset` ausführen und bestätigen. Danach Netlify Dev mit
   `npx netlify-cli dev` neu starten. Ein Push ist dafür nicht nötig.

### Backup online wiederherstellen

1. Lokale Änderungen sichern und das gewünschte Archiv mit
   `npm run blobs:restore` in die Snapshots kopieren.
2. Mit `npx netlify-cli status` die Ziel-Site prüfen. Die wiederhergestellten
   Snapshots mit dem aktuellen Online-Stand vergleichen. Dafür kann ein neues
   `npm run blobs:backup` den Online-Stand separat sichern. **Kein Pull**:
   Der würde die wiederhergestellten Snapshots wieder überschreiben.
3. Nur wenn beide Online-Datenbestände ersetzt werden sollen,
   `npm run blobs:push` ausführen und bestätigen. Seit dem gewählten Backup
   hinzugekommene Online-Änderungen fehlen danach im aktiven Stand.

## Deploy Preview und Branch Deploy

Production, Deploy Previews und Branch Deploys lesen dieselben siteweiten
gemeinsamen Daten. Änderungen über die APIs für Beiträge und Module sind in
allen Deploy-Kontexten nur für angemeldete Admins mit passendem Origin erlaubt.
Die `/api/learning-progress`-Function akzeptiert authentifizierte Änderungen
ausschließlich für das jeweilige Nutzerkonto.

**Überschreibungswirkung:** Der im Repository konfigurierte Build
(`npm run build`) importiert keine Snapshots. Der Online-Store ist der
maßgebliche Datenstand. Falls im Netlify-Dashboard ein eigener
Snapshot-Import als Build-Befehl oder Plugin hinterlegt ist, diesen vor
der Freigabe deaktivieren. Ein bewusst ausgeführtes `blobs:push`
überschreibt weiterhin beide gemeinsamen Keys und schützt nicht vor
gleichzeitigen Änderungen; den Online-Modus nicht mit routinemäßigen
Snapshot-Uploads kombinieren.

## Architektur und Datenfluss

| Datei | Verantwortung |
| --- | --- |
| [`blob-store.ts`](../netlify/functions/lib/blob-store.ts) | Kapselt Store-Namen, typisierte JSON-Keys, Initialisierung und konfliktgeschützte Schreibzugriffe. |
| [`contribution-store.ts`](../netlify/functions/lib/contribution-store.ts) | Fachliche Änderungen am Key `contributions` und Abgleich mit dem erwarteten Beitragsstand. |
| [`contributions.ts`](../netlify/functions/contributions.ts) | HTTP-API und Validierung für Beiträge. |
| [`modules.ts`](../netlify/functions/modules.ts) | HTTP-API für den Key `modules` (Module, Aufgaben, Quiz-Einstellungen und Shop-Katalog); Fachregeln bleiben in [`module-store.ts`](../src/lib/module-store.ts). |
| [`learning-progress.ts`](../netlify/functions/learning-progress.ts) | Authentifizierte API für pro Konto gespeicherte Lernstände im Store `mymusic-hub-user-data`. |
| [`learning-progress-sync.ts`](../src/lib/learning-progress-sync.ts) | Synchronisiert den Browser-Cache nach Anmeldung mit dem persönlichen Cloud-Lernstand. |
| [`local-blob-snapshot.ts`](../netlify/functions/lib/local-blob-snapshot.ts) | Spiegelt lokale Netlify-Dev-Schreibvorgänge in versionierte Snapshot-Dateien. |
| [`online-dev-proxy.ts`](../netlify/functions/lib/online-dev-proxy.ts) | Leitet lokale Daten-APIs bei expliziter Aktivierung an die konfigurierte Online-Site weiter. |
| [`admin-write.ts`](../netlify/functions/lib/admin-write.ts) | Prüft bei gemeinsamen Schreibvorgängen Admin-Rolle und Origin. |
| [`admin-backups.ts`](../netlify/functions/admin-backups.ts) | Admin-API für Online-Übersicht, Backup-Verwaltung und Restore. |
| [`netlify-blob-transfer.ts`](../scripts/netlify-blob-transfer.ts) | Lädt und sichert Cloud-Daten, stellt Snapshots wieder her, bestätigt Uploads und setzt den lokalen Blob-Store zurück. |
| [`astro.config.mjs`](../astro.config.mjs) | Nur beim reinen Astro-Start liest und schreibt `localModulesApiPlugin()` direkt in `data/modules.json`. Unter Netlify CLI ist dieses Plugin deaktiviert. |

Die Functions lesen mit starker Konsistenz. Fehlt `contributions`, wird `[]` gespeichert. Fehlt `modules`, startet der Katalog mit einem leeren Modulbestand und der Standard-Lernkonfiguration. Bis Quiz-Einstellungen gespeichert werden, gelten die Schema-Standardwerte. `onlyIfNew` verhindert, dass ein paralleler Erstzugriff vorhandene Daten überschreibt. Spätere Änderungen nutzen ETags (`onlyIfMatch`) mit bis zu drei Versuchen, um parallele Änderungen nicht zu verlieren.

Cloud-Daten vor einem Upload oder größeren Umbau mit `npm run blobs:backup`
sichern. Ein neuer Store übernimmt keine Daten aus anderen Stores oder Git. Ein
Rollback des Codes synchronisiert Blob-Schreibvorgänge nicht zurück nach Git.

`npx netlify-cli dev` stellt einen lokalen Blob-Server bereit. Die Daten liegen
unter `.netlify/blobs-serve/`. Im getrennten Modus wird der lokale Store nur
durch die dokumentierten Transferbefehle mit der Cloud abgeglichen. Ein leerer lokaler Store wird aus den
Snapshot-Dateien wiederhergestellt. **`.netlify/blobs-serve` nicht als
allgemeinen Build-Cache behandeln oder löschen**, solange lokale Änderungen
nicht als Snapshot oder Cloud-Backup gesichert sind.

Vor dem produktiven Umstieg den Cloud-Datenbestand sichern und die Datenübernahme sowie Rollback-Abhängigkeiten prüfen. Schreibtests in der Cloud nur auf einer isolierten Netlify-Site durchführen.

## Qualitätssicherung

```bash
npx vitest run tests/documentation.test.ts
```

Die Integrationstests laufen erst am Branch-Abschluss im manuell vom Nutzer gestarteten Preflight (siehe [Testing-Leitfaden](../README_TESTING.md)):

```bash
npm run preflight
```
