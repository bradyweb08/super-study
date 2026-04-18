import Link from "next/link";
import { notFound } from "next/navigation";
import { addCardAction, deleteCardAction, deleteDeckAction, importCardsAction, updateCardAction } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { getCards, getDeck } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function DeckPage({ params }) {
  const user = await requireUser();
  const { deckId } = await params;
  const deck = await getDeck(deckId, user.id);
  if (!deck) notFound();

  const cards = await getCards(deck.id, user.id);

  return (
    <main className="page">
      <header className="topbar">
        <Link className="brand" href="/">
          <img src="/focus-mark.svg" alt="" />
          <span>Personal Study</span>
        </Link>
        <Link className="button primary" href={`/decks/${deck.id}/learn`}>
          Start Learn
        </Link>
      </header>

      <section className="deck-hero">
        <div>
          <p className="eyebrow">Deck</p>
          <h1>{deck.title}</h1>
          <p>{deck.description || "Add terms, then start Learn when you are ready."}</p>
        </div>
        <div className="metrics-strip small" aria-label="Deck summary">
          <div>
            <span>{deck.card_count}</span>
            <p>Cards</p>
          </div>
          <div>
            <span>{deck.due_count}</span>
            <p>Due</p>
          </div>
          <div>
            <span>{deck.weak_count}</span>
            <p>Weak</p>
          </div>
          <div>
            <span>{deck.accuracy}%</span>
            <p>Accuracy</p>
          </div>
        </div>
      </section>

      <nav className="mode-nav" aria-label="Study modes">
        <Link href={`/decks/${deck.id}/learn`}>Learn</Link>
        <Link href={`/decks/${deck.id}/flashcards`}>Flashcards</Link>
        <Link href={`/decks/${deck.id}/multiple-choice`}>Multiple choice</Link>
        <Link href={`/decks/${deck.id}/typed`}>Typed answer</Link>
      </nav>

      <section className="two-column">
        <div className="editor-panel">
          <h2>Add one card</h2>
          <form action={addCardAction} className="form-stack">
            <input name="deckId" type="hidden" value={deck.id} />
            <label>
              Term
              <input name="term" required />
            </label>
            <label>
              Definition
              <textarea name="definition" rows="4" required />
            </label>
            <button className="button primary" type="submit">
              Add card
            </button>
          </form>
        </div>

        <div className="editor-panel">
          <h2>Import cards</h2>
          <form action={importCardsAction} className="form-stack" encType="multipart/form-data">
            <input name="deckId" type="hidden" value={deck.id} />
            <label>
              Format
              <select name="format" defaultValue="auto">
                <option value="auto">Auto-detect</option>
                <option value="csv">CSV</option>
                <option value="text">Pasted text</option>
              </select>
            </label>
            <label>
              Cards
              <textarea
                name="cards"
                rows="8"
                placeholder={'term,definition\nterm - definition\nterm\tdefinition'}
              />
            </label>
            <label>
              CSV file
              <input accept=".csv,text/csv" name="csvFile" type="file" />
            </label>
            <button className="button primary" type="submit">
              Import
            </button>
          </form>
        </div>
      </section>

      <section className="section-heading">
        <div>
          <p className="eyebrow">Cards</p>
          <h2>Terms in this deck</h2>
        </div>
        <form action={deleteDeckAction}>
          <input name="deckId" type="hidden" value={deck.id} />
          <button className="button danger" type="submit">
            Delete deck
          </button>
        </form>
      </section>

      <div className="card-table">
        {cards.map((card) => {
          const attempts = card.correct_count + card.incorrect_count;
          const accuracy = attempts ? Math.round((card.correct_count / attempts) * 100) : 0;
          return (
            <article className="term-row" key={card.id}>
              <div className="term-content">
                <div>
                  <strong>{card.term}</strong>
                  <p>{card.definition}</p>
                </div>
                <details className="edit-card">
                  <summary>Edit card</summary>
                  <form action={updateCardAction} className="inline-edit-form">
                    <input name="deckId" type="hidden" value={deck.id} />
                    <input name="cardId" type="hidden" value={card.id} />
                    <label>
                      Term
                      <input name="term" defaultValue={card.term} required />
                    </label>
                    <label>
                      Definition
                      <textarea name="definition" defaultValue={card.definition} rows="3" required />
                    </label>
                    <button className="button primary" type="submit">
                      Save changes
                    </button>
                  </form>
                </details>
              </div>
              <div className="term-meta">
                <span>{accuracy}%</span>
                <span>{card.streak} streak</span>
                {card.weak ? <span className="weak-tag">Weak</span> : null}
                <form action={deleteCardAction}>
                  <input name="deckId" type="hidden" value={deck.id} />
                  <input name="cardId" type="hidden" value={card.id} />
                  <button className="button danger compact-button" type="submit">
                    Delete card
                  </button>
                </form>
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}
