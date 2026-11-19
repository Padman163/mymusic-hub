# Authentifizierung und Lernkonten

Netlify Identity verwaltet Konten und Sitzungen. Angemeldete Lernende können
ihren persönlichen Lernstand zwischen Geräten synchronisieren. Gemeinsame
Module und Konfigurationen bleiben davon getrennt und werden in
[Netlify Blobs](README_FEAT_NETLIFYBLOB.md) gespeichert.

## Anmeldung, Registrierung und Einladungen

Die Kontooberfläche sitzt rechts im globalen Starlight-Header. Sie unterstützt
Anmeldung per E-Mail und Passwort, Registrierung mit Name, E-Mail und Passwort,
Abmeldung, Einladungsannahme und Passwort-Wiederherstellung. Selbstregistrierung
ist nur möglich, wenn sie in Netlify Identity für die Site aktiviert ist. Auf
der Admin-Seite
[`Konten & Einladungen`](../src/pages/admin/konten.astro) können Nutzer mit
der Netlify-Identity-Rolle `admin` Einladungen verschicken und den aktuellen
Registrierungsstatus lesen.

Der erste Admin wird außerhalb der Anwendung eingerichtet:

1. Netlify Identity für die Site aktivieren und bei Bedarf **Invite only**
   konfigurieren.
2. Unter **Identity → Users** das erste Konto einladen.
3. Beim Nutzer die Rolle `admin` unter **Roles** zuweisen.
4. Die Einladung annehmen und sich danach neu anmelden, damit der Rollen-Claim
   aktualisiert wird.

Einladungs-E-Mails führen zur in Netlify konfigurierten Site-URL, normalerweise
zur Production-Domain. Deploy Previews verwenden zwar denselben Identity-
Nutzerbestand, die Einladungsannahme wird aber nicht automatisch auf die
Preview-URL umgeleitet. Der Code für `handleAuthCallback()` muss deshalb auf
der Ziel-URL des Einladungslinks deployed sein, bevor Einladungen angenommen
werden.

Der Registrierungsstatus in der Admin-Oberfläche ist schreibgeschützt. Die
Identity-API stellt in dieser Integration keine Änderungsoperation für den
Modus bereit; **Invite only** wird weiterhin in der Netlify-Site-Konfiguration
verwaltet.

## Rollen- und API-Schutz

`/api/admin/identity` prüft die Sitzung mit `getUser()` serverseitig. Nur
Nutzer, deren verifizierte Rollen den Wert `admin` enthalten, dürfen den
Registrierungsstatus lesen oder Einladungen senden. Schreibzugriffe prüfen
zusätzlich den Request-Origin und validieren die E-Mail-Adresse.

Der Einladungsversand ruft Netlify Identity serverseitig auf. Der Identity-
Operator-Token ist nur im Netlify-Function-Kontext verfügbar und wird weder an
den Browser zurückgegeben noch dort gespeichert.

`/api/learning-progress` verwendet ebenfalls die serverseitig geprüfte
Identity-Sitzung. Der Blob-Schlüssel wird aus der verifizierten Benutzer-ID
gebildet; ein Request kann daher nicht den Lernstand eines anderen Kontos
adressieren.

## Lernstand und lokale Daten

`learning-progress-sync.ts` verbindet den Browser-Cache nach der Anmeldung
mit dem persönlichen Blob-Store `mymusic-hub-user-data`. Jeder Account besitzt
einen getrennten lokalen Cache. Ein Gaststand wird nur übernommen, wenn für
das angemeldete Konto noch kein Cloud-Lernstand existiert; andernfalls bleibt
die Cloud-Version maßgeblich.

Änderungen werden mit ETags gegen parallele Schreibvorgänge geschützt. Bei
einem Konflikt lädt der Client die Cloud-Version erneut und weist darauf hin,
die letzte Aktion zu wiederholen. Die Anzeige des Dashboards wird aus dem
gespeicherten Lernstand berechnet; XP, Quiz-Bestwerte, Shop-Käufe, Inventar und
Studio-Ausrüstung sind Teil dieses persönlichen Zustands.

## Zuständige Dateien

| Datei | Aufgabe |
| --- | --- |
| [`learning-account-ui.ts`](../src/lib/learning-account-ui.ts) | Browser-Login, Einladungsannahme, Passwort-Wiederherstellung und Abmeldung. |
| [`learning-progress-sync.ts`](../src/lib/learning-progress-sync.ts) | Account-getrennter Cache, Migration des Gaststands und Konfliktbehandlung. |
| [`learning-progress.ts`](../src/lib/learning-progress.ts) | Schema, lokale Speicherung und Bereinigung des Lernstands. |
| [`learning-progress.ts` Function](../netlify/functions/learning-progress.ts) | Authentifizierter Zugriff auf persönliche Cloud-Lernstände. |
| [`admin-identity.ts`](../netlify/functions/admin-identity.ts) | Rollenprüfung, Registrierungsstatus und Admin-Einladungen. |
| [`AdminIdentityPanel.astro`](../src/components/admin/AdminIdentityPanel.astro) | Admin-Oberfläche für Registrierungsstatus und Einladungen. |
| [`lernstand-konto.mdx`](../src/content/docs/wiki/lernstand-konto.mdx) | Bedienungsanleitung für Lernkonten. |

Verhalten und Berechtigungen werden in
[`admin-identity.test.ts`](../tests/admin-identity.test.ts) und
[`learning-progress.test.mjs`](../tests/learning-progress.test.mjs) getestet.
