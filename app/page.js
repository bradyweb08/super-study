import Link from "next/link";
import { logoutAction } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { getDecks, getRecentReviews, getReviewTotals } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function HomePage() {
  const user = await requireUser();
  const [decks, totals, recent] = await Promise.all([
    getDecks(user.id),
    getReviewTotals(user.id),
    getRecentReviews(user.id)
  ]);

  return (
    <main className="page">
      <header className="topbar">
        <Link className="brand" href="/">
          <img src="/focus-mark.svg" alt="" />
          <span>Personal Study</span>
        </Link>
        <div className="row-actions">
          <span className="user-pill">{user.username}</span>
          <form action={logoutAction}>
            <button className="button" type="submit">Log out</button>
          </form>
          <Link className="button primary" href="/decks/new">
            New deck
          </Link>
        </div>
      </header>

      <section className="workspace-grid">
        <div className="intro-panel">
          <p className="eyebrow">Private study space</p>
          <h1>Review what is due. Rebuild what is weak.</h1>
          <p>
            Create decks, import terms, and run a Learn session that blends flashcards,
            multiple choice, and typed recall.
          </p>
        </div>

        <div className="metrics-strip" aria-label="Study summary">
          <div>
            <span>{totals.accuracy}%</span>
            <p>Accuracy</p>
          </div>
          <div>
            <span>{totals.best_streak}</span>
            <p>Best streak</p>
          </div>
          <div>
            <span>{totals.weak_cards}</span>
            <p>Weak cards</p>
          </div>
        </div>
      </section>

      <section className="section-heading">
        <div>
          <p className="eyebrow">Decks</p>
          <h2>Your study sets</h2>
        </div>
      </section>

      {decks.length === 0 ? (
        <section className="empty-state">
          <h2>No decks yet</h2>
          <p>Start with a small set, or seed the app with sample biology and language decks.</p>
          <Link className="button primary" href="/decks/new">
            Create your first deck
          </Link>
        </section>
      ) : (
        <div className="deck-list">
          {decks.map((deck) => (
            <article className="deck-card" key={deck.id}>
              <div>
                <p className="eyebrow">{deck.card_count} cards</p>
                <h3>{deck.title}</h3>
                <p>{deck.description || "No description yet."}</p>
              </div>
              <div className="deck-stats">
                <span>{deck.due_count} due</span>
                <span>{deck.weak_count} weak</span>
                <span>{deck.accuracy}% accuracy</span>
              </div>
              <div className="row-actions">
                <Link className="button primary" href={`/decks/${deck.id}/learn`}>
                  Learn
                </Link>
                <Link className="button" href={`/decks/${deck.id}`}>
                  Manage
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}

      {recent.length > 0 ? (
        <section className="activity-log">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">Recent</p>
              <h2>Last reviews</h2>
            </div>
          </div>
          <div className="review-list">
            {recent.map((review) => (
              <div className="review-row" key={review.id}>
                <span className={review.correct ? "dot good" : "dot miss"} />
                <strong>{review.term}</strong>
                <span>{review.deck_title}</span>
                <span>{review.mode}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
