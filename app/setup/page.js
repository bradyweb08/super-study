import Link from "next/link";
import { isHostedWithoutDatabase } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function SetupPage() {
  const missingDatabase = isHostedWithoutDatabase();

  return (
    <main className="page narrow">
      <section className="auth-panel">
        <img src="/focus-mark.svg" alt="" />
        <p className="eyebrow">Deployment setup</p>
        <h1>{missingDatabase ? "Connect the database" : "Setup looks ready"}</h1>
        {missingDatabase ? (
          <>
            <p>
              Add your Turso database URL and token in Netlify, then redeploy. The app needs
              those values before accounts and decks can be saved.
            </p>
            <div className="setup-list">
              <code>TURSO_DATABASE_URL</code>
              <code>TURSO_AUTH_TOKEN</code>
            </div>
          </>
        ) : (
          <p>The hosted database variables are present. You can go back and sign in.</p>
        )}
        <Link className="button primary" href="/login">
          Go to login
        </Link>
      </section>
    </main>
  );
}
