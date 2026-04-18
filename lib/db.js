import { createClient } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";

const DEFAULT_DB_PATH = path.join(process.cwd(), "data", "study.sqlite");
const LOCAL_DB_PATH = process.env.STUDY_DB_PATH || DEFAULT_DB_PATH;
const REMOTE_DB_URL = process.env.TURSO_DATABASE_URL || process.env.LIBSQL_DATABASE_URL;
const REMOTE_DB_TOKEN = process.env.TURSO_AUTH_TOKEN || process.env.LIBSQL_AUTH_TOKEN;
const HOSTED_ENV = Boolean(
  process.env.NETLIFY ||
    process.env.CONTEXT ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.LAMBDA_TASK_ROOT
);

let client;
let readyPromise;

function nowIso() {
  return new Date().toISOString();
}

function toInt(value) {
  return Number.parseInt(value, 10);
}

export function isHostedWithoutDatabase() {
  return Boolean(HOSTED_ENV && (!REMOTE_DB_URL || !REMOTE_DB_TOKEN));
}

function getClient() {
  if (isHostedWithoutDatabase()) {
    throw new Error("Hosted database is not configured. Add TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in Netlify.");
  }

  if (!client) {
    if (!REMOTE_DB_URL) {
      fs.mkdirSync(path.dirname(LOCAL_DB_PATH), { recursive: true });
    }

    client = createClient({
      url: REMOTE_DB_URL || `file:${LOCAL_DB_PATH}`,
      authToken: REMOTE_DB_TOKEN
    });
  }

  return client;
}

async function migrate() {
  const db = getClient();
  await rawRun("PRAGMA foreign_keys = ON");
  await db.batch(
    [
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS decks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS cards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        deck_id INTEGER NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
        term TEXT NOT NULL,
        definition TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS study_stats (
        card_id INTEGER PRIMARY KEY REFERENCES cards(id) ON DELETE CASCADE,
        deck_id INTEGER NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
        ease REAL NOT NULL DEFAULT 2.5,
        interval_days INTEGER NOT NULL DEFAULT 0,
        repetitions INTEGER NOT NULL DEFAULT 0,
        lapses INTEGER NOT NULL DEFAULT 0,
        due_at TEXT NOT NULL,
        last_reviewed_at TEXT,
        correct_count INTEGER NOT NULL DEFAULT 0,
        incorrect_count INTEGER NOT NULL DEFAULT 0,
        streak INTEGER NOT NULL DEFAULT 0,
        best_streak INTEGER NOT NULL DEFAULT 0,
        weak INTEGER NOT NULL DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS review_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
        deck_id INTEGER NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
        mode TEXT NOT NULL,
        answer TEXT DEFAULT '',
        expected TEXT NOT NULL,
        correct INTEGER NOT NULL,
        created_at TEXT NOT NULL
      )`,
      "CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)",
      "CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)"
    ],
    "write"
  );

  const deckColumns = await rawAll("PRAGMA table_info(decks)");
  const hasDeckUserId = deckColumns.some((column) => column.name === "user_id");
  if (!hasDeckUserId) {
    await rawRun("ALTER TABLE decks ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE");
  }
  await rawRun("CREATE INDEX IF NOT EXISTS idx_decks_user_id ON decks(user_id)");
}

async function ensureReady() {
  if (!readyPromise) {
    readyPromise = migrate();
  }

  await readyPromise;
}

async function rawRun(sql, args = []) {
  return getClient().execute({ sql, args });
}

async function rawAll(sql, args = []) {
  const result = await getClient().execute({ sql, args });
  return result.rows;
}

export async function queryRun(sql, args = []) {
  await ensureReady();
  return rawRun(sql, args);
}

export async function queryAll(sql, args = []) {
  await ensureReady();
  return rawAll(sql, args);
}

export async function queryOne(sql, args = []) {
  const rows = await queryAll(sql, args);
  return rows[0] || null;
}

function normalizeDeck(row) {
  return {
    ...row,
    card_count: row.card_count || 0,
    due_count: row.due_count || 0,
    weak_count: row.weak_count || 0,
    accuracy: row.review_count ? Math.round((row.correct_total / row.review_count) * 100) : 0,
    review_count: row.review_count || 0
  };
}

export async function getDecks(userId) {
  const now = nowIso();
  const rows = await queryAll(
    `
    SELECT
      d.*,
      COUNT(c.id) AS card_count,
      COALESCE(SUM(CASE WHEN s.due_at <= ? THEN 1 ELSE 0 END), 0) AS due_count,
      COALESCE(SUM(CASE WHEN s.weak = 1 THEN 1 ELSE 0 END), 0) AS weak_count,
      COALESCE(SUM(s.correct_count), 0) AS correct_total,
      COALESCE(SUM(s.correct_count + s.incorrect_count), 0) AS review_count
    FROM decks d
    LEFT JOIN cards c ON c.deck_id = d.id
    LEFT JOIN study_stats s ON s.card_id = c.id
    WHERE d.user_id = ?
    GROUP BY d.id
    ORDER BY d.updated_at DESC
  `,
    [now, toInt(userId)]
  );

  return rows.map(normalizeDeck);
}

export async function getDeck(deckId, userId) {
  const now = nowIso();
  const row = await queryOne(
    `
    SELECT
      d.*,
      COUNT(c.id) AS card_count,
      COALESCE(SUM(CASE WHEN s.due_at <= ? THEN 1 ELSE 0 END), 0) AS due_count,
      COALESCE(SUM(CASE WHEN s.weak = 1 THEN 1 ELSE 0 END), 0) AS weak_count,
      COALESCE(SUM(s.correct_count), 0) AS correct_total,
      COALESCE(SUM(s.correct_count + s.incorrect_count), 0) AS review_count
    FROM decks d
    LEFT JOIN cards c ON c.deck_id = d.id
    LEFT JOIN study_stats s ON s.card_id = c.id
    WHERE d.id = ? AND d.user_id = ?
    GROUP BY d.id
  `,
    [now, toInt(deckId), toInt(userId)]
  );

  return row ? normalizeDeck(row) : null;
}

export async function getCards(deckId, userId) {
  return queryAll(
    `
    SELECT
      c.id,
      c.deck_id,
      c.term,
      c.definition,
      c.created_at,
      c.updated_at,
      s.ease,
      s.interval_days,
      s.repetitions,
      s.lapses,
      s.due_at,
      s.last_reviewed_at,
      s.correct_count,
      s.incorrect_count,
      s.streak,
      s.best_streak,
      s.weak
    FROM cards c
    JOIN decks d ON d.id = c.deck_id
    JOIN study_stats s ON s.card_id = c.id
    WHERE c.deck_id = ? AND d.user_id = ?
    ORDER BY
      CASE WHEN s.due_at <= ? THEN 0 ELSE 1 END,
      s.weak DESC,
      (s.incorrect_count - s.correct_count) DESC,
      c.created_at ASC
  `,
    [toInt(deckId), toInt(userId), nowIso()]
  );
}

export async function getStudySnapshot(deckId, userId) {
  const cards = await getCards(deckId, userId);
  const now = nowIso();

  return cards.map((card) => {
    const attempts = card.correct_count + card.incorrect_count;
    const accuracy = attempts ? Math.round((card.correct_count / attempts) * 100) : 0;

    return {
      ...card,
      due: card.due_at <= now,
      weak: Boolean(card.weak),
      accuracy,
      attempts
    };
  });
}

export async function createDeck({ title, description = "", userId }) {
  const timestamp = nowIso();
  const result = await queryRun(
    "INSERT INTO decks (user_id, title, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    [toInt(userId), title.trim(), description.trim(), timestamp, timestamp]
  );

  return Number(result.lastInsertRowid);
}

export async function touchDeck(deckId, userId) {
  await queryRun("UPDATE decks SET updated_at = ? WHERE id = ? AND user_id = ?", [
    nowIso(),
    toInt(deckId),
    toInt(userId)
  ]);
}

export async function addCards(deckId, cards, userId) {
  const cleaned = cards
    .map((card) => ({
      term: String(card.term || "").trim(),
      definition: String(card.definition || "").trim()
    }))
    .filter((card) => card.term && card.definition);

  if (cleaned.length === 0) return 0;

  const deck = await getDeck(deckId, userId);
  if (!deck) throw new Error("Deck not found");

  const timestamp = nowIso();
  for (const row of cleaned) {
    const result = await queryRun(
      "INSERT INTO cards (deck_id, term, definition, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
      [toInt(deckId), row.term, row.definition, timestamp, timestamp]
    );
    await queryRun("INSERT INTO study_stats (card_id, deck_id, due_at) VALUES (?, ?, ?)", [
      Number(result.lastInsertRowid),
      toInt(deckId),
      timestamp
    ]);
  }

  await touchDeck(deckId, userId);
  return cleaned.length;
}

export async function updateCard({ cardId, deckId, term, definition, userId }) {
  const cleanedTerm = String(term || "").trim();
  const cleanedDefinition = String(definition || "").trim();

  if (!cleanedTerm || !cleanedDefinition) {
    throw new Error("Both term and definition are required");
  }

  const result = await queryRun(
    `
    UPDATE cards
    SET term = ?, definition = ?, updated_at = ?
    WHERE id = ? AND deck_id = ? AND EXISTS (
      SELECT 1 FROM decks WHERE decks.id = cards.deck_id AND decks.user_id = ?
    )
  `,
    [cleanedTerm, cleanedDefinition, nowIso(), toInt(cardId), toInt(deckId), toInt(userId)]
  );

  if (result.rowsAffected > 0) {
    await touchDeck(deckId, userId);
  }

  return result.rowsAffected;
}

export async function deleteCard({ cardId, deckId, userId }) {
  const card = await queryOne(
    `
    SELECT c.id
    FROM cards c
    JOIN decks d ON d.id = c.deck_id
    WHERE c.id = ? AND c.deck_id = ? AND d.user_id = ?
  `,
    [toInt(cardId), toInt(deckId), toInt(userId)]
  );
  if (!card) return 0;

  await queryRun("DELETE FROM review_logs WHERE card_id = ?", [card.id]);
  await queryRun("DELETE FROM study_stats WHERE card_id = ?", [card.id]);
  const result = await queryRun(
    `
    DELETE FROM cards
    WHERE id = ? AND deck_id = ?
  `,
    [card.id, toInt(deckId)]
  );

  if (result.rowsAffected > 0) {
    await touchDeck(deckId, userId);
  }

  return result.rowsAffected;
}

export async function deleteDeck(deckId, userId) {
  const deck = await getDeck(deckId, userId);
  if (!deck) return { rowsAffected: 0 };

  await queryRun("DELETE FROM review_logs WHERE deck_id = ?", [toInt(deckId)]);
  await queryRun("DELETE FROM study_stats WHERE deck_id = ?", [toInt(deckId)]);
  await queryRun("DELETE FROM cards WHERE deck_id = ?", [toInt(deckId)]);
  return queryRun("DELETE FROM decks WHERE id = ? AND user_id = ?", [toInt(deckId), toInt(userId)]);
}

export async function getReviewTotals(userId) {
  const row = await queryOne(
    `
    SELECT
      COALESCE(SUM(study_stats.correct_count), 0) AS correct,
      COALESCE(SUM(study_stats.incorrect_count), 0) AS incorrect,
      COALESCE(MAX(study_stats.best_streak), 0) AS best_streak,
      COALESCE(SUM(CASE WHEN study_stats.weak = 1 THEN 1 ELSE 0 END), 0) AS weak_cards
    FROM study_stats
    JOIN decks d ON d.id = study_stats.deck_id
    WHERE d.user_id = ?
  `,
    [toInt(userId)]
  );

  const total = row.correct + row.incorrect;
  return {
    ...row,
    total,
    accuracy: total ? Math.round((row.correct / total) * 100) : 0
  };
}

export async function getRecentReviews(userId, limit = 12) {
  return queryAll(
    `
    SELECT r.*, c.term, d.title AS deck_title
    FROM review_logs r
    JOIN cards c ON c.id = r.card_id
    JOIN decks d ON d.id = r.deck_id
    WHERE d.user_id = ?
    ORDER BY r.created_at DESC
    LIMIT ?
  `,
    [toInt(userId), limit]
  );
}

export async function recordReview({ cardId, mode, answer = "", expected, correct, userId }) {
  const card = await queryOne(
    `
    SELECT c.*
    FROM cards c
    JOIN decks d ON d.id = c.deck_id
    WHERE c.id = ? AND d.user_id = ?
  `,
    [toInt(cardId), toInt(userId)]
  );
  if (!card) {
    throw new Error("Card not found");
  }

  const stat = await queryOne("SELECT * FROM study_stats WHERE card_id = ?", [card.id]);
  const timestamp = nowIso();
  const wasCorrect = correct ? 1 : 0;
  const attempts = stat.correct_count + stat.incorrect_count + 1;
  const correctCount = stat.correct_count + wasCorrect;
  const incorrectCount = stat.incorrect_count + (wasCorrect ? 0 : 1);
  const accuracy = correctCount / attempts;

  let ease = stat.ease;
  let intervalDays = stat.interval_days;
  let repetitions = stat.repetitions;
  let lapses = stat.lapses;
  let streak = stat.streak;

  if (wasCorrect) {
    repetitions += 1;
    streak += 1;
    ease = Math.min(3.2, ease + (mode === "typed" ? 0.08 : 0.04));
    if (repetitions === 1) intervalDays = 1;
    else if (repetitions === 2) intervalDays = 3;
    else intervalDays = Math.max(4, Math.round(intervalDays * ease));
  } else {
    repetitions = 0;
    streak = 0;
    lapses += 1;
    intervalDays = 0;
    ease = Math.max(1.3, ease - 0.24);
  }

  const dueAt = new Date();
  if (wasCorrect) {
    dueAt.setDate(dueAt.getDate() + intervalDays);
  } else {
    dueAt.setMinutes(dueAt.getMinutes() + 10);
  }

  const weak = wasCorrect && streak >= 3 && accuracy >= 0.75 ? 0 : Number(!wasCorrect || accuracy < 0.7 || lapses > 0);

  await queryRun(
    `
    UPDATE study_stats
    SET
      ease = ?,
      interval_days = ?,
      repetitions = ?,
      lapses = ?,
      due_at = ?,
      last_reviewed_at = ?,
      correct_count = ?,
      incorrect_count = ?,
      streak = ?,
      best_streak = ?,
      weak = ?
    WHERE card_id = ?
  `,
    [
      ease,
      intervalDays,
      repetitions,
      lapses,
      dueAt.toISOString(),
      timestamp,
      correctCount,
      incorrectCount,
      streak,
      Math.max(stat.best_streak, streak),
      weak,
      card.id
    ]
  );

  await queryRun(
    `
    INSERT INTO review_logs (card_id, deck_id, mode, answer, expected, correct, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `,
    [card.id, card.deck_id, mode, answer, expected || card.definition, wasCorrect, timestamp]
  );

  await touchDeck(card.deck_id, userId);

  return {
    cardId: card.id,
    correct: Boolean(wasCorrect),
    due_at: dueAt.toISOString(),
    interval_days: intervalDays,
    streak,
    weak: Boolean(weak)
  };
}
