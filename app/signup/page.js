import Link from "next/link";
import { signUpAction } from "@/app/actions";
import { redirectIfSignedIn } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function SignUpPage() {
  await redirectIfSignedIn();

  return (
    <main className="page narrow">
      <section className="auth-panel">
        <img src="/focus-mark.svg" alt="" />
        <p className="eyebrow">Private accounts</p>
        <h1>Make your study space</h1>
        <p>Each account has its own decks and review history on this device.</p>
        <form action={signUpAction} className="form-stack">
          <label>
            Username
            <input autoComplete="username" name="username" required minLength="3" />
          </label>
          <label>
            Password
            <input autoComplete="new-password" name="password" required minLength="8" type="password" />
          </label>
          <button className="button primary" type="submit">
            Create account
          </button>
        </form>
        <p className="helper">
          Already have one? <Link href="/login">Log in</Link>.
        </p>
      </section>
    </main>
  );
}
