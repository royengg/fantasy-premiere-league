import { useState, useEffect, useMemo } from "react";
import { ChevronDown, ChevronUp, Clock, Users, Star, TrendingUp } from "lucide-react";
import type { BuildRosterInput, Contest, LeaderboardEntry, Match, Player, Roster, Team } from "@fantasy-cricket/types";
import { CricketField } from "./CricketField";
import { getTeamPalette } from "../lib/team-branding";

interface ContestViewProps {
  contests: Contest[];
  matches: Match[];
  teams: Team[];
  players: Player[];
  rosters: Roster[];
  leaderboard: LeaderboardEntry[];
  profileCredits: number;
  userId: string;
  onSubmit: (contestId: string, payload: BuildRosterInput) => Promise<unknown>;
}

export function ContestView({ contests, matches, teams, players, rosters, leaderboard, profileCredits, userId, onSubmit }: ContestViewProps) {
  if (contests.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="w-20 h-20 rounded-full bg-white/5 border border-border flex items-center justify-center mx-auto mb-4">
          <Users className="w-10 h-10 text-text-muted/50" />
        </div>
        <h2 className="text-xl font-bold mb-2">No Live Matches</h2>
        <p className="text-text-muted">Check back later for upcoming fixtures.</p>
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
            profileCredits={profileCredits}
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
  profileCredits: number;
  onSubmit: (contestId: string, payload: BuildRosterInput) => Promise<unknown>;
}

function ContestCard({ contest, match, homeTeam, awayTeam, players, roster, leaderboard, profileCredits, onSubmit }: ContestCardProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"field" | "players" | "leaderboard">("field");
  const [selected, setSelected] = useState<string[]>([]);
  const [captain, setCaptain] = useState("");
  const [viceCaptain, setViceCaptain] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const base = roster?.players.map(p => p.playerId) ?? [];
    setSelected(base);
    setCaptain(roster?.captainPlayerId ?? "");
    setViceCaptain(roster?.viceCaptainPlayerId ?? "");
  }, [roster]);

  const selectedPlayers = useMemo(() => players.filter(p => selected.includes(p.id)), [players, selected]);
  const creditsUsed = selectedPlayers.reduce((sum, p) => sum + p.credits, 0);
  const remaining = contest.salaryCap - creditsUsed;
  const isFull = selected.length === contest.rosterRules.totalPlayers;
  const locked = new Date(contest.lockTime) < new Date();
  const creditDelta = Number((creditsUsed - (roster?.totalCredits ?? 0)).toFixed(1));
  const lacksCredits = creditDelta > profileCredits;

  const roleCount = useMemo(() => {
    const counts = { WK: 0, BAT: 0, AR: 0, BOWL: 0 };
    selectedPlayers.forEach(p => {
      counts[p.role as keyof typeof counts]++;
    });
    return counts;
  }, [selectedPlayers]);

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
      setStatus("Team saved successfully!");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to save team");
    }
  };

  const creditsPercent = (creditsUsed / contest.salaryCap) * 100;
  const homePalette = homeTeam ? getTeamPalette(homeTeam) : null;
  const awayPalette = awayTeam ? getTeamPalette(awayTeam) : null;

  return (
    <div 
      className="card overflow-hidden" 
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='30' cy='30' r='25' fill='none' stroke='%2322c55e' stroke-opacity='0.03' stroke-width='1'/%3E%3C/svg%3E\")" }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full p-5 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4 min-w-0">
            <TeamBadge team={homePalette?.team} primary={homePalette?.primary} />
            <div className="px-3 py-1 text-xs font-bold text-text-muted">VS</div>
            <TeamBadge team={awayPalette?.team} primary={awayPalette?.primary} />
          </div>
          <div className="hidden md:flex items-center gap-2 text-sm text-text-muted">
            <Clock className="w-4 h-4" />
            {new Date(contest.lockTime).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {roster && <span className="badge badge-live">Team Set</span>}
          {open ? <ChevronUp className="w-5 h-5 text-text-muted" /> : <ChevronDown className="w-5 h-5 text-text-muted" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-border">
          <div className="p-4 border-b border-border bg-surface-elevated/50">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex gap-2">
                <button onClick={() => setTab("field")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "field" ? "bg-accent/10 text-accent" : "text-text-muted hover:text-text"}`}>
                  Field View
                </button>
                <button onClick={() => setTab("players")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "players" ? "bg-accent/10 text-accent" : "text-text-muted hover:text-text"}`}>
                  Player List
                </button>
                <button onClick={() => setTab("leaderboard")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "leaderboard" ? "bg-accent/10 text-accent" : "text-text-muted hover:text-text"}`}>
                  <TrendingUp className="w-4 h-4 inline mr-1" />Standings
                </button>
              </div>
              
              <div className="flex-1" />
              
              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-text-muted">Players:</span>
                  <span className={`font-bold ${isFull ? "text-accent" : ""}`}>{selected.length}/11</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-text-muted">Wallet:</span>
                  <span className={`font-bold ${lacksCredits ? "text-red-400" : "text-accent"}`}>
                    {profileCredits.toFixed(1)} cr
                  </span>
                </div>
                <div className="w-32">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-text-muted">Credits</span>
                    <span className={remaining < 0 ? "text-red-400" : "text-accent"}>{remaining.toFixed(1)} left</span>
                  </div>
                  <div className="h-2 bg-surface rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all ${remaining < 0 ? "bg-red-500" : "bg-accent"}`}
                      style={{ width: `${Math.min(creditsPercent, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 mt-3 text-xs">
              <span className="text-text-muted">Team Balance:</span>
              <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">{roleCount.WK} WK</span>
              <span className="px-2 py-0.5 rounded bg-green-500/20 text-green-400">{roleCount.BAT} BAT</span>
              <span className="px-2 py-0.5 rounded bg-orange-500/20 text-orange-400">{roleCount.AR} AR</span>
              <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-400">{roleCount.BOWL} BOWL</span>
              <span className={lacksCredits ? "text-red-400" : "text-text-muted"}>
                {creditDelta > 0
                  ? `Save cost: ${creditDelta.toFixed(1)} cr`
                  : creditDelta < 0
                    ? `Refund: ${Math.abs(creditDelta).toFixed(1)} cr`
                    : "No credit change"}
              </span>
            </div>
          </div>

          <div className="p-5">
            {tab === "field" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="card p-4 bg-surface-elevated">
                  <CricketField 
                    players={players}
                    selectedIds={selected}
                    captainId={captain}
                    viceCaptainId={viceCaptain}
                  />
                </div>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Star className="w-4 h-4 text-accent" />Captain Selection
                    </h4>
                    <div className="space-y-2">
                      <div>
                        <label className="text-xs text-text-muted mb-1 block">Captain (2x Points)</label>
                        <select 
                          value={captain} 
                          onChange={e => setCaptain(e.target.value)} 
                          disabled={locked} 
                          className="w-full h-10 px-3 bg-surface border border-border rounded-xl text-sm focus:border-accent outline-none disabled:opacity-50"
                        >
                          <option value="">Select Captain</option>
                          {selectedPlayers.map(p => <option key={p.id} value={p.id}>{p.name} ({p.role})</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-text-muted mb-1 block">Vice Captain (1.5x Points)</label>
                        <select 
                          value={viceCaptain} 
                          onChange={e => setViceCaptain(e.target.value)} 
                          disabled={locked} 
                          className="w-full h-10 px-3 bg-surface border border-border rounded-xl text-sm focus:border-accent outline-none disabled:opacity-50"
                        >
                          <option value="">Select Vice Captain</option>
                          {selectedPlayers.filter(p => p.id !== captain).map(p => <option key={p.id} value={p.id}>{p.name} ({p.role})</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border">
                    <h4 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-3">Selected Players</h4>
                    <div className="space-y-1 max-h-[200px] overflow-y-auto">
                      {selectedPlayers.length === 0 ? (
                        <p className="text-sm text-text-muted text-center py-4">Click on the field positions or use Player List to select your XI</p>
                      ) : (
                        selectedPlayers.map(p => (
                          <div 
                            key={p.id}
                            className="flex items-center justify-between p-2 rounded-lg bg-surface hover:bg-surface-elevated transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <span className={`w-6 h-6 rounded text-xs font-bold flex items-center justify-center ${
                                p.role === "WK" ? "bg-blue-500/20 text-blue-400" :
                                p.role === "BAT" ? "bg-green-500/20 text-green-400" :
                                p.role === "AR" ? "bg-orange-500/20 text-orange-400" :
                                "bg-purple-500/20 text-purple-400"
                              }`}>
                                {p.role}
                              </span>
                              <span className="text-sm font-medium">{p.name}</span>
                              {p.id === captain && <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded font-bold">C</span>}
                              {p.id === viceCaptain && <span className="text-[10px] bg-slate-500/20 text-slate-400 px-1.5 py-0.5 rounded font-bold">VC</span>}
                            </div>
                            <button
                              onClick={() => toggle(p.id)}
                              disabled={locked}
                              className="text-text-muted hover:text-red-400 transition-colors disabled:opacity-50"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  
                  <button 
                    onClick={submit} 
                    disabled={locked || !isFull || remaining < 0 || lacksCredits} 
                    className="btn-primary w-full mt-4"
                  >
                    {roster ? "Update Team" : "Submit Team"}
                  </button>
                  {status && <div className={`p-3 rounded-xl text-sm text-center ${status.includes("Failed") ? "bg-red-500/10 text-red-400" : "bg-accent/10 text-accent"}`}>{status}</div>}
                </div>
              </div>
            )}

            {tab === "players" && (
              <div className="space-y-4">
                {["WK", "BAT", "AR", "BOWL"].map(role => {
                  const rolePlayers = players.filter(p => p.role === role);
                  const selectedInRole = rolePlayers.filter(p => selected.includes(p.id));
                  
                  return (
                    <div key={role}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          role === "WK" ? "bg-blue-500/20 text-blue-400" :
                          role === "BAT" ? "bg-green-500/20 text-green-400" :
                          role === "AR" ? "bg-orange-500/20 text-orange-400" :
                          "bg-purple-500/20 text-purple-400"
                        }`}>
                          {role === "WK" ? "Wicket-Keeper" : role === "BAT" ? "Batsmen" : role === "AR" ? "All-Rounders" : "Bowlers"}
                        </span>
                        <span className="text-xs text-text-muted">{selectedInRole.length} selected</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {rolePlayers.map(p => {
                          const active = selected.includes(p.id);
                          return (
                            <button
                              key={p.id}
                              onClick={() => toggle(p.id)}
                              disabled={locked}
                              className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${active ? "bg-accent/10 border-accent/30" : "bg-surface-elevated border-border hover:border-accent/30"} ${locked ? "opacity-60 cursor-not-allowed" : ""}`}
                            >
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold ${active ? "bg-accent/20 text-accent" : "bg-white/5 text-text-muted"}`}>
                                {p.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{p.name}</p>
                                <p className="text-xs text-text-muted">{p.credits} credits</p>
                              </div>
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${active ? "border-accent bg-accent" : "border-border"}`}>
                                {active && <svg className="w-3 h-3 text-surface" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {tab === "leaderboard" && (
              <div className="space-y-2">
                {leaderboard.length === 0 ? (
                  <div className="text-center py-10">
                    <TrendingUp className="w-10 h-10 text-text-muted/50 mx-auto mb-2" />
                    <p className="text-text-muted">No entries yet. Be the first to submit your team!</p>
                  </div>
                ) : (
                  leaderboard.map((e, i) => (
                    <div key={e.id} className={`flex items-center justify-between p-4 rounded-xl ${i < 3 ? "bg-accent/10 border border-accent/20" : "bg-surface-elevated border border-border"}`}>
                      <div className="flex items-center gap-4">
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${i === 0 ? "bg-yellow-500/20 text-yellow-400" : i === 1 ? "bg-slate-400/20 text-slate-400" : i === 2 ? "bg-amber-600/20 text-amber-600" : "bg-surface text-text-muted"}`}>
                          {e.rank}
                        </span>
                        <span className="font-medium">{e.displayName ?? `${e.userId.slice(0, 8)}...`}</span>
                      </div>
                      <span className="font-bold font-mono text-lg">{e.points.toFixed(1)}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface TeamBadgeProps {
  team?: Team;
  primary?: string;
}

function TeamBadge({ team, primary }: TeamBadgeProps) {
  const shortName = team?.shortName?.toUpperCase() ?? "TBD";

  return (
    <div className="flex items-center gap-3 min-w-0">
      <div
        className="w-12 h-12 rounded-xl border flex items-center justify-center text-sm font-black shrink-0"
        style={{
          background: primary ? `${primary}18` : "rgba(34, 197, 94, 0.12)",
          borderColor: primary ? `${primary}44` : "rgba(34, 197, 94, 0.24)",
          color: primary ?? "#22c55e"
        }}
      >
        {shortName}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-text leading-tight truncate">
          {team?.name ?? "Team TBD"}
        </p>
        <p className="text-[11px] uppercase tracking-[0.18em] text-text-muted">
          {team?.city ?? "IPL"}
        </p>
      </div>
    </div>
  );
}
