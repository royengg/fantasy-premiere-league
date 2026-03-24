import { Users } from "lucide-react";
import type {
  BuildRosterInput,
  Contest,
  LeaderboardEntry,
  Match,
  Player,
  Roster,
  Team
} from "@fantasy-cricket/types";

import { ContestCard } from "./contest/ContestCard";

export interface ContestViewProps {
  contests: Contest[];
  matches: Match[];
  teams: Team[];
  players: Player[];
  rosters: Roster[];
  leaderboard: LeaderboardEntry[];
  userId: string;
  onSubmit: (contestId: string, payload: BuildRosterInput) => Promise<unknown>;
}

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
