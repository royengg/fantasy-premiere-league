import { describe, expect, it } from "vitest";

import { defaultRosterRules, validateRoster } from "@fantasy-cricket/domain";
import { calculateRosterPoints, createFantasyScoreEventsFromStatLines } from "@fantasy-cricket/scoring";
import type { Contest, FantasyScoreEvent, Match, Player, PlayerMatchStatLine, Roster } from "@fantasy-cricket/types";

const players: Player[] = [
  { id: "wk-1", name: "Keeper One", teamId: "team-a", role: "WK", rating: 82, nationality: "indian-capped", selectionPercent: 40 },
  { id: "wk-2", name: "Keeper Two", teamId: "team-b", role: "WK", rating: 74, nationality: "indian-capped", selectionPercent: 18 },
  { id: "bat-1", name: "Batter One", teamId: "team-a", role: "BAT", rating: 88, nationality: "indian-capped", selectionPercent: 58 },
  { id: "bat-2", name: "Batter Two", teamId: "team-a", role: "BAT", rating: 80, nationality: "indian-uncapped", selectionPercent: 34 },
  { id: "bat-3", name: "Batter Three", teamId: "team-b", role: "BAT", rating: 84, nationality: "indian-capped", selectionPercent: 31 },
  { id: "bat-4", name: "Batter Four", teamId: "team-b", role: "BAT", rating: 75, nationality: "overseas", selectionPercent: 21 },
  { id: "ar-1", name: "All Rounder One", teamId: "team-a", role: "AR", rating: 90, nationality: "indian-capped", selectionPercent: 61 },
  { id: "ar-2", name: "All Rounder Two", teamId: "team-b", role: "AR", rating: 78, nationality: "overseas", selectionPercent: 27 },
  { id: "bowl-1", name: "Bowler One", teamId: "team-a", role: "BOWL", rating: 86, nationality: "indian-capped", selectionPercent: 49 },
  { id: "bowl-2", name: "Bowler Two", teamId: "team-a", role: "BOWL", rating: 79, nationality: "indian-capped", selectionPercent: 24 },
  { id: "bowl-3", name: "Bowler Three", teamId: "team-b", role: "BOWL", rating: 81, nationality: "indian-capped", selectionPercent: 28 },
  { id: "bowl-4", name: "Bowler Four", teamId: "team-b", role: "BOWL", rating: 73, nationality: "indian-uncapped", selectionPercent: 16 },
  { id: "bat-5", name: "Bench Batter", teamId: "team-a", role: "BAT", rating: 83, nationality: "indian-capped", selectionPercent: 19 }
];

const contest: Contest = {
  id: "contest-1",
  name: "Team A vs Team B",
  kind: "public",
  matchId: "match-1",
  rosterRules: defaultRosterRules,
  lockTime: "2026-04-01T14:00:00.000Z",
  rewards: []
};

const match: Match = {
  id: "match-1",
  homeTeamId: "team-a",
  awayTeamId: "team-b",
  startsAt: "2026-04-01T14:30:00.000Z",
  venue: "Wankhede Stadium",
  state: "scheduled"
};

describe("contest roster rules", () => {
  it("accepts a valid 11 + 2 roster with captain and vice-captain in the starting XI", () => {
    const result = validateRoster(
      contest,
      match,
      players,
      {
        starterPlayerIds: [
          "wk-1",
          "bat-1",
          "bat-2",
          "bat-3",
          "ar-1",
          "ar-2",
          "bowl-1",
          "bowl-2",
          "bowl-3",
          "bowl-4",
          "bat-4"
        ],
        substitutePlayerIds: ["wk-2", "bat-5"],
        captainPlayerId: "wk-1",
        viceCaptainPlayerId: "bat-1"
      },
      new Date("2026-04-01T13:00:00.000Z")
    );

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects bench players being assigned captaincy", () => {
    const result = validateRoster(
      contest,
      match,
      players,
      {
        starterPlayerIds: [
          "wk-1",
          "bat-1",
          "bat-2",
          "bat-3",
          "ar-1",
          "ar-2",
          "bowl-1",
          "bowl-2",
          "bowl-3",
          "bowl-4",
          "bat-4"
        ],
        substitutePlayerIds: ["wk-2", "bat-5"],
        captainPlayerId: "wk-2",
        viceCaptainPlayerId: "bat-1"
      },
      new Date("2026-04-01T13:00:00.000Z")
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Captain must be selected in the starting XI.");
  });
});

describe("automatic substitutions", () => {
  it("applies up to two role-for-role bench upgrades and keeps captaincy locked", () => {
    const roster: Roster = {
      id: "roster-1",
      contestId: contest.id,
      userId: "user-1",
      players: [
        { playerId: "wk-1", isStarter: true },
        { playerId: "bat-1", isStarter: true },
        { playerId: "bat-2", isStarter: true },
        { playerId: "bat-3", isStarter: true },
        { playerId: "bat-4", isStarter: true },
        { playerId: "ar-1", isStarter: true },
        { playerId: "ar-2", isStarter: true },
        { playerId: "bowl-1", isStarter: true },
        { playerId: "bowl-2", isStarter: true },
        { playerId: "bowl-3", isStarter: true },
        { playerId: "bowl-4", isStarter: true },
        { playerId: "wk-2", isStarter: false },
        { playerId: "bat-5", isStarter: false }
      ],
      captainPlayerId: "wk-1",
      viceCaptainPlayerId: "bat-1",
      submittedAt: "2026-04-01T13:00:00.000Z",
      locked: false
    };

    const events: FantasyScoreEvent[] = [
      { id: "1", matchId: match.id, playerId: "wk-1", label: "Runs", points: 0 },
      { id: "2", matchId: match.id, playerId: "wk-2", label: "Runs", points: 60 },
      { id: "3", matchId: match.id, playerId: "bat-2", label: "Runs", points: 8 },
      { id: "4", matchId: match.id, playerId: "bat-3", label: "Runs", points: 22 },
      { id: "5", matchId: match.id, playerId: "bat-4", label: "Runs", points: 16 },
      { id: "6", matchId: match.id, playerId: "bat-5", label: "Runs", points: 58 },
      { id: "7", matchId: match.id, playerId: "bat-1", label: "Runs", points: 40 }
    ];

    const result = calculateRosterPoints(roster, players, events);
    const keeperEntry = result.breakdown.find((entry) => entry.playerId === "wk-1");
    const batterEntry = result.breakdown.find((entry) => entry.playerId === "bat-2");

    expect(keeperEntry?.autoSubstituted).not.toBe(true);
    expect(keeperEntry?.finalPoints).toBe(0);
    expect(batterEntry?.autoSubstituted).toBe(true);
    expect(batterEntry?.replacedPlayerId).toBe("bat-5");
    expect(batterEntry?.finalPoints).toBe(58);
  });

  it("replaces a non-playing starter with a same-role bench player who played even on equal points", () => {
    const roster: Roster = {
      id: "roster-2",
      contestId: contest.id,
      userId: "user-2",
      players: [
        { playerId: "wk-1", isStarter: true },
        { playerId: "bat-1", isStarter: true },
        { playerId: "bat-2", isStarter: true },
        { playerId: "bat-3", isStarter: true },
        { playerId: "bat-4", isStarter: true },
        { playerId: "ar-1", isStarter: true },
        { playerId: "ar-2", isStarter: true },
        { playerId: "bowl-1", isStarter: true },
        { playerId: "bowl-2", isStarter: true },
        { playerId: "bowl-3", isStarter: true },
        { playerId: "bowl-4", isStarter: true },
        { playerId: "wk-2", isStarter: false },
        { playerId: "bat-5", isStarter: false }
      ],
      captainPlayerId: "wk-1",
      viceCaptainPlayerId: "bat-1",
      submittedAt: "2026-04-01T13:00:00.000Z",
      locked: false
    };

    const statLines: PlayerMatchStatLine[] = [
      {
        id: "line-bat-5",
        matchId: match.id,
        playerId: "bat-5",
        runs: 0,
        balls: 2,
        fours: 0,
        sixes: 0,
        wickets: 0,
        maidens: 0,
        dotBalls: 0,
        catches: 0,
        stumpings: 0,
        runOuts: 0,
        runsConceded: 0,
        ballsBowled: 0,
        battingStrikeRate: 0,
        bowlingEconomy: undefined,
        didPlay: true,
        didBat: true,
        didBowl: false,
        didField: false,
        sourceUpdatedAt: "2026-04-01T17:30:00.000Z"
      }
    ];

    const result = calculateRosterPoints(roster, players, [], statLines);
    const batterEntry = result.breakdown.find((entry) => entry.playerId === "bat-2");

    expect(batterEntry?.autoSubstituted).toBe(true);
    expect(batterEntry?.replacedPlayerId).toBe("bat-5");
    expect(batterEntry?.finalPoints).toBe(0);
  });
});

describe("stat line event generation", () => {
  it("derives fantasy score events from persisted stat lines", () => {
    const statLines: PlayerMatchStatLine[] = [
      {
        id: "line-1",
        matchId: match.id,
        playerId: "ar-1",
        runs: 48,
        balls: 24,
        fours: 4,
        sixes: 2,
        wickets: 3,
        maidens: 1,
        dotBalls: 9,
        catches: 1,
        stumpings: 0,
        runOuts: 0,
        runsConceded: 22,
        ballsBowled: 24,
        battingStrikeRate: 200,
        bowlingEconomy: 5.5,
        didPlay: true,
        didBat: true,
        didBowl: true,
        didField: true,
        sourceUpdatedAt: "2026-04-01T17:30:00.000Z"
      }
    ];

    const events = createFantasyScoreEventsFromStatLines(statLines, "2026-04-01T17:30:00.000Z");
    const pointsByLabel = new Map(events.map((event) => [event.label, event.points]));

    expect(pointsByLabel.get("Batting Runs")).toBe(48);
    expect(pointsByLabel.get("Boundary Fours")).toBe(4);
    expect(pointsByLabel.get("Boundary Sixes")).toBe(4);
    expect(pointsByLabel.get("Wickets")).toBe(75);
    expect(pointsByLabel.get("Maidens")).toBe(12);
    expect(pointsByLabel.get("Dot Balls")).toBe(9);
    expect(pointsByLabel.get("Catches")).toBe(8);
    expect(pointsByLabel.get("Strike Rate")).toBe(6);
    expect(pointsByLabel.get("Economy")).toBe(4);
  });
});
