import { useState } from "react";
import { Shield, Users, Trophy } from "lucide-react";

interface AuthScreenProps {
  onSubmit: (payload: { name: string; email: string }) => Promise<unknown>;
  notice?: string | null;
}

export function AuthScreen({ onSubmit, notice }: AuthScreenProps) {
  const [name, setName] = useState("Aisha Singh");
  const [email, setEmail] = useState("captain@cricketclub.test");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await onSubmit({ name, email });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign in");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface bg-grid bg-radial flex items-center justify-center p-4">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div className="text-center lg:text-left">
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="w-14 h-14 rounded-xl bg-accent flex items-center justify-center">
              <span className="text-xl font-black text-surface">FPL</span>
            </div>
            <span className="text-2xl font-black">Fantasy Premier League</span>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 leading-tight">
            IPL Fantasy.<br />
            <span className="text-accent">Play for Glory.</span>
          </h1>
          
          <p className="text-text-muted text-lg mb-8 max-w-md mx-auto lg:mx-0">
            Build your dream XI, compete with friends, and unlock exclusive cosmetics. Play-money only.
          </p>
          
          <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto lg:mx-0">
            <div className="stat-block text-center">
              <Users className="w-5 h-5 text-accent mx-auto mb-2" />
              <span className="stat-value">10K+</span>
              <span className="stat-label">Players</span>
            </div>
            <div className="stat-block text-center">
              <Trophy className="w-5 h-5 text-accent mx-auto mb-2" />
              <span className="stat-value">500+</span>
              <span className="stat-label">Leagues</span>
            </div>
            <div className="stat-block text-center">
              <Shield className="w-5 h-5 text-accent mx-auto mb-2" />
              <span className="stat-value">100%</span>
              <span className="stat-label">Free</span>
            </div>
          </div>
        </div>

        <div className="card p-8 max-w-md mx-auto w-full" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20 0L40 20L20 40L0 20z' fill='%2322c55e' fill-opacity='0.02'/%3E%3C/svg%3E\")" }}>
          <h2 className="text-2xl font-bold mb-1">Welcome Back</h2>
          <p className="text-text-muted text-sm mb-6">Enter your details to continue</p>
          
          {notice && (
            <div className="mb-4 p-3 rounded-xl bg-accent/10 border border-accent/20 text-accent text-sm">
              {notice}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full mt-1.5 h-12 px-4 bg-surface border border-border rounded-xl text-text placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
                required
              />
            </div>
            
            <div>
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full mt-1.5 h-12 px-4 bg-surface border border-border rounded-xl text-text placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
                required
              />
            </div>
            
            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}
            
            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-surface/30 border-t-surface rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : (
                "Enter"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
