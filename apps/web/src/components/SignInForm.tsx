import { FormEvent, useState } from "react";

interface SignInFormProps {
  onSubmit: (payload: { name: string; email: string }) => Promise<unknown>;
}

export function SignInForm({ onSubmit }: SignInFormProps) {
  const [name, setName] = useState("Aisha Singh");
  const [email, setEmail] = useState("captain@cricketclub.test");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await onSubmit({ name, email });
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Could not sign in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="hero-card">
        <span className="eyebrow">Play-money only</span>
        <h1>Fantasy cricket for friends, with cosmetics instead of cash.</h1>
        <p>
          Build a salary-cap XI, answer fixed predictions, and unlock profile flair. There is no wallet,
          no payout, and no transferable reward economy anywhere in the product.
        </p>
      </div>
      <form className="auth-card" onSubmit={handleSubmit}>
        <h2>Sign in</h2>
        <label>
          Name
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          Email
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        {error ? <p className="error-text">{error}</p> : null}
        <button type="submit" disabled={loading}>
          {loading ? "Signing in..." : "Enter the clubhouse"}
        </button>
      </form>
    </div>
  );
}
