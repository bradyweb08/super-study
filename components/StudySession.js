"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { gradingOptions, isTypedCorrect } from "@/lib/grading";

function shuffle(items) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function modeForCard(card, sessionMode) {
  if (sessionMode !== "learn") return sessionMode;
  if (card.practiceStage === "choice") return "multiple";
  if (card.practiceStage === "recall") return "typed";
  if (card.weak || card.accuracy < 70) return "typed";
  return card.streak % 2 === 0 ? "multiple" : "typed";
}

function firstLearnStage(card) {
  if (card.weak || card.accuracy < 70) return "recall";
  return "choice";
}

function promptFor(card, answerSide) {
  return answerSide === "term" ? card.definition : card.term;
}

function expectedFor(card, answerSide) {
  return answerSide === "term" ? card.term : card.definition;
}

function promptLabelFor(answerSide) {
  return answerSide === "term" ? "Definition" : "Term";
}

function answerLabelFor(answerSide) {
  return answerSide === "term" ? "term" : "definition";
}

async function submitReview(card, mode, answer, expected, correct) {
  await fetch("/api/review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cardId: card.id, mode, answer, expected, correct })
  });
}

export default function StudySession({ deck, cards, mode }) {
  const initialQueue = useMemo(() => {
    const due = cards.filter((card) => card.due || card.weak);
    const source = due.length ? due : cards;
    if (mode !== "learn") return source;
    return source.map((card) => ({
      ...card,
      practiceStage: firstLearnStage(card)
    }));
  }, [cards, mode]);

  const [queue, setQueue] = useState(initialQueue);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [typedAnswer, setTypedAnswer] = useState("");
  const [answerSide, setAnswerSide] = useState("definition");
  const [gradingStrictness, setGradingStrictness] = useState("lenient");
  const [hasShuffled, setHasShuffled] = useState(false);
  const [result, setResult] = useState(null);
  const [sessionStats, setSessionStats] = useState({ correct: 0, missed: 0, completed: 0 });
  const [isPending, startTransition] = useTransition();
  const autoAdvanceTimer = useRef(null);
  const committingReview = useRef(false);

  const card = queue[currentIndex];
  const currentMode = card ? modeForCard(card, mode) : mode;
  const expectedAnswer = card ? expectedFor(card, answerSide) : "";
  const promptText = card ? promptFor(card, answerSide) : "";
  const options = useMemo(() => {
    if (!card) return [];
    const distractors = shuffle(cards.filter((item) => item.id !== card.id)).slice(0, 3);
    return shuffle([card, ...distractors]).map((item) => expectedFor(item, answerSide));
  }, [answerSide, card, cards]);

  useEffect(() => {
    return () => {
      if (autoAdvanceTimer.current) {
        window.clearTimeout(autoAdvanceTimer.current);
      }
    };
  }, []);

  if (cards.length === 0) {
    return (
      <section className="empty-state">
        <h1>No cards in this deck</h1>
        <p>Add or import terms before starting a study session.</p>
        <Link className="button primary" href={`/decks/${deck.id}`}>
          Add cards
        </Link>
      </section>
    );
  }

  if (!card) {
    const total = sessionStats.correct + sessionStats.missed;
    const accuracy = total ? Math.round((sessionStats.correct / total) * 100) : 0;
    return (
      <section className="session-complete">
        <p className="eyebrow">Session complete</p>
        <h1>{accuracy}% accuracy</h1>
        <p>
          {sessionStats.completed} prompts finished. Missed cards were returned to the queue for
          extra practice.
        </p>
        <div className="row-actions">
          <Link className="button primary" href={`/decks/${deck.id}/learn`}>
            Review again
          </Link>
          <Link className="button" href={`/decks/${deck.id}`}>
            Back to deck
          </Link>
        </div>
      </section>
    );
  }

  function clearAutoAdvance() {
    if (autoAdvanceTimer.current) {
      window.clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }
  }

  function moveNext(wasCorrect, reviewCard = card) {
    clearAutoAdvance();

    const nextQueue = [...queue];
    if (mode === "learn") {
      let followUp = null;

      if (!wasCorrect) {
        followUp = {
          ...reviewCard,
          weak: true,
          practiceStage: "recall",
          accuracy: Math.min(reviewCard.accuracy, 50)
        };
      } else if (reviewCard.practiceStage === "choice") {
        followUp = { ...reviewCard, practiceStage: "recall" };
      }

      if (followUp) {
        nextQueue.splice(Math.min(currentIndex + 3, nextQueue.length), 0, followUp);
      }
    }

    setQueue(nextQueue);
    setCurrentIndex((index) => index + 1);
    setFlipped(false);
    setTypedAnswer("");
    setResult(null);
    committingReview.current = false;
  }

  function shuffleRemaining() {
    if (result || !card) return;

    setQueue((currentQueue) => {
      const completed = currentQueue.slice(0, currentIndex);
      const remaining = shuffle(currentQueue.slice(currentIndex));
      return [...completed, ...remaining];
    });
    setHasShuffled(true);
    setFlipped(false);
    setTypedAnswer("");
  }

  function finalizeReview(reviewResult = result) {
    if (!reviewResult || committingReview.current) return;

    clearAutoAdvance();
    committingReview.current = true;

    setSessionStats((stats) => ({
      correct: stats.correct + (reviewResult.correct ? 1 : 0),
      missed: stats.missed + (reviewResult.correct ? 0 : 1),
      completed: stats.completed + 1
    }));

    startTransition(async () => {
      await submitReview(
        reviewResult.card,
        reviewResult.mode,
        reviewResult.answer,
        reviewResult.expected,
        reviewResult.correct
      );
    });

    moveNext(reviewResult.correct, reviewResult.card);
  }

  function scheduleAutoAdvance(reviewResult) {
    clearAutoAdvance();
    autoAdvanceTimer.current = window.setTimeout(() => {
      finalizeReview(reviewResult);
    }, 1400);
  }

  function overrideResult(correct) {
    clearAutoAdvance();
    setResult((currentResult) => {
      if (!currentResult) return currentResult;
      return { ...currentResult, correct, overridden: true };
    });
  }

  function grade(answer, wasCorrect) {
    if (result || isPending) return;

    const nextResult = {
      answer,
      card,
      correct: wasCorrect,
      expected: expectedAnswer,
      mode: currentMode,
      overridden: false
    };

    setResult(nextResult);

    if (wasCorrect) {
      scheduleAutoAdvance(nextResult);
    }
  }

  function continueAfterResult() {
    finalizeReview(result);
  }

  const progress = Math.min(100, Math.round((currentIndex / Math.max(queue.length, 1)) * 100));

  return (
    <section className="study-shell">
      <div className="study-status">
        <div>
          <p className="eyebrow">{mode === "learn" ? "Learn" : currentMode}</p>
          <h1>{deck.title}</h1>
        </div>
        <div className="study-controls">
          <div className="direction-toggle" aria-label="Answer direction">
            <button
              className={answerSide === "definition" ? "active" : ""}
              disabled={Boolean(result)}
              onClick={() => setAnswerSide("definition")}
              type="button"
            >
              Answer definitions
            </button>
            <button
              className={answerSide === "term" ? "active" : ""}
              disabled={Boolean(result)}
              onClick={() => setAnswerSide("term")}
              type="button"
            >
              Answer terms
            </button>
          </div>
          <label className="grading-select">
            Grading
            <select
              disabled={Boolean(result)}
              onChange={(event) => setGradingStrictness(event.target.value)}
              value={gradingStrictness}
            >
              {gradingOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} - {option.description}
                </option>
              ))}
            </select>
          </label>
          <button
            className={`button shuffle-button ${hasShuffled ? "active" : ""}`}
            disabled={Boolean(result)}
            onClick={shuffleRemaining}
            type="button"
          >
            {hasShuffled ? "Shuffled" : "Shuffle remaining"}
          </button>
          <div className="score-pills">
            <span>{sessionStats.correct} right</span>
            <span>{sessionStats.missed} missed</span>
          </div>
        </div>
      </div>

      <div className="progress-track" aria-label={`${progress}% complete`}>
        <span style={{ width: `${progress}%` }} />
      </div>

      <article className={`prompt-surface ${result ? (result.correct ? "correct" : "wrong") : ""}`}>
        <div className="prompt-meta">
          <span>{currentIndex + 1} of {queue.length}</span>
          {card.weak ? <span className="weak-tag">Weak card</span> : <span>{card.accuracy}% accuracy</span>}
        </div>

        {currentMode === "flashcards" ? (
          <div className="flashcard-mode">
            <p className="prompt-label">{flipped ? `Answer: ${answerLabelFor(answerSide)}` : promptLabelFor(answerSide)}</p>
            <h2>{flipped ? expectedAnswer : promptText}</h2>
            {!flipped ? (
              <button className="button primary" onClick={() => setFlipped(true)} type="button">
                Show answer
              </button>
            ) : (
              <div className="row-actions centered">
                <button className="button danger" onClick={() => grade("Again", false)} type="button">
                  Again
                </button>
                <button className="button primary" onClick={() => grade("Know", true)} type="button">
                  Know it
                </button>
              </div>
            )}
          </div>
        ) : null}

        {currentMode === "multiple" ? (
          <div className="choice-mode">
            <p className="prompt-label">Choose the {answerLabelFor(answerSide)}</p>
            <h2>{promptText}</h2>
            <div className="choice-grid">
              {options.map((option, index) => (
                <button
                  className="choice-button"
                  disabled={Boolean(result)}
                  key={`${option}-${index}`}
                  onClick={() => grade(option, option === expectedAnswer)}
                  type="button"
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {currentMode === "typed" ? (
          <form
            className="typed-mode"
            onSubmit={(event) => {
              event.preventDefault();
              grade(typedAnswer, isTypedCorrect(typedAnswer, expectedAnswer, gradingStrictness));
            }}
          >
            <p className="prompt-label">Type the {answerLabelFor(answerSide)}</p>
            <h2>{promptText}</h2>
            <input
              autoComplete="off"
              disabled={Boolean(result)}
              onChange={(event) => setTypedAnswer(event.target.value)}
              placeholder="Your answer"
              value={typedAnswer}
            />
            <button className="button primary" disabled={!typedAnswer.trim() || Boolean(result)} type="submit">
              Check
            </button>
          </form>
        ) : null}

        {result ? (
          <div className="result-panel">
            <strong>
              {result.overridden
                ? result.correct
                  ? "Marked correct"
                  : "Marked incorrect"
                : result.correct
                  ? "Correct"
                  : "Review this one again"}
            </strong>
            {!result.correct ? (
              <p>
                Expected: <span>{expectedAnswer}</span>
              </p>
            ) : null}
            <div className="row-actions centered override-actions">
              <button
                className={result.correct ? "button danger" : "button primary"}
                onClick={() => overrideResult(!result.correct)}
                type="button"
              >
                {result.correct ? "Mark incorrect" : "Mark correct"}
              </button>
              <button className="button primary" onClick={continueAfterResult} type="button">
                {result.correct && !result.overridden ? "Continue now" : "Continue"}
              </button>
            </div>
            {result.correct && !result.overridden ? <p>Moving on automatically...</p> : null}
          </div>
        ) : null}
      </article>
    </section>
  );
}
