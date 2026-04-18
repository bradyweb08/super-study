import Link from "next/link";
import { createDeckAction } from "@/app/actions";
import { requireUser } from "@/lib/auth";

export default async function NewDeckPage() {
  await requireUser();

  return (
    <main className="page narrow">
      <header className="topbar">
        <Link className="brand" href="/">
          <img src="/focus-mark.svg" alt="" />
          <span>Personal Study</span>
        </Link>
      </header>

      <section className="editor-panel">
        <p className="eyebrow">New deck</p>
        <h1>Create a study set</h1>
        <form action={createDeckAction} className="form-stack" encType="multipart/form-data">
          <label>
            Deck title
            <input name="title" placeholder="Spanish travel phrases" required />
          </label>
          <label>
            Description
            <input name="description" placeholder="Optional context" />
          </label>
          <label>
            Add cards now
            <textarea
              name="cards"
              rows="10"
              placeholder={'hola,hello\nla estacion,the station\ncomida - food'}
            />
          </label>
          <label>
            Or upload CSV
            <input accept=".csv,text/csv" name="csvFile" type="file" />
          </label>
          <p className="helper">
            Paste CSV, tab-separated text, or one term-definition pair per line.
          </p>
          <div className="row-actions">
            <button className="button primary" type="submit">
              Create deck
            </button>
            <Link className="button" href="/">
              Cancel
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}
