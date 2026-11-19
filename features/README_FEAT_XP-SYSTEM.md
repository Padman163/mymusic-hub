# XP-System

Diese Referenz beschreibt die zentrale XP-Engine, den Lernpfad, den Humpa-Shop,
das Inventar und das Studio. Angemeldete Lernende speichern ihren persönlichen
Fortschritt online in Netlify Blobs. Das Dashboard wird aus diesem Lernstand
berechnet und nicht als separates Dokument gespeichert.

## Verantwortung und Dateien

- `src/lib/learning-progress.ts`: Fortschritt, XP-Gutschriften, Level,
  Käufe und Ausrüstung
- `src/lib/learning-progress-sync.ts`: Konto-gebundene Synchronisierung und
  lokale Cache-/Erstmigrationslogik
- `netlify/functions/learning-progress.ts`: Authentifizierte, pro Konto
  isolierte Cloud-Persistenz
- `src/lib/learning-config.ts`: gemeinsame Online-Konfiguration des Shop-Katalogs
- `src/lib/xp-tags.ts`: XP-Basiswerte, Tags und Berechnung
- `src/lib/module-player-ui.ts`: XP-Änderungen im Lernpfad und Aufgaben-Sound
- `src/lib/inventory-ui.ts`: Humpa-Shop und Inventar
- `src/lib/studio-ui.ts`: Studio, Sound-Auswahl und Ausrüstung
- `src/styles/module-player.css`: gemeinsame Darstellung

## XP verdienen

XP werden einmalig für abgeschlossene Theorieblöcke, Lernpfad-Aufgaben und
Praxisblöcke vergeben. Abschluss-Quiz und Fastlane schreiben ebenfalls XP gemäß
den zentralen Berechnungsregeln gut.

Mehrere Wiederholungen derselben Aufgabe vergeben keine zusätzlichen XP.
`solvedQuestionIds`, `completedTheoryBlockIds` und
`completedPracticeBlockIds` schützen bereits abgeschlossene Inhalte vor
doppelter Vergütung.

## Gesamt-XP, Level und verfügbares Guthaben

Die gespeicherten Gesamt-XP bleiben auch nach Shop-Käufen unverändert:

- **500 Gesamt-XP** ergeben ein Level.
- `spentXp` dokumentiert die im Shop ausgegebenen XP.
- Verfügbares Guthaben ist `max(0, totalXp - spentXp)`.
- Dashboard und Level-Informationen verwenden weiterhin die Gesamt-XP.
- Humpa-Shop und Inventar zeigen das verfügbare Guthaben.

So bleibt die persönliche Lernleistung nachvollziehbar, obwohl XP gleichzeitig
als Kaufwährung verwendet werden können.

## Persistenz

Der persönliche Lernstand wird im Netlify-Blob-Store `mymusic-hub-user-data`
unter einem Schlüssel pro verifiziertem Netlify-Identity-Konto gespeichert.
Eine lokale, konto-getrennte Cache-Kopie hält die Oberfläche reaktionsschnell;
beim ersten Anmelden wird ein vorhandener Gaststand in das Konto übernommen,
falls dort noch kein Cloud-Lernstand existiert. Wenn bereits ein Cloud-Stand
vorhanden ist, ist dieser maßgeblich. Änderungen werden per ETag gegen
gleichzeitige Änderungen auf anderen Geräten geschützt.

Ohne Anmeldung bleibt ein Lernstand vorübergehend browserlokal und wird nicht
mit der Cloud synchronisiert. Die Account-Oberfläche zeigt den Synchronstatus.
Die Sanitierung ergänzt fehlende Felder alter Speicherstände und gleicht den
Zustand mit neu hinzugekommenen Modulen ab.

Gespeichert werden unter anderem:

- Gesamt-XP und ausgegebene XP
- XP nach Lernbereich und Themengebiet
- Modul- und Schrittstatus
- gelöste Aufgaben und abgeschlossene Blöcke
- gekaufte Inventar-Items
- aktuell ausgerüstete Item-ID
- Quiz-Bestwerte und Einstellungen

Beim geschützten Reset wird der vollständige Lernfortschritt einschließlich XP,
Käufen, Inventar und Ausrüstung zurückgesetzt und bei aktiver Anmeldung mit dem
Online-Konto synchronisiert.

## Humpa-Shop

Der Humpa-Shop ist unter **Bediener → Humpa-Shop** erreichbar und verwendet
Starlight-Tabs wie der Modul-Builder. Der Reiter **Sounds** enthält aktuell:

- **Click:** 10 verfügbare XP
- **Kick:** 30 verfügbare XP
- Jeder Sound kann nur einmal gekauft werden
- Klick auf das Symbol: Sound-Vorschau
- Klick auf den Preis: Kauf
- Bei zu wenig XP bleibt der Kauf gesperrt
- Der Kauf verändert weder Gesamt-XP noch Level

Click nutzt das Kreis-Symbol, Kick wird in Shop, Inventar und Studio als
Bassdrum-Symbol dargestellt.

Der Shop-Katalog liegt unter `learningConfig.shopItems` gemeinsam mit den
Moduldaten im Blob-Key `modules`. Die versionierte Quelle dafür ist
`data/blob-snapshot/modules.json`; Änderungen werden wie andere globale
Blob-Daten kontrolliert mit `npm run blobs:push` hochgeladen.

## Inventar

Unter **Bediener → Inventar** werden gekaufte Items im Reiter **Sounds**
angezeigt. Das Kopfbadge zeigt das verfügbare XP-Guthaben. Ein Sound-Symbol im
Inventar kann direkt angeklickt werden, um den Sound abzuspielen.

## Studio

Unter **Bediener → Studio** können gekaufte Sounds für Lernaufgaben ausgerüstet
werden. Die Ansicht dient als Erweiterungspunkt für spätere Instrumente und
weitere Ausrüstungsarten.

Ein gekaufter Sound kann:

- per Klick ausgewählt werden
- per Drag-and-drop in das Metronom gezogen werden
- per Zurückziehen zu **Verfügbare Sounds** deaktiviert werden
- im Slot zur Vorschau abgespielt werden

Es kann ein Sound aktiv sein. Das Metronom dient als Sound-Slot. Die gewählte
Item-ID wird im persönlichen Online-Lernstand gespeichert. Beim Prüfen von
Lernpfad- und Quizaufgaben wird der aktuell ausgerüstete Sound abgespielt.
Ein ausgerüsteter Sound wird nicht mehr unter **Verfügbare Sounds** aufgeführt.
Nach dem Ablegen erscheint er dort wieder.

## Regeln für neue Items

Neue Shop-Items benötigen mindestens:

- eindeutige `id`
- Anzeigenamen
- Beschreibung
- Preis in XP
- optional eine lokale `assetUrl`
- falls zutreffend eine Zuordnung zum Studio-Slot

Items dürfen nur über `purchaseInventoryItem` gekauft werden. Damit bleiben
Guthabenprüfung, Ausgabenverbuchung und Doppelkäuferschutz zentral.

## Bedienung und Tests

Die nutzerseitige Anleitung steht in der
[Inventar- und Shop-Anleitung](../src/content/docs/wiki/inventar.mdx).

Fachtests liegen in:

- `tests/learning-progress.test.mjs`
- `tests/components/inventory-ui.test.ts`
- `tests/components/module-player-ui.test.ts`
- `tests/e2e/smoke.spec.ts`

Die gültigen Befehle und Teststufen stehen im
[Testing-Leitfaden](../README_TESTING.md).
