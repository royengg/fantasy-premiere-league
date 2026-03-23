import { describe, expect, it } from "vitest";

import type { CricketDataMatch, CricketDataScorecard, CricketDataSquad } from "@fantasy-cricket/types";

import {
  createPlayerMatchStatLinesFromScorecard,
  selectMatchesForSquadSync
} from "../apps/api/src/services/provider-sync-service";

function createMatch(
  id: string,
  startTime: string,
  homeTeamId: string,
  awayTeamId: string
): CricketDataMatch {
  return {
    id,
    name: `${homeTeamId} vs ${awayTeamId}`,
    short_name: `${homeTeamId.toUpperCase()} vs ${awayTeamId.toUpperCase()}`,
    series_id: "ipl-2026",
    series_name: "Indian Premier League 2026",
    format: "t20",
    status: "upcoming",
    start_time: startTime,
    venue: "Test Ground",
    home_team: {
      id: homeTeamId,
      name: homeTeamId.toUpperCase(),
      short_name: homeTeamId.toUpperCase()
    },
    away_team: {
      id: awayTeamId,
      name: awayTeamId.toUpperCase(),
      short_name: awayTeamId.toUpperCase()
    }
  };
}

describe("selectMatchesForSquadSync", () => {
  it("covers all IPL teams using the smallest set of upcoming matches", () => {
    const matches = [
      createMatch("m1", "2026-03-28T14:00:00.000Z", "rcb", "srh"),
      createMatch("m2", "2026-03-29T14:00:00.000Z", "kkr", "mi"),
      createMatch("m3", "2026-03-30T14:00:00.000Z", "csk", "rr"),
      createMatch("m4", "2026-03-31T14:00:00.000Z", "gt", "pbks"),
      createMatch("m5", "2026-04-01T14:00:00.000Z", "dc", "lsg"),
      createMatch("m6", "2026-04-02T14:00:00.000Z", "kkr", "srh")
    ];

    const selected = selectMatchesForSquadSync(
      matches,
      Date.parse("2026-03-23T00:00:00.000Z"),
      "cover-all-upcoming-teams",
      8
    );

    expect(selected.map((match) => match.id)).toEqual(["m1", "m2", "m3", "m4", "m5"]);
  });

  it("respects the configured squad request cap", () => {
    const matches = [
      createMatch("m1", "2026-03-28T14:00:00.000Z", "rcb", "srh"),
      createMatch("m2", "2026-03-29T14:00:00.000Z", "kkr", "mi"),
      createMatch("m3", "2026-03-30T14:00:00.000Z", "csk", "rr"),
      createMatch("m4", "2026-03-31T14:00:00.000Z", "gt", "pbks"),
      createMatch("m5", "2026-04-01T14:00:00.000Z", "dc", "lsg")
    ];

    const selected = selectMatchesForSquadSync(
      matches,
      Date.parse("2026-03-23T00:00:00.000Z"),
      "cover-all-upcoming-teams",
      3
    );

    expect(selected.map((match) => match.id)).toEqual(["m1", "m2", "m3"]);
  });
});

describe("createPlayerMatchStatLinesFromScorecard", () => {
  it("extracts batting, bowling, and fielding stat lines from a scorecard", () => {
    const squads: CricketDataSquad[] = [
      {
        team_id: "team-a",
        team_name: "Team A",
        players: [
          {
            id: "batter-1",
            name: "Batter One",
            team_id: "team-a",
            team_name: "Team A",
            role: "BAT"
          },
          {
            id: "batter-2",
            name: "Batter Two",
            team_id: "team-a",
            team_name: "Team A",
            role: "BAT"
          }
        ]
      },
      {
        team_id: "team-b",
        team_name: "Team B",
        players: [
          {
            id: "bowler-1",
            name: "Bowler One",
            team_id: "team-b",
            team_name: "Team B",
            role: "BOWL"
          },
          {
            id: "keeper-1",
            name: "Keeper One",
            team_id: "team-b",
            team_name: "Team B",
            role: "WK"
          },
          {
            id: "fielder-1",
            name: "Fielder One",
            team_id: "team-b",
            team_name: "Team B",
            role: "BAT"
          }
        ]
      }
    ];

    const scorecard: CricketDataScorecard = {
      match_id: "remote-match-1",
      innings: [
        {
          batting_team: "Team A",
          bowling_team: "Team B",
          total_runs: 81,
          total_wickets: 2,
          total_overs: 10,
          extras: 3,
          batting: [
            {
              player_id: "batter-1",
              player_name: "Batter One",
              runs: 42,
              balls: 26,
              fours: 4,
              sixes: 2,
              strike_rate: 161.53,
              out: true,
              dismissal: "c Fielder One b Bowler One",
              bowler: "Bowler One",
              fielder: "Fielder One"
            },
            {
              player_id: "batter-2",
              player_name: "Batter Two",
              runs: 10,
              balls: 12,
              fours: 1,
              sixes: 0,
              strike_rate: 83.33,
              out: true,
              dismissal: "st Keeper One b Bowler One",
              bowler: "Bowler One",
              fielder: "Keeper One"
            }
          ],
          bowling: [
            {
              player_id: "bowler-1",
              player_name: "Bowler One",
              overs: 4,
              maidens: 1,
              runs: 18,
              wickets: 2,
              economy: 4.5,
              dots: 14
            }
          ],
          fall_of_wickets: []
        }
      ]
    };

    const lines = createPlayerMatchStatLinesFromScorecard(
      "provider:match:remote-match-1",
      scorecard,
      squads,
      "2026-03-23T10:00:00.000Z"
    );
    const byPlayerId = new Map(lines.map((line) => [line.playerId, line]));

    expect(byPlayerId.get("provider:player:batter-1")).toMatchObject({
      runs: 42,
      balls: 26,
      fours: 4,
      sixes: 2,
      didBat: true,
      battingStrikeRate: 161.54
    });
    expect(byPlayerId.get("provider:player:bowler-1")).toMatchObject({
      wickets: 2,
      maidens: 1,
      dotBalls: 14,
      runsConceded: 18,
      ballsBowled: 24,
      bowlingEconomy: 4.5,
      didBowl: true
    });
    expect(byPlayerId.get("provider:player:fielder-1")).toMatchObject({
      catches: 1,
      didField: true
    });
    expect(byPlayerId.get("provider:player:keeper-1")).toMatchObject({
      stumpings: 1,
      didField: true
    });
  });
});
