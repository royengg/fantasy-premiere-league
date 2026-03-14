import { useState, useEffect, useMemo } from "react";
import { ChevronDown, ChevronUp, Clock, Users, Star, TrendingUp } from "lucide-react";
import type { BuildRosterInput, Contest, LeaderboardEntry, Match, Player, Roster, Team } from "@fantasy-cricket/types";

interface ContestViewProps {
  contests: Contest[];
  matches: Match[];
  teams: Team[];
  players: Player[];
  rosters: Roster[];
  leaderboard: LeaderboardEntry[];
  userId: string;
  onSubmit: (contestId: string, payload: BuildRosterInput) => Promise<unknown>;
}

export function ContestView({ contests, matches, teams, players, rosters, leaderboard, userId, onSubmit }: ContestViewProps) {
  if (contests.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
          <Users className="w-10 h-10 text-text-muted/50" />
        </div>
        <h2 className="text-xl font-bold mb-2">No Active Contests</h2>
        <p className="text-text-muted">Check back later for upcoming matches.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {contests.map(contest => {
        const match = matches.find(m => m.id === contest.matchId);
        if (!match) return null;
        const matchPlayers = players.filter(p => p.teamId === match.homeTeamId || p.teamId === match.awayTeamId);
        const roster = rosters.find(r => r.contestId === contest.id && r.userId === userId);
        const contestLeaderboard = leaderboard.filter(e => e.contestId === contest.id);
        
        return (
          <ContestCard
            key={contest.id}
            contest={contest}
            match={match}
            homeTeam={teams.find(t => t.id === match.homeTeamId)}
            awayTeam={teams.find(t => t.id === match.awayTeamId)}
            players={matchPlayers}
            roster={roster}
            leaderboard={contestLeaderboard}
            onSubmit={onSubmit}
          />
        );
      })}
    </div>
  );
}

interface ContestCardProps {
  contest: Contest;
  match: Match;
  homeTeam?: Team;
  awayTeam?: Team;
  players: Player[];
  roster?: Roster;
  leaderboard: LeaderboardEntry[];
  onSubmit: (contestId: string, payload: BuildRosterInput) => Promise<unknown>;
}

function ContestCard({ contest, match, homeTeam, awayTeam, players, roster, leaderboard, onSubmit }: ContestCardProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"squad" | "leaderboard">("squad");
  const [selected, setSelected] = useState<string[]>([]);
  const [captain, setCaptain] = useState("");
  const [viceCaptain, setViceCaptain] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const base = roster?.players.map(p => p.playerId) ?? players.slice(0, 11).map(p => p.id);
    setSelected(base);
    setCaptain(roster?.captainPlayerId ?? base[0] ?? "");
    setViceCaptain(roster?.viceCaptainPlayerId ?? base[1] ?? "");
  }, [roster, players]);

  const selectedPlayers = useMemo(() => players.filter(p => selected.includes(p.id)), [players, selected]);
  const creditsUsed = selectedPlayers.reduce((sum, p) => sum + p.credits, 0);
  const remaining = contest.salaryCap - creditsUsed;
  const isFull = selected.length === contest.rosterRules.totalPlayers;
  const locked = new Date(contest.lockTime) < new Date();

  const toggle = (id: string) => {
    if (locked) return;
    setSelected(curr => {
      if (curr.includes(id)) return curr.filter(x => x !== id);
      if (curr.length >= contest.rosterRules.totalPlayers) return curr;
      return [...curr, id];
    });
  };

  const submit = async () => {
    setStatus(null);
    try {
      await onSubmit(contest.id, { playerIds: selected, captainPlayerId: captain, viceCaptainPlayerId: viceCaptain });
      setStatus("Saved!");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <div className="card-hero overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full p-5 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent-green/20 to-accent-green/5 flex items-center justify-center text-lg font-bold text-accent-green">
              {homeTeam?.shortName?.slice(0, 2) ?? "H"}
            </div>
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wider">vs</p>
              <p className="font-semibold">{awayTeam?.name ?? "Away"}</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 text-sm text-text-muted">
            <Clock className="w-4 h-4" />
            {new Date(contest.lockTime).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {roster && <span className="badge badge-live">Joined</span>}
          {open ? <ChevronUp className="w-5 h-5 text-text-muted" /> : <ChevronDown className="w-5 h-5 text-text-muted" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-border/50 p-5">
          <div className="flex gap-4 mb-4">
            <button onClick={() => setTab("squad")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "squad" ? "bg-accent-green/10 text-accent-green" : "text-text-muted hover:text-text"}`}>
              <Users className="w-4 h-4 inline mr-2" />Squad
            </button>
            <button onClick={() => setTab("leaderboard")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "leaderboard" ? "bg-accent-green/10 text-accent-green" : "text-text-muted hover:text-text"}`}>
              <TrendingUp className="w-4 h-4 inline mr-2" />Leaderboard
            </button>
            <div className="ml-auto flex items-center gap-4 text-sm">
              <span><span className={isFull ? "text-accent-green" : ""}>{selected.length}</span>/{contest.rosterRules.totalPlayers}</span>
              <span className={remaining < 0 ? "text-red-400" : "text-accent-orange"}>{remaining.toFixed(1)} cr</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              {tab === "squad" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-2">
                  {players.map(p => {
                    const active = selected.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        onClick={() => toggle(p.id)}
                        disabled={locked}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${active ? "bg-accent-green/10 border-accent-green/30" : "bg-surface-elevated border-border/30 hover:border-border/50"} ${locked ? "opacity-60 cursor-not-allowed" : ""}`}
                      >
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold ${p.teamId === match.homeTeamId ? "bg-accent-green/20 text-accent-green" : "bg-accent-orange/20 text-accent-orange"}`}>
                          {p.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{p.name}</p>
                          <p className="text-xs text-text-muted">{p.role.slice(0, 3)} · {p.credits} cr</p>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${active ? "border-accent-green bg-accent-green" : "border-border"}`}>
                          {active && <svg className="w-3 h-3 text-surface" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                  {leaderboard.length === 0 ? (
                    <div className="text-center py-10 text-text-muted">No entries yet</div>
                  ) : leaderboard.map((e, i) => (
                    <div key={e.id} className={`flex items-center justify-between p-3 rounded-xl ${i < 3 ? "bg-accent-orange/10 border border-accent-orange/20" : "bg-surface-elevated border border-border/30"}`}>
                      <div className="flex items-center gap-3">
                        <span className={`font-bold text-lg w-6 ${i === 0 ? "text-accent-gold" : i === 1 ? "text-zinc-400" : i === 2 ? "text-amber-600" : ""}`}>{e.rank}</span>
                        <span className="font-medium text-sm">{e.userId.slice(0, 8)}...</span>
                      </div>
                      <span className="font-bold font-mono">{e.points.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                  <Star className="w-4 h-4 text-accent-orange" />Leadership
                </div>
                <div className="space-y-2">
                  <select value={captain} onChange={e => setCaptain(e.target.value)} disabled={locked} className="w-full h-10 px-3 bg-surface-elevated border border-border rounded-xl text-sm focus:border-accent-green outline-none">
                    <option value="">Captain (2x)</option>
                    {selectedPlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <select value={viceCaptain} onChange={e => setViceCaptain(e.target.value)} disabled={locked} className="w-full h-10 px-3 bg-surface-elevated border border-border rounded-xl text-sm focus:border-accent-green outline-none">
                    <option value="">Vice Captain (1.5x)</option>
                    {selectedPlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
              <button onClick={submit} disabled={locked || !isFull || remaining < 0} className="btn-primary w-full">
                {roster ? "Update" : "Submit"} Roster
              </button>
              {status && <div className={`p-3 rounded-xl text-sm text-center ${status.includes("Failed") ? "bg-red-500/10 text-red-400" : "bg-accent-green/10 text-accent-green"}`}>{status}</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}