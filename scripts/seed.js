import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { addCards, createDeck, getDecks, queryOne, queryRun } from "../lib/db.js";

const dbPath = process.env.STUDY_DB_PATH || path.join(process.cwd(), "data", "study.sqlite");
const reset = process.argv.includes("--reset");

if (reset) {
  for (const file of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
    if (fs.existsSync(file)) {
      fs.rmSync(file);
    }
  }
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 210000, 32, "sha256").toString("hex");
  return { hash, salt };
}

async function createSeedUser() {
  const existing = await queryOne("SELECT id FROM users WHERE username = ? COLLATE NOCASE", ["owner"]);
  if (existing) return Number(existing.id);

  const { hash, salt } = hashPassword("password123");
  const result = await queryRun(
    "INSERT INTO users (username, password_hash, salt, created_at) VALUES (?, ?, ?, ?)",
    ["owner", hash, salt, new Date().toISOString()]
  );

  return Number(result.lastInsertRowid);
}

const seedUserId = await createSeedUser();

if (!reset && (await getDecks(seedUserId)).length > 0) {
  console.log("Seed skipped because decks already exist. Run npm run db:reset to rebuild sample data.");
  process.exit(0);
}

const biology = await createDeck({
  userId: seedUserId,
  title: "Cell Biology Basics",
  description: "Core cell structures and processes for quick recall."
});

await addCards(
  biology,
  [
    { term: "Mitochondria", definition: "Organelle that produces ATP through cellular respiration" },
    { term: "Ribosome", definition: "Cell structure that builds proteins from messenger RNA" },
    { term: "Osmosis", definition: "Movement of water across a selectively permeable membrane" },
    { term: "Nucleus", definition: "Membrane-bound organelle that stores eukaryotic DNA" },
    { term: "Diffusion", definition: "Movement of particles from high concentration to low concentration" },
    { term: "Chloroplast", definition: "Plant organelle that converts light energy into chemical energy" }
  ],
  seedUserId
);

const spanish = await createDeck({
  userId: seedUserId,
  title: "Spanish Travel Phrases",
  description: "Useful phrases for stations, meals, and directions."
});

await addCards(
  spanish,
  [
    { term: "Donde esta la estacion", definition: "Where is the station" },
    { term: "Quisiera agua", definition: "I would like water" },
    { term: "La cuenta, por favor", definition: "The check, please" },
    { term: "Cuanto cuesta", definition: "How much does it cost" },
    { term: "Necesito ayuda", definition: "I need help" },
    { term: "A la derecha", definition: "To the right" }
  ],
  seedUserId
);

console.log("Seeded Personal Study with 2 decks and 12 cards.");
console.log("Seed login: owner / password123");
