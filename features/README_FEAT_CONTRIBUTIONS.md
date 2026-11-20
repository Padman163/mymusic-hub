# Feature-Referenz: Beiträge & IssueTracker

Diese Referenz beschreibt die Erfassung und Verwaltung von Bugs, Features und Decisions auf der Seite [Admin → Beiträge](../src/content/docs/projektierung/beitraege.mdx). Die Beitragsliste ist eine browserseitige Oberfläche; Speicherung und Prüfung laufen über `/api/contributions` und Netlify Blobs. Bereitstellung, lokale Entwicklung und Verhalten des gemeinsam genutzten Blob-Stores sind in der [Netlify-Blob-Referenz](README_FEAT_NETLIFYBLOB.md) beschrieben.

Die nutzerorientierte [Bedienungsanleitung für Beiträge](../src/content/docs/wiki/beitraege.mdx) steht im Wiki.

## Fachliches Modell

Ein Beitrag besteht aus einer ID, einem Typ, Titel, Beschreibung und Erstellungszeitpunkt. Bereich, Priorität, Status und Checkliste sind optionale Felder im gespeicherten Modell, damit auch ältere Einträge ohne diese Angaben gelesen werden können.

| Feld | Werte und Regeln | Standard und Darstellung |
| --- | --- | --- |
| Typ | `Bug`, `Feature` oder `Decision`; erforderlich | Im Formular ist `Bug` vorausgewählt. Typen werden als farbige Tags mit Symbol dargestellt. |
| Titel | Erforderlich, nach Entfernen äußerer Leerzeichen 1–120 Zeichen | In Karten und Listen sichtbar. |
| Beschreibung | Optional, höchstens 10.000 Zeichen | Karten zeigen höchstens drei Zeilen. Der vollständige Text bleibt im Bearbeitungsformular verfügbar. |
| Bereich | `Theorie`, `Praxis` oder `Komponente`; bei neuen Beiträgen erforderlich | Ältere Beiträge ohne Bereich erscheinen als „Ohne Bereich“ und können beim Bearbeiten zugeordnet werden. |
| Priorität | `Hoch`, `Mittel` oder `Niedrig` | Neue und ältere Beiträge ohne gespeicherte Priorität verwenden „Mittel“. |
| Status | `New`, `Active` oder `Resolved` | Neue und ältere Beiträge ohne gespeicherten Status verwenden „New“. |
| Checkliste | Bis zu 100 Einträge; jeder Text ist nach Bereinigung 1–200 Zeichen lang. Jeder Eintrag enthält außerdem `checked`. | Neue Punkte starten unerledigt. |
| ID / Erstellungszeitpunkt | Vom Server erzeugte ID und ISO-Zeitangabe | Dienen der Identifikation und der Sortierung nach Datum. |

Die Feldlisten, Standardwerte und Prüfungen sind zentral in [`contribution-types.ts`](../src/lib/contribution-types.ts), [`contribution-area.ts`](../src/lib/contribution-area.ts), [`contribution-priority.ts`](../src/lib/contribution-priority.ts), [`contribution-status.ts`](../src/lib/contribution-status.ts) und [`contribution-checklist.ts`](../src/lib/contribution-checklist.ts) definiert.

## Teilfeatures

### 1. Beitrag erstellen

Der Button **„Neuen Beitrag erstellen“** blendet das Formular ein. Typ, Bereich und Priorität werden über auswählbare Tags festgelegt. Titel und Beschreibung sind Textfelder; die Beschreibung ist optional. Der Bereich muss für einen neuen Beitrag ausgewählt werden, Priorität „Mittel“ ist vorausgewählt. Der Server ergänzt Status „New“, wenn beim Erstellen kein Status mitgeschickt wird.

Beim Speichern prüft das Formular die Auswahlwerte, den Titel und die Checkliste. Während die Anfrage läuft, werden Eingaben und Speichern-Button deaktiviert und eine Statusmeldung angezeigt. Bei Erfolg wird das Formular zurückgesetzt, geschlossen und der neue Beitrag in die Liste übernommen. Bei einem Fehler bleibt das Formular mit einer verständlichen Fehlermeldung offen. **Schließen** setzt das Formular ebenfalls zurück.

### 2. Checklisten bearbeiten

Der gemeinsame [`checklist-editor.ts`](../src/lib/checklist-editor.ts) wird sowohl beim Erstellen als auch beim Bearbeiten verwendet:

- In der freien Eingabezeile fügt **Enter** einen bereinigten, noch offenen Punkt hinzu. Während der IME-Texteingabe wird Enter nicht abgefangen.
- Ein noch nicht bestätigter Text in der Eingabezeile wird beim Speichern ebenfalls als Punkt übernommen.
- Punkte lassen sich entfernen; die Eingabe wird bei 100 Punkten gesperrt und nach dem Entfernen wieder freigegeben.
- Im Erstellungsformular sind Häkchen deaktiviert. Im Bearbeitungsmodus können Punkte abgehakt, umformuliert, ergänzt oder entfernt werden.
- Leere bestehende Punkte und Überschreitungen der Längen- oder Mengenbegrenzung verhindern das Speichern.

In Karten zeigt der Footer den Fortschritt als erledigte von gesamten Punkten, zum Beispiel `2/4 erledigt`. Die kompakte Listenansicht blendet diesen Footer aus.

### 3. Beiträge anzeigen

Die Beitragsliste startet in der Kartenansicht. Eine Karte enthält Typ, Bereich, Priorität, Status, Titel, gekürzte Beschreibung und Erstellungsdatum. Bei vorhandener Checkliste wird zusätzlich deren Fortschritt angezeigt. Lange Wörter und Zeilenumbrüche in Beschreibungen werden in der Karte berücksichtigt.

Der Ansichtsbutton wechselt zwischen Karten und einer kompakten Listenansicht. Die Liste zeigt Typ, Titel und Bearbeitungsaktion; Beschreibung, Bereich, Priorität und Footer-Informationen (Status, Checklistenfortschritt und Datum) werden dort ausgeblendet.

Beim Laden werden Beiträge von `/api/contributions` abgerufen. Die Rückmeldung unterscheidet zwischen einer leeren Liste, einer Liste ohne Treffer und einem Ladefehler. Bei Filtern zeigt sie außerdem an, wie viele Beiträge von der Gesamtzahl sichtbar sind.

### 4. Beiträge filtern

Das Filtermenü kombiniert die ausgewählten Kriterien:

- **Typ:** alle Typen, `Bug`, `Feature` oder `Decision`.
- **Status:** standardmäßig **„Offene Beiträge (New & Active)“**; alternativ **„Alle Status“** oder ein einzelner Status (`New`, `Active`, `Resolved`). Damit sind erledigte Beiträge standardmäßig ausgeblendet, lassen sich aber gezielt einblenden.
- **Bereich:** alle Bereiche, „Ohne Bereich“ oder ein einzelner Bereich. Ein fehlender Bereich wird beim Filtern wie „Ohne Bereich“ behandelt.
- **Priorität:** alle Prioritäten oder eine der drei Prioritäten. Ein fehlender gespeicherter Wert wird beim Filtern wie „Mittel“ behandelt.

Fehlt bei einem älteren Beitrag der gespeicherte Status, wird er als `New` behandelt und erscheint damit im Standardfilter „Offene Beiträge“. Fehlt ein Filterwert, schränkt dieses Kriterium die Liste nicht ein.

### 5. Beiträge sortieren

Das Sortiermenü bietet:

- **Neueste zuerst** (Standard): absteigendes Erstellungsdatum.
- **Älteste zuerst:** aufsteigendes Erstellungsdatum.
- **Priorität: Hoch zuerst:** Reihenfolge `Hoch`, `Mittel`, `Niedrig`; bei gleicher Priorität stehen die neuesten Beiträge zuerst.

Sortierung und Filter werden gemeinsam angewendet; gefilterte Einträge bleiben in der Liste, sind aber ausgeblendet.

### 6. Beiträge bearbeiten

Die Bearbeitungsaktion öffnet ein Formular direkt in der Karte. Typ, Bereich, Priorität, Status, Titel, Beschreibung und Checkliste können geändert werden. Der Bereich muss beim Bearbeiten ausgewählt sein; dadurch können ältere Einträge ohne Bereich ergänzt werden. Beim Abbrechen werden Änderungen verworfen.

Änderungen werden über `PATCH` gespeichert. Nach Erfolg wird die Karte aus den neuen Werten gerendert und Filter sowie Sortierung werden erneut angewendet. Wird der Beitrag dadurch ausgeblendet, erhält die Statusmeldung den Fokus; andernfalls bleibt der Fokus bei der Bearbeitungsaktion. Das Formular verhindert während des Speicherns weitere Änderungen. API-Fehler werden angezeigt, ohne die Änderungen als erfolgreich darzustellen.

### 7. Beiträge löschen

Die Löschaktion fragt vor dem Entfernen per Browserdialog nach Bestätigung. Während der Anfrage sind die Formularaktionen gesperrt. Bei Erfolg wird der Beitrag aus Liste und lokalem Zustand entfernt und die Listenmeldung fokussiert. Bei einem Fehler bleibt der Eintrag vorhanden und die Fehlermeldung erscheint in seiner Karte.

### 8. Bedienbarkeit und Rückmeldungen

Formularfelder besitzen Beschriftungen; Status- und Fehlermeldungen werden über `role="status"` und `aria-live` angekündigt. Die Menüs für Filter und Sortierung schließen einander beim Öffnen aus und werden bei einem Klick außerhalb geschlossen. Buttons haben zugängliche Namen; Aktionen verwalten den Fokus beim Öffnen, Abbrechen, Speichern und Löschen.

### 9. HTTP-API und Persistenz

[`contributions.ts`](../netlify/functions/contributions.ts) stellt `/api/contributions` bereit:

| Methode | Funktion |
| --- | --- |
| `GET` | Liefert `{ contributions: [...] }`. |
| `POST` | Validiert und erstellt einen Beitrag; der Bereich ist erforderlich. Erfolgsstatus: `201`. |
| `PATCH` | Aktualisiert einen Beitrag anhand des erwarteten bisherigen Stands und der neuen Felder. |
| `DELETE` | Löscht einen Beitrag anhand des erwarteten bisherigen Stands. |

`GET` ist ohne Anmeldung lesbar. Schreibzugriffe (`POST`, `PATCH` und `DELETE`) prüfen über [`admin-write.ts`](../netlify/functions/lib/admin-write.ts) serverseitig eine aktive Netlify-Identity-Sitzung (`401`), die Rolle `admin` (`403`) sowie den Request-Origin (`403`) – auch in Deploy Previews.

Der Request-Body darf höchstens 500.000 Bytes umfassen. Ungültiges JSON, ungültige Feldwerte und nicht unterstützte HTTP-Methoden werden mit passenden HTTP-Fehlern abgewiesen. Fehlende Blob-Konfiguration wird als `503` gemeldet. Bei Änderungen schützt der Abgleich mit dem erwarteten Beitrag vor veralteten Bearbeitungen: Ein zwischenzeitlich geänderter Stand führt zu `409`, ein bereits gelöschter Beitrag zu `404`.

[`contribution-store.ts`](../netlify/functions/lib/contribution-store.ts) enthält die fachlichen Änderungen; [`blob-store.ts`](../netlify/functions/lib/blob-store.ts) liest und schreibt den JSON-Key `contributions` im Store `mymusic-hub-data`. ETag-bedingte Schreibvorgänge erkennen parallele Änderungen und werden begrenzt erneut versucht. Bei aktivem `LOCAL_NETLIFY_ONLINE_DATA=true` in Netlify Dev leitet [`online-dev-proxy.ts`](../netlify/functions/lib/online-dev-proxy.ts) Anfragen an die konfigurierte Online-Site weiter und spiegelt den aktualisierten Stand über [`local-blob-snapshot.ts`](../netlify/functions/lib/local-blob-snapshot.ts) nach `data/blob-snapshot/contributions.json`. Wie dieser Store über Netlify-Deploy-Kontexte geteilt wird und wie die lokale Netlify CLI ihn bereitstellt, erläutert die [Netlify-Blob-Referenz](README_FEAT_NETLIFYBLOB.md).

## Beteiligte Dateien

| Datei | Aufgabe |
| --- | --- |
| [`src/content/docs/projektierung/beitraege.mdx`](../src/content/docs/projektierung/beitraege.mdx) | Schlanke Inhaltsseite mit der Beitragsübersicht. |
| [`src/components/ContributionList.astro`](../src/components/ContributionList.astro) | Listen- und Kartenansicht, Filter, Sortierung, Bearbeiten und Löschen. |
| [`src/components/IssueTrackerForm.astro`](../src/components/IssueTrackerForm.astro) | Formular zum Erstellen eines Beitrags. |
| [`src/lib/checklist-editor.ts`](../src/lib/checklist-editor.ts) | Gemeinsame Interaktion für Checklistenpunkte. |
| `src/lib/contribution-*.ts` | Zentrale Werte, Typen und Validierung für Typ, Bereich, Priorität, Status und Checkliste. |
| [`netlify/functions/contributions.ts`](../netlify/functions/contributions.ts) | API-Routing, Eingabeprüfung und HTTP-Antworten. |
| [`netlify/functions/lib/admin-write.ts`](../netlify/functions/lib/admin-write.ts) | Serverseitige Prüfung von Admin-Rolle und Request-Origin für Schreibzugriffe. |
| [`netlify/functions/lib/online-dev-proxy.ts`](../netlify/functions/lib/online-dev-proxy.ts) | Optionale Weiterleitung lokaler Netlify-Dev-Anfragen an die Online-Site. |
| [`netlify/functions/lib/local-blob-snapshot.ts`](../netlify/functions/lib/local-blob-snapshot.ts) | Spiegelt lokale Schreibvorgänge nach `data/blob-snapshot/contributions.json`. |
| [`netlify/functions/lib/contribution-store.ts`](../netlify/functions/lib/contribution-store.ts) | Fachliche Speicherung, Änderungen und Konfliktprüfung. |
| [`netlify/functions/lib/blob-store.ts`](../netlify/functions/lib/blob-store.ts) | Gemeinsamer Blob-Zugriff, Initialisierung und ETag-Schreibschutz. |
| [`src/styles/contribution-tags.css`](../src/styles/contribution-tags.css), [`src/styles/contribution-checklist.css`](../src/styles/contribution-checklist.css) | Tag-, Auswahl- und Checklistenstyles. |

## Tests

Relevante automatisierte Tests:

- [`tests/integration/contributions.test.ts`](../tests/integration/contributions.test.ts): HTTP-Methoden, fehlender Blob-Kontext, Admin-Schutz in Deploy Previews, ungültige Eingaben, Standardwerte, Aktualisierung, Konflikt und Löschen.
- [`tests/online-data-access.test.ts`](../tests/online-data-access.test.ts): `admin`-Rollen-/Origin-Schutz sowie Weiterleitung und Snapshot-Abgleich im Online-Proxy.
- [`tests/components/checklist-editor.test.ts`](../tests/components/checklist-editor.test.ts): Hinzufügen, Entfernen, Mengenlimit, Häkchen und Zurücksetzen des Checklisten-Editors.
- [`tests/e2e/smoke.spec.ts`](../tests/e2e/smoke.spec.ts): Statusfilter, Ausblenden von `Resolved` im Standard und Einblenden per Filter sowie Wiki-Verlinkung.
- [`tests/blob-store.test.ts`](../tests/blob-store.test.ts): Initialisierung und konfliktgeschützte Blob-Zugriffe.

Teststufen, Rückfrageregel und den manuellen Abschluss-Preflight beschreibt der [Testing-Leitfaden](../README_TESTING.md).
