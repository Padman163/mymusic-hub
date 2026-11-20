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
Online-Site aktualisieren keine lokalen Dateien; vor einem Deploy den
branchbezogenen Snapshot und den aktuellen Online-Stand prüfen.

Der `modules`-Key enthält neben Modulen und Quiz-Einstellungen auch
`learningConfig.shopItems`. Dashboard, XP, Käufe, Inventar und Studio-Ausrüstung
werden dagegen pro Nutzerkonto im separaten Store `mymusic-hub-user-data`
gespeichert und nicht durch `blobs:pull` oder `blobs:push` überschrieben.

Ohne `LOCAL_NETLIFY_ONLINE_DATA=true` initialisiert `npx netlify-cli dev`
fehlende lokale Keys aus den versionierten Snapshots. Vorhandene lokale Keys
bleiben bestehen. Schreibvorgänge aktualisieren dann die Snapshot-Dateien,
aber nicht automatisch die Cloud.

Um im getrennten lokalen Modus den Online-Stand zu übernehmen:

```bash
npx netlify-cli link
npm run blobs:pull
npm run blobs:reset
npx netlify-cli dev
```

`blobs:reset` fragt vor dem Entfernen des lokalen Blob-Stands unter
`.netlify/blobs-serve` nach Bestätigung. Zuerst Netlify Dev stoppen und nicht
gespeicherte lokale Änderungen sichern. Beim nächsten Start werden die beiden
Keys aus den Snapshots neu angelegt.

Nur für die bewusste Übertragung eines getrennt bearbeiteten lokalen Stands:

```bash
git diff -- data/blob-snapshot
npm run blobs:push
```

`blobs:push` lädt beide Cloud-Blobs, erstellt daraus automatisch ein gemeinsames
Archiv unter `data/blob-archive/<Zeitstempel>/`, fragt nach Bestätigung und
schreibt anschließend beide lokalen Snapshots in die Cloud. Ohne die interaktive
Bestätigung wird nichts hochgeladen. `npm run blobs:push -- --yes` ist nur für
bewusst automatisierte Abläufe gedacht.

Für eine separate Sicherung ohne Upload:

```bash
npm run blobs:backup
```

Ein Archiv kann interaktiv in die lokalen Snapshots zurückkopiert werden:

```bash
npm run blob:restore
```

Wähle ein Backup mit den Pfeiltasten und Enter aus und bestätige das
Überschreiben beider Snapshot-Dateien. Die neuesten Backups stehen oben.
Sichere ungespeicherte lokale Änderungen vorher. Beide
Archivdateien werden vor dem Überschreiben geprüft. Die Cloud und der lokale
Netlify-Blob-Store bleiben unverändert. Für eine Online-Wiederherstellung erst
den aktuellen Cloud-Stand und die Snapshots vergleichen und anschließend
bewusst `npm run blobs:push` ausführen. Dabei werden beide Online-Keys ersetzt;
zwischenzeitliche Online-Änderungen gehen dabei verloren. Der Push erstellt
vorher ein weiteres Cloud-Backup. Im getrennten lokalen Modus ist für die
Übernahme in Netlify Dev nach Sicherung lokaler Änderungen und bei gestopptem
Server zusätzlich `npm run blobs:reset` nötig.

Für die Cloud-Transferbefehle verwende die normale Netlify-CLI-Anmeldung und
führe einmal `npx netlify-cli login` und `npx netlify-cli link` aus. Der lokale
Restore benötigt keine Anmeldung. Eine lokale `.env` und ein Token im
Repository werden für die Transferbefehle nicht benötigt.

## Deploy Preview und Branch Deploy

Production, Deploy Previews und Branch Deploys lesen dieselben siteweiten
gemeinsamen Daten. Änderungen über die APIs für Beiträge und Module sind in
allen Deploy-Kontexten nur für angemeldete Admins mit passendem Origin erlaubt.
Die `/api/learning-progress`-Function akzeptiert authentifizierte Änderungen
ausschließlich für das jeweilige Nutzerkonto.

**Überschreibungswirkung:** Branchbezogene Snapshots sind versionierte
Datenquellen und können beim Deploy den gemeinsamen Online-Stand überschreiben.
Deshalb vor Deploys die betroffenen Daten vergleichen und sichern. Ein
`blobs:push` überschreibt beide gemeinsamen Keys und schützt nicht vor
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
| [`netlify-blob-transfer.ts`](../scripts/netlify-blob-transfer.ts) | Lädt Cloud-Daten, erstellt Archive, bestätigt Uploads und setzt den lokalen Blob-Store zurück. |
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
