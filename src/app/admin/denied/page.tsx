import { signOut } from "../actions";

export default function DeniedPage() {
  return (
    <div className="login">
      <h1>Not allowed</h1>
      <p>You&apos;re signed in, but this email isn&apos;t on the editor list.</p>
      <p className="help">
        Ask Adam to add it to <code>ADMIN_EMAILS</code>.
      </p>
      <form action={signOut}>
        <button className="btn secondary" type="submit">
          Sign out
        </button>
      </form>
    </div>
  );
}
