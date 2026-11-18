# Anforderungen für den Neuaufbau des Level-100-Quiz

Dieses Dokument hält Anforderungen fest, die aus der bisherigen NotationBuilder-Integration übernommen werden. Es beschreibt nicht die alte Quiz-Implementierung; konkrete Fragen, Punkteverteilung und Gestaltung sind damit nicht festgelegt.

## NotationBuilder-Aufgaben

- Das neu aufgebaute Quiz verwendet den wiederverwendbaren `NotationBuilder`.
- Es soll Aufgaben zur Eingabe mehrerer Noten und zur Auswahl eines Notenwerts geben. Die konkreten Aufgabeninhalte und Notenzahlen sind offen.
- Wenn eine Zieltonhöhe keine Oktave vorgibt, wird sie oktavunabhängig verglichen. Ist eine Oktave angegeben, muss sie übereinstimmen.

## Fehlversuche und neue Aufgaben

- Nach einer falschen Antwort kann eine neue Aufgabe geladen werden.
- Nach drei verbrauchten Fehlversuchen wird die Aufgabe als nicht bestanden gesperrt.
- Ob das Versuchslimit pro Aufgabe oder für eine Aufgabenserie gilt, muss beim Quiz-Neuaufbau festgelegt werden.

## Nicht übernommene Altentscheidungen

- Die alte Gesamtpunktzahl und Bestehensgrenze (20 Punkte, Bestehen ab 16) sind keine Vorgabe für den Neuaufbau.
- Alte Fragen, ihre Reihenfolge, die konkrete Countdown-Anzeige und deren Gestaltung werden nicht als Anforderungen übernommen.
