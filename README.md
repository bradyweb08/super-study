# Personal Study

A local-first study app inspired by Quizlet, with extra focus on a Learn flow that mixes flashcards, multiple choice, typed recall, weak-card loops, and spaced repetition scheduling.

## Features

- Create decks with terms and definitions
- Import cards from uploaded CSV, pasted CSV, tab-separated text, or `term - definition` lines
- Study with Learn, Flashcards, Multiple Choice, and Typed Answer modes
- Spaced repetition using a lightweight SM-2-style scheduler in SQLite
- Accuracy, streak, weak-card, due-card, and recent review tracking
- Mobile-friendly responsive UI
- Local username/password accounts so friends can use the same running app without sharing decks
- Seed data and a sample CSV import file

## Tech Stack

- Next.js App Router
- React
- SQLite locally, or Turso/libSQL for hosted deploys, via `@libsql/client`
- Plain CSS for a fast local UI

## Local Setup

Install dependencies:

```bash
npm install
```

Create the sample database:

```bash
npm run db:seed
```

Seeded login:

```text
username: owner
password: password123
```

Run locally:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Reset Seed Data

This removes `data/study.sqlite` and recreates the sample decks.

```bash
npm run db:reset
```

## Import Format

The import form accepts `.csv` uploads or pasted text in any of these formats:

```csv
term,definition
"quoted term","definition with, comma"
```

```text
term - definition
actor-observer bias - tendency to explain your own actions by context
actor - observer bias - tendency to explain your own actions by context
term: definition
term	definition
```

For dash-separated text, the importer only treats spaced dashes as separators and uses the last spaced dash on the line. Terms like `actor-observer bias` stay intact.

There is also a sample import file at `data/sample-import.csv`.

## How Learn Mode Works

Learn mode starts with cards that are due or weak. If nothing is due, it uses the whole deck. Cards move through multiple choice and typed recall before leaving the queue. Lower-accuracy cards start in typed recall, and missed cards are reinserted for another pass.

In any study mode, use the answer-direction toggle to choose whether the prompt shows the term and you answer with the definition, or the prompt shows the definition and you answer with the term.

Use **Shuffle remaining** during a study session to randomize the cards you have not completed yet.

Typed-answer grading has three levels:

- Strict ignores capitalization and extra spaces.
- Flexible also ignores punctuation, dashes, and `&` versus `and`, so `actor-observer bias` and `actor observer bias` match.
- Lenient also allows small typos and is the default.

Correct answers advance automatically after a short pause. You can override any result before it is saved, such as marking a typo-heavy answer correct or marking an accidental match incorrect. Missed answers stay on screen until you review the expected answer and continue.

When you miss a card, it is inserted back into the current session queue and marked weak. Each answer is saved to SQLite, then the scheduler updates:

- Correct answers increase streak, ease, and review interval
- Typed correct answers get a slightly stronger ease boost
- Incorrect answers reset the repetition count, mark the card weak, and schedule it again soon
- Cards stop being weak after repeated correct answers and stable accuracy

## Database Location

By default, the app stores data in:

```text
data/study.sqlite
```

To use a different SQLite file:

```bash
STUDY_DB_PATH=/absolute/path/to/study.sqlite npm run dev
```

For hosted deploys, use a persistent libSQL database instead of a local file:

```bash
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-token
```

The app also accepts `LIBSQL_DATABASE_URL` and `LIBSQL_AUTH_TOKEN` if you prefer those names.

## Deploy Locally First

For a production-like local run:

```bash
npm run build
npm run start
```

This app now has local accounts. Each user sees only their own decks and review history. If an older local database already has decks from before accounts existed, the first account created through the sign-up page claims those existing decks.

For casual friend use on your network, start the app and share the network URL printed by Next.js. Friends should create their own accounts; decks are private per account on this app instance. For public internet deployment, use HTTPS, strong passwords, and regular database backups.

## Deploy To Netlify

The app is Netlify-ready, but Netlify functions do not keep a reliable local SQLite file between deploys. Use Turso or another libSQL host so accounts, decks, and review history persist.

1. Create a Turso/libSQL database.
2. In Netlify, create a new site from this repo.
3. Use this build command:

```bash
npm run build
```

4. Use this publish directory:

```text
.next
```

5. Add these environment variables in Netlify. Keep them available to Functions at runtime:

```text
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-token
```

6. Deploy, open the Netlify URL, and have each friend create their own account.

Decks are private per account. Friends using the same Netlify site share the same app and database, but they do not share decks across accounts.
