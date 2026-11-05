# Feature Card System - Dokumentation

## 📋 Übersicht

Das neue Feature Card System ersetzt das alte GitHub-Issue-Formular in `/projektierung/todo`. Statt GitHub zu nutzen, werden Feature Cards lokal in `src/data/todo-cards.json` gespeichert und können direkt auf der Seite verwaltet werden.

## 🏗️ Komponenten

### 1. **ProjectCardForm.astro** 
   - Formular zum Erstellen neuer Feature Cards
   - Speichert Daten über API-Endpoint `/api/create-card`
   - Felder:
     - **Card ID** (Pattern: `FEAT-XXX-A`)
     - **Titel** (max 120 Zeichen)
     - **Kategorie** (z.B. "Praxis 101")
     - **Status** (Geplant, In Arbeit, Bereit, Konzept)
     - **Schwierigkeit** (Basis, Mittel, Fortgeschritten, Master)
     - **Tags** (kommagetrennt)
     - **Beschreibung** (optional)
     - **Teilaufgaben** (zeilenweise)
     - **Kommentar** (optional, mit Rolle: Dev/Didaktik/Audio)

### 2. **ProjectFeatureCardsList.astro**
   - Zeigt alle vorhandenen Feature Cards an
   - Nutzt `FeatureCard.astro`-Komponente für Darstellung
   - Importiert Cards aus `src/data/todo-cards.json`
   - Zeigt:
     - Card-Metadaten (ID, Title, Status, etc.)
     - Beschreibung
     - Checklisten von Teilaufgaben
     - Kommentare
     - Erstellungsdatum

### 3. **API Endpoint: `/api/create-card`**
   - TypeScript Astro API Route (`src/pages/api/create-card.ts`)
   - POST-Endpoint zur Speicherung neuer Cards
   - Validiert erforderliche Felder
   - Verhindert Duplikate (prüft auf ID-Konflikte)
   - Schreibt Card in `src/data/todo-cards.json`

### 4. **Datenspeicher: `src/data/todo-cards.json`**
   ```json
   {
     "cards": [
       {
         "id": "FEAT-101-A",
         "title": "Feature Title",
         "status": "Bereit",
         "category": "Praxis 101",
         "difficulty": "Basis",
         "tags": ["tag1", "tag2"],
         "description": "...",
         "tasks": [
           { "text": "Task 1", "completed": false }
         ],
         "comments": [
           {
             "author": "Dev",
             "role": "Dev",
             "text": "Kommentar..."
           }
         ],
         "createdAt": "2026-11-05T15:00:00Z",
         "createdBy": "web-form"
       }
     ]
   }
   ```

## 🎯 Workflow

1. **Neue Card erstellen**:
   - Navigiere zu `/projektierung/todo`
   - Fülle das Formular aus
   - Klicke "Feature Card erstellen"
   - Card wird in `todo-cards.json` gespeichert
   - Seite lädt neu und zeigt die neue Card an

2. **Bestehende Cards anschauen**:
   - Alle Cards werden unter "Bestehende Cards" angezeigt
   - Karten zeigen alle Informationen (Status, Tags, Kommentare, Aufgaben)

3. **In Dokumentation übernehmen**:
   - Cards können später manuell in `praxis-features.mdx` oder andere `.mdx`-Dateien kopiert werden
   - Format ist mit `<FeatureCard>`-Komponente kompatibel

## 📦 Beispiel-Cards

Bei der initialen Einrichtung wurden 2 Beispiel-Cards aus `praxis-features.mdx` importiert:

- **FEAT-101-A**: Interaktives Gitarren-Tuning & Frequenz-Check
- **FEAT-101-B**: Unisono-Prüfung (5. Bund) & Intonations-Check (12. Bund)

Diese können als Template für neue Cards verwendet werden.

## 🔧 Integration mit bestehendem System

- ✅ Nutzt bestehende `FeatureCard.astro`-Komponente
- ✅ Kompatibel mit Starlight-Design
- ✅ Speichert Daten lokal (keine GitHub-Abhängigkeit)
- ✅ Astro API Routes für Datenspeicherung
- ✅ Keine zusätzliche Datenbank nötig

## 🚀 Zukünftige Erweiterungen

- [ ] Export zu `.mdx`-Format
- [ ] Card-Bearbeitung
- [ ] Card-Löschen
- [ ] Filtierung nach Status/Category/Tags
- [ ] Sortierung
- [ ] Kanban-Board-Ansicht
- [ ] Offline-Speicherung (LocalStorage-Fallback)
