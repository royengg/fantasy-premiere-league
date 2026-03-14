import { useState } from "react";
import { Plus, UserPlus, Users, Trophy, Copy, Check } from "lucide-react";
import type { League } from "@fantasy-cricket/types";

interface LeagueViewProps {
  leagues: League[];
  onCreate: (payload: { name: string; description?: string; visibility: "public" | "private" }) => Promise<unknown>;
  onJoin: (inviteCode: string) => Promise<unknown>;
}

export function LeagueView({ leagues, onCreate, onJoin }: LeagueViewProps) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<{ msg: string; ok: boolean } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    try {
      await onCreate({ name, description: desc, visibility: "private" });
      setName("");
      setDesc("");
      setStatus({ msg: "Created!", ok: true });
    } catch (err) {
      setStatus({ msg: err instanceof Error ? err.message : "Failed", ok: false });
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    try {
      await onJoin(code);
      setCode("");
      setStatus({ msg: "Joined!", ok: true });
    } catch (err) {
      setStatus({ msg: err instanceof Error ? err.message : "Failed", ok: false });
    }
  };

  const copyCode = (c: string) => {
    navigator.clipboard.writeText(c);
    setCopied(c);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-8">
      <div className="card-hero card-hero-orange p-6">
        <div className="flex items-center gap-2 mb-2">
          <Trophy className="w-5 h-5 text-accent-orange" />
          <span className="text-xs font-bold uppercase tracking-widest text-accent-orange">Social</span>
        </div>
        <h2 className="text-2xl font-bold">Friend Leagues</h2>
        <p className="text-text-muted text-sm mt-1">Create private leagues and compete with your friends.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-2">
            <Users className="w-4 h-4" />Your Leagues
          </h3>
          
          {leagues.length === 0 ? (
            <div className="card-hero border-dashed border-border/50 text-center py-16">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-text-muted/50" />
              </div>
              <h3 className="text-lg font-bold mb-2">No Leagues Yet</h3>
              <p className="text-text-muted text-sm">Create or join a league to get started.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {leagues.map(l => (
                <div key={l.id} className="card-hero p-4 hover:border-accent-orange/30 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-bold">{l.name}</h4>
                      <p className="text-sm text-text-muted">{l.description || "No description"}</p>
                    </div>
                    <span className="badge bg-accent-orange/10 text-accent-orange border-accent-orange/20">{l.visibility}</span>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-border/50">
                    <span className="text-sm text-text-muted flex items-center gap-1">
                      <Users className="w-4 h-4 text-accent-green" />{l.memberIds.length} members
                    </span>
                    <button onClick={() => copyCode(l.inviteCode)} className="flex items-center gap-2 px-2 py-1 rounded-lg bg-surface-elevated hover:bg-surface-card transition-colors text-xs">
                      <code className="font-mono font-bold">{l.inviteCode}</code>
                      {copied === l.inviteCode ? <Check className="w-3 h-3 text-accent-green" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="card-hero p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-accent-green/20 flex items-center justify-center">
                <Plus className="w-4 h-4 text-accent-green" />
              </div>
              <h3 className="font-bold">Create League</h3>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              <input value={name} onChange={e => setName(e.target.value)} placeholder="League name" className="w-full h-10 px-3 bg-surface border border-border rounded-xl text-sm focus:border-accent-green outline-none" required />
              <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description (optional)" className="w-full h-10 px-3 bg-surface border border-border rounded-xl text-sm focus:border-accent-green outline-none" />
              <button type="submit" disabled={!name} className="btn-primary w-full">Create</button>
            </form>
          </div>

          <div className="card-hero p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-accent-orange/20 flex items-center justify-center">
                <UserPlus className="w-4 h-4 text-accent-orange" />
              </div>
              <h3 className="font-bold">Join League</h3>
            </div>
            <form onSubmit={handleJoin} className="space-y-3">
              <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="Invite code" className="w-full h-10 px-3 bg-surface border border-border rounded-xl text-sm font-mono uppercase tracking-wider focus:border-accent-orange outline-none" required />
              <button type="submit" disabled={!code} className="btn-secondary w-full border-accent-orange/30 hover:bg-accent-orange/10">Join</button>
            </form>
          </div>

          {status && (
            <div className={`p-3 rounded-xl text-sm font-medium ${status.ok ? "bg-accent-green/10 text-accent-green" : "bg-red-500/10 text-red-400"}`}>
              {status.msg}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}