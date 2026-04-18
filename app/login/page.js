import Link from "next/link";
import { loginAction } from "@/app/actions";
import { redirectIfSignedIn, userCount } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function LoginPage({ searchParams }) {
  await redirectIfSignedIn();
  const params = await searchParams;

  if ((await userCount()) === 0) {
    return (
      <main className="page narrow">
        <section className="auth-panel">
          <img src="/focus-mark.svg" alt="" />
          <p className="eyebrow">Personal Study</p>
          <h1>Create your account</h1>
          <p>No accounts exist yet. The first account will claim any decks already on this device.</p>
          <Link className="button primary" href="/signup">
            Sign up
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="page narrow">
      <section className="auth-panel">
        <img src="/focus-mark.svg" alt="" />
        <p className="eyebrow">Welcome back</p>
        <h1>Log in</h1>
        {params?.error ? <p className="auth-error">That username or password did not match.</p> : null}
        <form action={loginAction} className="form-stack">
          <label>
            Username
            <input autoComplete="username" name="username" required />
          </label>
          <label>
            Password
            <input autoComplete="current-password" name="password" required type="password" />
          </label>
          <button className="button primary" type="submit">
            Log in
          </button>
        </form>
        <p className="helper">
          New here? <Link href="/signup">Create an account</Link>.
        </p>
      </section>
    </main>
  );
}
