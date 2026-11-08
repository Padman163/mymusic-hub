# Astro Projekt-Regeln für GitHub Copilot

## Architektur & Verzeichnisse
- `src/layouts/`: Übergeordnete Layout-Komponenten (.astro).
- `src/components/ui/`: Wiederverwendbare Astro-Komponenten (reines HTML/CSS).
- `src/components/islands/`: Interaktive Framework-Komponenten (nur hier `client:*` verwenden).
- `src/content.config.ts`: Definiert alle Datenstrukturen (Zod-Schemas).

## Verifikation & Qualitätskontrolle
- Nach jeder Code-Änderung ausschließlich folgenden Befehl im Terminal ausführen:
  `npm run verify`
- Schlägt `npm run verify` fehl:
  - Repariere exakt die in der Fehlermeldung angegebene Zeile und den Typ.
  - Verändere keine unbeteiligten Dateien.
- Führe niemals eigenständige Code-Formatierungen oder Whitespace-Anpassungen durch; dies erledigt Biome automatisch.

## Token-Effizienz
- Erstelle keine Zusammenfassungen bereits bekannter Projektdateien.
- Antworte präzise und generiere nur Code, der direkt angefragt wurde.