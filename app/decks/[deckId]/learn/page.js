import Link from "next/link";
import { notFound } from "next/navigation";
import StudySession from "@/components/StudySession";
import { requireUser } from "@/lib/auth";
import { getDeck, getStudySnapshot } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function LearnPage({ params }) {
  const user = await requireUser();
  const { deckId } = await params;
  const deck = await getDeck(deckId, user.id);
  if (!deck) notFound();

  const cards = await getStudySnapshot(deck.id, user.id);

  return (
    <main className="page study-page">
      <header className="topbar">
        <Link className="brand" href={`/decks/${deck.id}`}>
          <img src="/focus-mark.svg" alt="" />
          <span>{deck.title}</span>
        </Link>
        <Link className="button" href={`/decks/${deck.id}`}>
          Manage
        </Link>
      </header>
      <StudySession deck={deck} cards={cards} mode="learn" />
    </main>
  );
}
