# Mein Entwicklungsworkflow

`main` ist der Hauptbranch und wird nur selten deployed. Neue Features entstehen auf `feat/<featurename>`; abgeschlossene Features werden unter `archive/feat/<featurename>` gesichert.

## 1. Workspace vorbereiten

Im neuen Workspace das Repository einrichten und den benötigten Branch auschecken: [Workspace-Setup](README_WORKSPACE_SETUP.md). Alltagsbefehle stehen im [Cheatsheet](README_CHEATSHEET.md).

Vor einem Workspace-Wechsel Änderungen prüfen, committen und den aktuellen Branch pushen. Lokale `.env`-Dateien und nicht eingecheckte Daten separat und sicher übertragen.

## 2. Feature entwickeln

Vom aktuellen `main` einen neuen Feature-Branch erstellen:

```bash
git switch main
git pull origin main
git switch -c feat/<featurename>
```

Auf diesem Branch entwickeln und Änderungen regelmäßig committen und pushen. Soll ein neues Feature auf einem noch nicht in `main` übernommenen Feature aufbauen, bewusst von dessen Archiv-Branch abzweigen statt von `main`.

Für die Speicherumstellung mit `git switch feat/netlify-blobs` auf den vorhandenen Feature-Branch wechseln. Die lokale `.env` beim Wechsel anpassen (den `GITHUB_BRANCH` nur für den Altstand setzen, danach die alten Speicher-Variablen entfernen) und den Branch separat im Netlify Dashboard freigeben. Vor dem ersten Blob-Zugriff den Datenstand gemäß [Blob-Referenz](features/README_FEAT_NETLIFYBLOB.md) sichern und abgleichen.

## 3. Automatisch testen

```bash
npm run preflight
```

Das Gate wertet Validierung, Vitest, Build, Playwright und Lighthouse CI einzeln aus und zeigt bestandene, fehlgeschlagene sowie übersprungene Schritte samt nächsten Korrekturen. `npm audit` läuft separat mit `npm run audit`. Lighthouse lädt Berichte standardmäßig temporär öffentlich hoch; eine rein lokale Ablage ist über Umgebungsvariablen möglich. Fehler beheben und erneut ausführen. Details und Voraussetzungen: [Testing](README_TESTING.md).

## 4. Cleanup und Abschlussprüfung

Die fünf Schritte der [Cleanup-Anleitung](README_CLEANUP.md) durchgehen. Löschungen und Migrationen erst nach Prüfung und Freigabe durchführen. Nach Änderungen relevante Tests und vor dem Abschluss erneut `npm run preflight` ausführen. Anschließend den endgültigen Stand committen.


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

Die Speicherumstellung nach erfolgreicher Abnahme unter `archive/feat/netlify-blobs` archivieren. Das sichert den Code, nicht den Datenbestand in Netlify Blobs. Vor einer späteren Deploy-Umstellung Branch-Freigabe im Dashboard und Datenbackup getrennt prüfen.

Archivieren übernimmt **keine** Änderungen nach `main`. Eine Übernahme per Pull Request und ein Deployment werden später separat entschieden. Danach mit Schritt 2 das nächste Feature beginnen.
