import type { APIRoute } from 'astro';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface Card {
  id: string;
  title: string;
  status: 'Geplant' | 'In Arbeit' | 'Bereit' | 'Konzept';
  category: string;
  difficulty: 'Basis' | 'Mittel' | 'Fortgeschritten' | 'Master';
  tags: string[];
  description: string;
  tasks: Array<{
    text: string;
    completed: boolean;
  }>;
  comments: Array<{
    author: string;
    role: 'Dev' | 'Didaktik' | 'Audio';
    text: string;
  }>;
  createdAt: string;
  createdBy: string;
}

interface TodoCardsData {
  cards: Card[];
}

export const POST: APIRoute = async ({ request }) => {
  try {
    // Nur POST akzeptieren
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const newCard = (await request.json()) as Card;

    // Validierung
    if (!newCard.id || !newCard.title || !newCard.status || !newCard.category) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Pfad zur todo-cards.json konstruieren
    const dataPath = join(process.cwd(), 'src/data/todo-cards.json');

    // Existierende Daten lesen
    let data: TodoCardsData;
    try {
      const fileContent = readFileSync(dataPath, 'utf-8');
      data = JSON.parse(fileContent);
    } catch {
      data = { cards: [] };
    }

    // Prüfen ob ID bereits existiert
    if (data.cards.some((c) => c.id === newCard.id)) {
      return new Response(
        JSON.stringify({ error: `Card mit ID "${newCard.id}" existiert bereits` }),
        {
          status: 409,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Neue Card hinzufügen
    data.cards.push(newCard);

    // Zurück in die Datei schreiben
    writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf-8');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Card erfolgreich erstellt',
        card: newCard
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('API Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
