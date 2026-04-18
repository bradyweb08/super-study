import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isHostedWithoutDatabase, queryOne, queryRun } from "@/lib/db";

const SESSION_COOKIE = "study_session";
const SESSION_DAYS = 30;

function nowIso() {
  return new Date().toISOString();
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(password, salt, 210000, 32, "sha256").toString("hex");
  return { hash, salt };
}

function safeUser(row) {
  return row ? { id: row.id, username: row.username, created_at: row.created_at } : null;
}

async function cookieStore() {
  return cookies();
}

function logDatabaseError(error) {
  console.error("Study database unavailable:", error?.message || error);
}

function isFrameworkControlError(error) {
  return (
    String(error?.digest || "").startsWith("NEXT_") ||
    String(error?.message || "").includes("Dynamic server usage")
  );
}

export async function userCount() {
  if (isHostedWithoutDatabase()) return 0;
  try {
    return (await queryOne("SELECT COUNT(*) AS count FROM users")).count;
  } catch (error) {
    if (isFrameworkControlError(error)) throw error;
    logDatabaseError(error);
    return 0;
  }
}

export async function createUser({ username, password }) {
  if (isHostedWithoutDatabase()) {
    throw new Error("Hosted database is not configured.");
  }

  const cleanedUsername = String(username || "").trim();
  const rawPassword = String(password || "");

  if (cleanedUsername.length < 3) {
    throw new Error("Username must be at least 3 characters");
  }

  if (rawPassword.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  const firstUser = (await userCount()) === 0;
  const { hash, salt } = hashPassword(rawPassword);
  const timestamp = nowIso();

  const result = await queryRun(
    "INSERT INTO users (username, password_hash, salt, created_at) VALUES (?, ?, ?, ?)",
    [cleanedUsername, hash, salt, timestamp]
  );
  const userId = Number(result.lastInsertRowid);

  if (firstUser) {
    await queryRun("UPDATE decks SET user_id = ? WHERE user_id IS NULL", [userId]);
  }

  return userId;
}

export async function verifyUser({ username, password }) {
  if (isHostedWithoutDatabase()) return null;

  let user;
  try {
    user = await queryOne(
      "SELECT * FROM users WHERE username = ? COLLATE NOCASE",
      [String(username || "").trim()]
    );
  } catch (error) {
    if (isFrameworkControlError(error)) throw error;
    logDatabaseError(error);
    return null;
  }

  if (!user) return null;

  const { hash } = hashPassword(String(password || ""), user.salt);
  const expected = Buffer.from(user.password_hash, "hex");
  const actual = Buffer.from(hash, "hex");

  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    return null;
  }

  return safeUser(user);
}

export async function createSession(userId) {
  if (isHostedWithoutDatabase()) {
    throw new Error("Hosted database is not configured.");
  }

  const id = crypto.randomBytes(32).toString("hex");
  const createdAt = new Date();
  const expiresAt = new Date(createdAt);
  expiresAt.setDate(expiresAt.getDate() + SESSION_DAYS);

  await queryRun("INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)", [
    id,
    userId,
    createdAt.toISOString(),
    expiresAt.toISOString()
  ]);

  const store = await cookieStore();
  store.set(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt
  });
}

export async function clearSession() {
  const store = await cookieStore();
  const sessionId = store.get(SESSION_COOKIE)?.value;
  if (sessionId) {
    try {
      await queryRun("DELETE FROM sessions WHERE id = ?", [sessionId]);
    } catch (error) {
      if (isFrameworkControlError(error)) throw error;
      logDatabaseError(error);
    }
  }
  store.delete(SESSION_COOKIE);
}

export async function getCurrentUser() {
  if (isHostedWithoutDatabase()) return null;

  const store = await cookieStore();
  const sessionId = store.get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;

  let row;
  try {
    row = await queryOne(
      `
        SELECT u.id, u.username, u.created_at
        FROM sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.id = ? AND s.expires_at > ?
      `,
      [sessionId, nowIso()]
    );
  } catch (error) {
    if (isFrameworkControlError(error)) throw error;
    logDatabaseError(error);
    redirect("/setup");
  }

  if (!row) return null;
  return safeUser(row);
}

export async function requireUser() {
  if (isHostedWithoutDatabase()) redirect("/setup");

  let user;
  try {
    user = await getCurrentUser();
  } catch (error) {
    if (isFrameworkControlError(error)) throw error;
    logDatabaseError(error);
    redirect("/setup");
  }
  if (!user) redirect("/login");
  return user;
}

export async function redirectIfSignedIn() {
  if (isHostedWithoutDatabase()) redirect("/setup");

  let user;
  try {
    user = await getCurrentUser();
  } catch (error) {
    if (isFrameworkControlError(error)) throw error;
    logDatabaseError(error);
    redirect("/setup");
  }
  if (user) redirect("/");
}
