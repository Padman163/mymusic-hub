# Implementation Log - Feature Card System

## Session Date: 2026-11-05

### Task
Integriere ein Feature-Formular zum Erstellen von Cards als Ersatz für GitHub-Issues ToDo.
- Cards nicht in GitHub speichern, sondern lokal in projektierung/todo
- Formular für Card-Erstellung
- Beispiel-Features aus praxis-features.mdx nutzen

### Solution Approach
**Storage**: JSON-Datei (strukturiert, einfach zu parsen)
**Location**: Ersetzt GitHub-Form in todo.mdx
**Example Cards**: Importiert aus praxis-features.mdx

### Implementation Details

#### 1. Data Structure (src/data/todo-cards.json)
```json
{
  "cards": [
    {
      "id": "FEAT-101-A",
      "title": "...",
      "status": "Bereit|Geplant|In Arbeit|Konzept",
      "category": "Praxis 101",
      "difficulty": "Basis|Mittel|Fortgeschritten|Master",
      "tags": ["tag1", "tag2"],
      "description": "...",
      "tasks": [{ "text": "...", "completed": false }],
      "comments": [{ "author": "...", "role": "Dev|Didaktik|Audio", "text": "..." }],
      "createdAt": "ISO-String",
      "createdBy": "web-form|system"
    }
  ]
}
```

#### 2. Form Component (ProjectCardForm.astro)
- 9 Felder: ID, Title, Category, Status, Difficulty, Tags, Description, Tasks, Comments
- Client-side Validierung
- ID-Pattern: FEAT-XXX-A
- Tags: kommagetrennt
- Tasks: zeilenweise
- Comments: Optional mit Role-Selector

#### 3. API Endpoint (src/pages/api/create-card.ts)
- POST-only, TypeScript, Astro-native
- Validiert erforderliche Felder
- Prüft auf ID-Duplikate
- Schreibt zu todo-cards.json mit fs module
- Gibt 201 + Card zurück

#### 4. Display Component (ProjectFeatureCardsList.astro)
- Importiert Cards aus todo-cards.json
- Mapped über Astro FeatureCard-Komponente
- Zeigt: Beschreibung, Aufgaben-Checkliste, Kommentare, Metadaten
- Empty-State wenn keine Cards

#### 5. Integration (todo.mdx)
- Imports von ProjectCardForm & ProjectFeatureCardsList
- Form oben, Cards unten
- Ersetzt alte ProjectTodoForm

### Files Created/Modified
✅ Created: src/components/ProjectCardForm.astro (7.5 KB)
✅ Created: src/components/ProjectFeatureCardsList.astro (3.0 KB)
✅ Created: src/pages/api/create-card.ts (2.5 KB)
✅ Created: src/data/todo-cards.json (2.6 KB with 2 example cards)
✅ Modified: src/content/docs/projektierung/todo.mdx
✅ Created: FEATURE_CARD_SYSTEM.md (Documentation)

### Build Verification
✅ npm run build: 6.08s, no errors
✅ TypeScript: All types correct
✅ Components: All imports resolved
✅ API: POST endpoint ready

### Example Cards (Imported from praxis-features.mdx)
1. FEAT-101-A: Interaktives Gitarren-Tuning & Frequenz-Check
   - Status: Bereit
   - Difficulty: Basis
   - 4 Tasks, 2 Comments (Dev + Didaktik)

2. FEAT-101-B: Unisono-Prüfung (5. Bund) & Intonations-Check (12. Bund)
   - Status: Bereit
   - Difficulty: Mittel
   - 4 Tasks, 2 Comments (Audio + Didaktik)

### Testing Recommendations
- [ ] Start dev server: npm run dev
- [ ] Navigate to /projektierung/todo
- [ ] Fill form with test data
- [ ] Verify JSON update in src/data/todo-cards.json
- [ ] Page reloads and shows new card
- [ ] Test validation (empty fields, invalid ID pattern)

### Future Enhancements
- Card editing functionality
- Card deletion
- Filter by status/category/tags
- Kanban board view
- Export to .mdx format
- LocalStorage fallback for offline support
- Card comments UI improvement
- Task completion tracking

### Notes
- Original ProjectTodoForm still in components, kept as fallback
- API uses Node.js fs module (only works server-side)
- JSON file is human-editable for quick manual updates
- No database required, fully file-based approach
- Compatible with existing FeatureCard.astro component
