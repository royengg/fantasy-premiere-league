import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Clock, TrendingUp, Users } from "lucide-react";

import type {
  BuildRosterInput,
  Contest,
  LeaderboardEntry,
  Match,
  Player,
  Roster,
  Team
} from "@fantasy-cricket/types";

import { CricketField } from "./CricketField";
import { getTeamPalette } from "../lib/team-branding";

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

type ContestTab = "field" | "players" | "leaderboard";

export function ContestView({
  contests,
  matches,
  teams,
  players,
  rosters,
  leaderboard,
  userId,
  onSubmit
}: ContestViewProps) {
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
      {contests.map((contest) => {
        const match = matches.find((entry) => entry.id === contest.matchId);
        if (!match) {
          return null;
        }

        return (
          <ContestCard
            key={contest.id}
            contest={contest}
            match={match}
            homeTeam={teams.find((entry) => entry.id === match.homeTeamId)}
            awayTeam={teams.find((entry) => entry.id === match.awayTeamId)}
            players={players.filter(
              (entry) => entry.teamId === match.homeTeamId || entry.teamId === match.awayTeamId
            )}
            roster={rosters.find((entry) => entry.contestId === contest.id && entry.userId === userId)}
            leaderboard={leaderboard.filter((entry) => entry.contestId === contest.id)}
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

function ContestCard({
  contest,
  match,
  homeTeam,
  awayTeam,
  players,
  roster,
  leaderboard,
  onSubmit
}: ContestCardProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<ContestTab>("field");
  const [starters, setStarters] = useState<string[]>([]);
  const [substitutes, setSubstitutes] = useState<string[]>([]);
  const [captain, setCaptain] = useState("");
  const [viceCaptain, setViceCaptain] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const starterIds = roster?.players.filter((entry) => entry.isStarter).map((entry) => entry.playerId) ?? [];
    const substituteIds = roster?.players.filter((entry) => !entry.isStarter).map((entry) => entry.playerId) ?? [];
    setStarters(starterIds);
    setSubstitutes(substituteIds);
    setCaptain(roster?.captainPlayerId ?? "");
    setViceCaptain(roster?.viceCaptainPlayerId ?? "");
  }, [roster]);

  const selectedIds = [...starters, ...substitutes];
  const selectedPlayers = useMemo(
    () => players.filter((entry) => selectedIds.includes(entry.id)),
    [players, selectedIds]
  );
  const selectedStarters = useMemo(
    () => players.filter((entry) => starters.includes(entry.id)),
    [players, starters]
  );
  const selectedSubstitutes = useMemo(
    () => players.filter((entry) => substitutes.includes(entry.id)),
    [players, substitutes]
  );

  const locked = new Date(contest.lockTime).getTime() <= Date.now();
  const starterTarget = contest.rosterRules.startingPlayers;
  const substituteTarget = contest.rosterRules.substitutePlayers;
  const totalTarget = contest.rosterRules.totalPlayers;
  const isValidShape =
    starters.length === starterTarget &&
    substitutes.length === substituteTarget &&
    selectedIds.length === totalTarget &&
    new Set(selectedIds).size === totalTarget &&
    captain !== "" &&
    viceCaptain !== "" &&
    captain !== viceCaptain;

  const roleCount = useMemo(() => {
    const counts = { WK: 0, BAT: 0, AR: 0, BOWL: 0 };
    for (const player of selectedPlayers) {
      counts[player.role] += 1;
    }
    return counts;
  }, [selectedPlayers]);

  const addStarter = (playerId: string) => {
    if (locked || selectedIds.includes(playerId) || starters.length >= starterTarget) {
      return;
    }
    setStarters((current) => [...current, playerId]);
  };

  const addSubstitute = (playerId: string) => {
    if (locked || selectedIds.includes(playerId) || substitutes.length >= substituteTarget) {
      return;
    }
    setSubstitutes((current) => [...current, playerId]);
  };

  const removePlayer = (playerId: string) => {
    if (locked) {
      return;
    }
    setStarters((current) => current.filter((entry) => entry !== playerId));
    setSubstitutes((current) => current.filter((entry) => entry !== playerId));
    if (captain === playerId) {
      setCaptain("");
    }
    if (viceCaptain === playerId) {
      setViceCaptain("");
    }
  };

  const moveToBench = (playerId: string) => {
    if (locked || substitutes.length >= substituteTarget) {
      return;
    }
    setStarters((current) => current.filter((entry) => entry !== playerId));
    setSubstitutes((current) => [...current, playerId]);
    if (captain === playerId) {
      setCaptain("");
    }
    if (viceCaptain === playerId) {
      setViceCaptain("");
    }
  };

  const moveToStarters = (playerId: string) => {
    if (locked || starters.length >= starterTarget) {
      return;
    }
    setSubstitutes((current) => current.filter((entry) => entry !== playerId));
    setStarters((current) => [...current, playerId]);
  };

  const submit = async () => {
    setStatus(null);
    try {
      await onSubmit(contest.id, {
        starterPlayerIds: starters,
        substitutePlayerIds: substitutes,
        captainPlayerId: captain,
        viceCaptainPlayerId: viceCaptain
      });
      setStatus("Squad saved successfully.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to save squad.");
    }
  };

  const homePalette = homeTeam ? getTeamPalette(homeTeam) : null;
  const awayPalette = awayTeam ? getTeamPalette(awayTeam) : null;
  const teamLabelForPlayer = (player: Player) => {
    if (player.teamId === homeTeam?.id) {
      return homeTeam.shortName;
    }
    if (player.teamId === awayTeam?.id) {
      return awayTeam.shortName;
    }
    return player.teamId;
  };

  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="w-full p-4 sm:p-5 flex flex-col items-start justify-between gap-4 hover:bg-white/[0.02] transition-colors sm:flex-row sm:items-center"
      >
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-6">
          <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:flex sm:flex-none sm:items-center sm:gap-4">
            <TeamBadge team={homePalette?.team} primary={homePalette?.primary} align="left" />
            <div className="px-2 py-1 text-[11px] font-bold text-text-muted sm:px-3 sm:text-xs">VS</div>
            <TeamBadge team={awayPalette?.team} primary={awayPalette?.primary} align="right" />
          </div>
          <div className="hidden md:flex items-center gap-2 text-sm text-text-muted">
            <Clock className="w-4 h-4" />
            {new Date(contest.lockTime).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit"
            })}
          </div>
        </div>
        <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
          {roster ? <span className="badge badge-live">Squad Set</span> : null}
          {open ? (
            <ChevronUp className="w-5 h-5 text-text-muted" />
          ) : (
            <ChevronDown className="w-5 h-5 text-text-muted" />
          )}
        </div>
      </button>

      {open ? (
        <div className="border-t border-border">
          <div className="border-b border-border bg-surface-elevated/50 p-4">
            <div className="flex flex-col gap-4">
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                <button
                  type="button"
                  onClick={() => setTab("field")}
                  className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    tab === "field" ? "bg-accent/10 text-accent" : "text-text-muted hover:text-text"
                  }`}
                >
                  Starting XI
                </button>
                <button
                  type="button"
                  onClick={() => setTab("players")}
                  className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    tab === "players" ? "bg-accent/10 text-accent" : "text-text-muted hover:text-text"
                  }`}
                >
                  Squad Builder
                </button>
                <button
                  type="button"
                  onClick={() => setTab("leaderboard")}
                  className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    tab === "leaderboard" ? "bg-accent/10 text-accent" : "text-text-muted hover:text-text"
                  }`}
                >
                  <TrendingUp className="w-4 h-4 inline mr-1" />
                  Standings
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 sm:gap-4">
                <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3 py-2 sm:block sm:rounded-none sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
                  <span className="text-text-muted">Squad:</span>
                  <span className="font-bold">
                    {selectedIds.length}/{totalTarget}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3 py-2 sm:block sm:rounded-none sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
                  <span className="text-text-muted">XI:</span>
                  <span className="font-bold">
                    {starters.length}/{starterTarget}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3 py-2 sm:block sm:rounded-none sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
                  <span className="text-text-muted">Bench:</span>
                  <span className="font-bold">
                    {substitutes.length}/{substituteTarget}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3 py-2 sm:block sm:rounded-none sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
                  <span className="text-text-muted">Status:</span>
                  <span className={locked ? "font-bold text-red-400" : "font-bold text-accent"}>
                    {locked ? "Locked" : "Open"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 mt-3 text-xs">
              <span className="text-text-muted">Role Balance:</span>
              <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">{roleCount.WK} WK</span>
              <span className="px-2 py-0.5 rounded bg-green-500/20 text-green-400">{roleCount.BAT} BAT</span>
              <span className="px-2 py-0.5 rounded bg-orange-500/20 text-orange-400">{roleCount.AR} AR</span>
              <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-400">{roleCount.BOWL} BOWL</span>
            </div>
          </div>

          <div className="p-4 sm:p-5">
            {tab === "field" ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="card bg-surface-elevated p-3 sm:p-4">
                  <CricketField
                    players={players}
                    selectedIds={starters}
                    captainId={captain}
                    viceCaptainId={viceCaptain}
                  />
                </div>

                <div className="space-y-4">
                  <SectionPanel
                    title="Starting XI"
                    subtitle="Captain and vice-captain must come from the starters."
                    players={selectedStarters}
                    roleTone="starter"
                    onRemove={removePlayer}
                    onMove={substitutes.length < substituteTarget ? moveToBench : undefined}
                    moveLabel="Bench"
                  />

                  <SectionPanel
                    title="Substitutes"
                    subtitle="Up to 2 role-for-role auto substitutions after the match."
                    players={selectedSubstitutes}
                    roleTone="bench"
                    onRemove={removePlayer}
                    onMove={starters.length < starterTarget ? moveToStarters : undefined}
                    moveLabel="Start"
                  />

                  <div className="card bg-surface-elevated p-4 space-y-3">
                    <div>
                      <label className="text-xs text-text-muted mb-1 block">Captain (2x Points)</label>
                      <select
                        value={captain}
                        onChange={(event) => setCaptain(event.target.value)}
                        disabled={locked}
                        className="w-full h-10 px-3 bg-surface border border-border rounded-xl text-sm focus:border-accent outline-none"
                      >
                        <option value="">Select Captain</option>
                        {selectedStarters.map((player) => (
                          <option key={player.id} value={player.id}>
                            {player.name} ({player.role})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-text-muted mb-1 block">Vice Captain (1.5x Points)</label>
                      <select
                        value={viceCaptain}
                        onChange={(event) => setViceCaptain(event.target.value)}
                        disabled={locked}
                        className="w-full h-10 px-3 bg-surface border border-border rounded-xl text-sm focus:border-accent outline-none"
                      >
                        <option value="">Select Vice Captain</option>
                        {selectedStarters
                          .filter((player) => player.id !== captain)
                          .map((player) => (
                            <option key={player.id} value={player.id}>
                              {player.name} ({player.role})
                            </option>
                          ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={submit}
                      disabled={locked || !isValidShape}
                      className="btn-primary w-full"
                    >
                      {roster ? "Update Squad" : "Submit Squad"}
                    </button>

                    {status ? (
                      <div
                        className={`p-3 rounded-xl text-sm text-center ${
                          status.toLowerCase().includes("failed") || status.toLowerCase().includes("error")
                            ? "bg-red-500/10 text-red-400"
                            : "bg-accent/10 text-accent"
                        }`}
                      >
                        {status}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            {tab === "players" ? (
              <div className="space-y-4">
                {["WK", "BAT", "AR", "BOWL"].map((role) => {
                  const rolePlayers = players.filter((player) => player.role === role);

                  return (
                    <div key={role}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          role === "WK"
                            ? "bg-blue-500/20 text-blue-400"
                            : role === "BAT"
                              ? "bg-green-500/20 text-green-400"
                              : role === "AR"
                                ? "bg-orange-500/20 text-orange-400"
                                : "bg-purple-500/20 text-purple-400"
                        }`}>
                          {role}
                        </span>
                        <span className="text-xs text-text-muted">{rolePlayers.length} available</span>
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {rolePlayers.map((player) => {
                          const inStarters = starters.includes(player.id);
                          const inBench = substitutes.includes(player.id);

                          return (
                            <div
                              key={player.id}
                              className={`rounded-xl border p-3 transition-colors ${
                                inStarters
                                  ? "border-accent/40 bg-accent/10"
                                  : inBench
                                    ? "border-amber-500/30 bg-amber-500/10"
                                    : "border-border bg-surface-elevated"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="font-medium text-sm">{player.name}</p>
                                  <p className="text-xs text-text-muted">
                                    {teamLabelForPlayer(player)} • {player.nationality === "overseas" ? "Overseas" : "Domestic"}
                                  </p>
                                </div>
                                <span className="text-xs font-semibold text-text-muted">{player.role}</span>
                              </div>

                              <div className="flex flex-wrap gap-2 mt-3">
                                {!inStarters && !inBench ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => addStarter(player.id)}
                                      disabled={locked || starters.length >= starterTarget}
                                      className="btn-secondary !px-3 !py-2 !text-xs"
                                    >
                                      Start
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => addSubstitute(player.id)}
                                      disabled={locked || substitutes.length >= substituteTarget}
                                      className="btn-secondary !px-3 !py-2 !text-xs"
                                    >
                                      Bench
                                    </button>
                                  </>
                                ) : null}

                                {inStarters ? (
                                  <>
                                    <span className="badge">Starter</span>
                                    <button
                                      type="button"
                                      onClick={() => moveToBench(player.id)}
                                      disabled={locked || substitutes.length >= substituteTarget}
                                      className="btn-secondary !px-3 !py-2 !text-xs"
                                    >
                                      Bench
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => removePlayer(player.id)}
                                      disabled={locked}
                                      className="btn-secondary !px-3 !py-2 !text-xs"
                                    >
                                      Remove
                                    </button>
                                  </>
                                ) : null}

                                {inBench ? (
                                  <>
                                    <span className="badge">Substitute</span>
                                    <button
                                      type="button"
                                      onClick={() => moveToStarters(player.id)}
                                      disabled={locked || starters.length >= starterTarget}
                                      className="btn-secondary !px-3 !py-2 !text-xs"
                                    >
                                      Start
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => removePlayer(player.id)}
                                      disabled={locked}
                                      className="btn-secondary !px-3 !py-2 !text-xs"
                                    >
                                      Remove
                                    </button>
                                  </>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {tab === "leaderboard" ? (
              <div className="space-y-2">
                {leaderboard.length === 0 ? (
                  <div className="text-center py-10">
                    <TrendingUp className="w-10 h-10 text-text-muted/50 mx-auto mb-2" />
                    <p className="text-text-muted">No entries yet. Be the first to submit your squad.</p>
                  </div>
                ) : (
                  leaderboard.map((entry, index) => (
                    <div
                      key={entry.id}
                      className={`flex items-center justify-between gap-3 rounded-xl p-3 sm:p-4 ${
                        index < 3 ? "bg-accent/10 border border-accent/20" : "bg-surface-elevated border border-border"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <span
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                            index === 0
                              ? "bg-yellow-500/20 text-yellow-400"
                              : index === 1
                                ? "bg-slate-400/20 text-slate-400"
                                : index === 2
                                  ? "bg-amber-600/20 text-amber-600"
                                  : "bg-surface text-text-muted"
                          }`}
                        >
                          {entry.rank}
                        </span>
                        <span className="font-medium">{entry.displayName ?? `${entry.userId.slice(0, 8)}...`}</span>
                      </div>
                      <span className="font-bold font-mono text-lg">{entry.points.toFixed(1)}</span>
                    </div>
                  ))
                )}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

interface SectionPanelProps {
  title: string;
  subtitle: string;
  players: Player[];
  roleTone: "starter" | "bench";
  onRemove: (playerId: string) => void;
  onMove?: (playerId: string) => void;
  moveLabel?: string;
}

function SectionPanel({ title, subtitle, players, roleTone, onRemove, onMove, moveLabel }: SectionPanelProps) {
  return (
    <div className="card bg-surface-elevated p-4">
      <div className="mb-3">
        <h4 className="font-semibold">{title}</h4>
        <p className="text-xs text-text-muted mt-1">{subtitle}</p>
      </div>
      <div className="space-y-2">
        {players.length > 0 ? (
          players.map((player) => (
            <div key={player.id} className="flex flex-col gap-3 rounded-xl bg-surface p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="font-medium text-sm">{player.name}</div>
                <div className="text-xs text-text-muted">{player.role}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`badge ${roleTone === "bench" ? "bg-amber-500/15 text-amber-300" : ""}`}>
                  {roleTone === "starter" ? "XI" : "SUB"}
                </span>
                {onMove && moveLabel ? (
                  <button type="button" onClick={() => onMove(player.id)} className="btn-secondary !px-3 !py-2 !text-xs">
                    {moveLabel}
                  </button>
                ) : null}
                <button type="button" onClick={() => onRemove(player.id)} className="btn-secondary !px-3 !py-2 !text-xs">
                  Remove
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="text-sm text-text-muted">No players added yet.</div>
        )}
      </div>
    </div>
  );
}

interface TeamBadgeProps {
  team?: Team;
  primary?: string;
  align?: "left" | "right";
}

function TeamBadge({ team, primary, align = "left" }: TeamBadgeProps) {
  const shortName = team?.shortName?.toUpperCase() ?? "TBD";
  const isRightAligned = align === "right";

  return (
    <div
      className={`flex min-w-0 items-center gap-2 sm:gap-3 ${
        isRightAligned ? "justify-end text-right" : "justify-start text-left"
      }`}
    >
      <div
        className={`h-9 w-9 shrink-0 rounded-xl border flex items-center justify-center text-xs font-black sm:h-12 sm:w-12 sm:text-sm ${
          isRightAligned ? "order-2 sm:order-none" : ""
        }`}
        style={{
          background: primary ? `${primary}18` : "rgba(34, 197, 94, 0.12)",
          borderColor: primary ? `${primary}44` : "rgba(34, 197, 94, 0.24)",
          color: primary ?? "#22c55e"
        }}
      >
        {shortName}
      </div>
      <div className={`min-w-0 ${isRightAligned ? "order-1 sm:order-none" : ""}`}>
        <p className="whitespace-normal break-words text-[10px] font-semibold leading-[1.05rem] text-text sm:text-sm sm:leading-tight">
          {team?.name ?? "Team TBD"}
        </p>
        <p className="hidden text-[11px] uppercase tracking-[0.18em] text-text-muted sm:block">
          {team?.city ?? "IPL"}
        </p>
      </div>
    </div>
  );
}
