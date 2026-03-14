import { useState } from "react";
import { Sparkles, Shield, Users, Trophy } from "lucide-react";

interface AuthScreenProps {
  onSubmit: (payload: { name: string; email: string }) => Promise<unknown>;
}

export function AuthScreen({ onSubmit }: AuthScreenProps) {
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
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent-green to-accent-green/60 flex items-center justify-center">
              <Sparkles className="w-7 h-7 text-surface" />
            </div>
            <span className="text-2xl font-black">Fantasy Club</span>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 leading-tight">
            Play Fantasy.<br />
            <span className="text-gradient-green">Earn Rewards.</span>
          </h1>
          
          <p className="text-text-muted text-lg mb-8 max-w-md mx-auto lg:mx-0">
            Build your dream XI, compete with friends, and unlock exclusive cosmetics. No real money involved.
          </p>
          
          <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto lg:mx-0">
            <div className="stat-block text-center">
              <Users className="w-5 h-5 text-accent-green mx-auto mb-2" />
              <span className="stat-value">10K+</span>
              <span className="stat-label">Players</span>
            </div>
            <div className="stat-block text-center">
              <Trophy className="w-5 h-5 text-accent-orange mx-auto mb-2" />
              <span className="stat-value">500+</span>
              <span className="stat-label">Leagues</span>
            </div>
            <div className="stat-block text-center">
              <Shield className="w-5 h-5 text-accent-blue mx-auto mb-2" />
              <span className="stat-value">100%</span>
              <span className="stat-label">Free</span>
            </div>
          </div>
        </div>

        <div className="card-hero p-8 max-w-md mx-auto w-full">
          <h2 className="text-2xl font-bold mb-1">Welcome Back</h2>
          <p className="text-text-muted text-sm mb-6">Enter your details to continue</p>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full mt-1.5 h-12 px-4 bg-surface border border-border rounded-xl text-text placeholder:text-text-muted focus:outline-none focus:border-accent-green transition-colors"
                required
              />
            </div>
            
            <div>
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full mt-1.5 h-12 px-4 bg-surface border border-border rounded-xl text-text placeholder:text-text-muted focus:outline-none focus:border-accent-green transition-colors"
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
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-surface/30 border-t-surface rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : (
                "Enter the Club"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}