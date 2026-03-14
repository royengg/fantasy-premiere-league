import { describe, expect, it } from "vitest";

import { defaultRosterRules, validateRoster } from "@fantasy-cricket/domain";
import { calculateRosterPoints } from "@fantasy-cricket/scoring";
import type { Contest, FantasyScoreEvent, Match, Player, Roster } from "@fantasy-cricket/types";

const players: Player[] = [
  { id: "wk1", name: "Keeper One", teamId: "t1", role: "WK", credits: 8.5, rating: 80 },
  { id: "bat1", name: "Batter One", teamId: "t1", role: "BAT", credits: 9, rating: 80 },
  { id: "bat2", name: "Batter Two", teamId: "t1", role: "BAT", credits: 8.5, rating: 80 },
  { id: "bat3", name: "Batter Three", teamId: "t1", role: "BAT", credits: 8, rating: 80 },
  { id: "ar1", name: "All Rounder One", teamId: "t1", role: "AR", credits: 9, rating: 80 },
  { id: "ar2", name: "All Rounder Two", teamId: "t2", role: "AR", credits: 8.5, rating: 80 },
  { id: "bowl1", name: "Bowler One", teamId: "t2", role: "BOWL", credits: 8.5, rating: 80 },
  { id: "bowl2", name: "Bowler Two", teamId: "t2", role: "BOWL", credits: 8, rating: 80 },
  { id: "bowl3", name: "Bowler Three", teamId: "t2", role: "BOWL", credits: 7.5, rating: 80 },
  { id: "bat4", name: "Batter Four", teamId: "t2", role: "BAT", credits: 7.5, rating: 80 },
  { id: "wk2", name: "Keeper Two", teamId: "t2", role: "WK", credits: 7.5, rating: 80 }
];

const contest: Contest = {
  id: "contest-1",
  name: "Test Contest",
  kind: "public",
  matchId: "match-1",
  salaryCap: 100,
  rosterRules: defaultRosterRules,
  lockTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  rewards: []
};

const match: Match = {
  id: "match-1",
  homeTeamId: "t1",
  awayTeamId: "t2",
  startsAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
  venue: "Oval",
  state: "scheduled"
};

describe("fantasy roster validation", () => {
  it("accepts a valid roster under the salary cap", () => {
    const result = validateRoster(
      contest,
      match,
      players,
      {
        playerIds: players.map((player) => player.id),
        captainPlayerId: "bat1",
        viceCaptainPlayerId: "bowl1"
      },
      new Date()
    );

    expect(result.valid).toBe(true);
    expect(result.totalCredits).toBeLessThanOrEqual(100);
  });

  it("rejects duplicate players and missing role minimums", () => {
    const result = validateRoster(
      contest,
      match,
      players,
      {
        playerIds: ["wk1", "bat1", "bat2", "bat3", "bat4", "ar1", "ar2", "bowl1", "bowl2", "bowl3", "bowl3"],
        captainPlayerId: "bat1",
        viceCaptainPlayerId: "bowl1"
      },
      new Date()
    );

    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain("11 unique players");
  });
});

describe("fantasy scoring", () => {
  it("applies captain and vice captain multipliers", () => {
    const roster: Roster = {
      id: "roster-1",
      contestId: "contest-1",
      userId: "user-1",
      players: players.map((player) => ({ playerId: player.id })),
      captainPlayerId: "bat1",
      viceCaptainPlayerId: "bowl1",
      totalCredits: 90,
      submittedAt: new Date().toISOString(),
      locked: false
    };

    const events: FantasyScoreEvent[] = [
      { id: "e1", matchId: "match-1", playerId: "bat1", label: "Runs", points: 20, createdAt: new Date().toISOString() },
      { id: "e2", matchId: "match-1", playerId: "bowl1", label: "Wickets", points: 10, createdAt: new Date().toISOString() }
    ];

    const score = calculateRosterPoints(roster, players, events);
    expect(score.total).toBe(55);
    expect(score.breakdown.find((entry) => entry.playerId === "bat1")?.finalPoints).toBe(40);
    expect(score.breakdown.find((entry) => entry.playerId === "bowl1")?.finalPoints).toBe(15);
  });
});

