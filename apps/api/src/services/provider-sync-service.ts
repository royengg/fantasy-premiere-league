import { defaultRosterRules, normalizeIplTeam } from "@fantasy-cricket/domain";
import type {
  Contest,
  CricketDataMatch,
  CricketDataPlayer,
  CricketDataScorecard,
  CricketDataSquad,
  FantasyScoreEvent,
  Match,
  Player,
  PredictionQuestion,
  Team
} from "@fantasy-cricket/types";

import { cricketDataService } from "./cricket-data-service.js";

const PROVIDER_PREFIX = "provider";
const CONTEST_PREFIX = `${PROVIDER_PREFIX}:contest:`;
const MATCH_PREFIX = `${PROVIDER_PREFIX}:match:`;
const PLAYER_PREFIX = `${PROVIDER_PREFIX}:player:`;
const QUESTION_PREFIX = `${PROVIDER_PREFIX}:question:`;
const SCORE_EVENT_PREFIX = `${PROVIDER_PREFIX}:score:`;
const TEAM_PREFIX = `${PROVIDER_PREFIX}:team:`;
const FIXTURE_SYNC_WINDOW_DAYS = 30;
const SQUAD_LOOKAHEAD_HOURS = 72;
const RECENT_COMPLETED_DAYS = 2;
const RECENT_SCORECARD_LOOKBACK_HOURS = 48;
const DEFAULT_SALARY_CAP = 100;

export interface ProviderSyncGateway {
  getIPLMatches: (season?: number) => Promise<CricketDataMatch[]>;
  getMatchSquad: (matchId: string) => Promise<CricketDataSquad[]>;
  getScorecard: (matchId: string) => Promise<CricketDataScorecard>;
}

export interface ProviderSyncSnapshot {
  contests: Contest[];
  matches: Match[];
  players: Player[];
  questions: PredictionQuestion[];
  scoreEvents: FantasyScoreEvent[];
  syncedAt: string;
  teams: Team[];
}

export interface ProviderSyncResult {
  contests: number;
  matches: number;
  players: number;
  questions: number;
  scoreEvents: number;
  status: "ready";
  syncedAt: string;
  teams: number;
}

function providerId(prefix: string, remoteId: string) {
  return `${prefix}${remoteId}`;
}

function inferNationality(player: CricketDataPlayer): Player["nationality"] {
  const country = player.country?.trim().toLowerCase();
  return country === "india" ? "indian-capped" : "overseas";
}

function inferCredits(player: CricketDataPlayer) {
  if (typeof player.credits === "number" && Number.isFinite(player.credits)) {
    return player.credits;
  }

  const selectionPercent = player.selection_percent ?? 0;
  return Math.min(10, Math.max(6.5, Number((7 + selectionPercent / 20).toFixed(1))));
}

function inferRating(player: CricketDataPlayer) {
  const selectionPercent = player.selection_percent ?? 0;
  return Math.min(96, Math.max(68, Math.round(68 + selectionPercent / 3)));
}

function matchState(status: CricketDataMatch["status"]): Match["state"] {
  switch (status) {
    case "live":
      return "live";
    case "completed":
    case "abandoned":
      return "completed";
    default:
      return "scheduled";
  }
}

function questionState(match: Match): PredictionQuestion["state"] {
  if (match.state === "completed") {
    return "settled";
  }

  if (match.state === "live" || Date.now() >= new Date(match.startsAt).getTime()) {
    return "locked";
  }

  return "open";
}

function shouldIncludeMatch(match: CricketDataMatch, now = Date.now()) {
  const startsAt = new Date(match.start_time).getTime();
  if (!Number.isFinite(startsAt)) {
    return false;
  }

  if (match.status === "live") {
    return true;
  }

  if (match.status === "upcoming") {
    return startsAt <= now + FIXTURE_SYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  }

  if (match.status === "completed") {
    return startsAt >= now - RECENT_COMPLETED_DAYS * 24 * 60 * 60 * 1000;
  }

  return false;
}

function shouldFetchSquads(match: CricketDataMatch, now = Date.now()) {
  const startsAt = new Date(match.start_time).getTime();
  if (!Number.isFinite(startsAt)) {
    return false;
  }

  if (match.status === "live") {
    return true;
  }

  if (match.status === "upcoming") {
    return startsAt <= now + SQUAD_LOOKAHEAD_HOURS * 60 * 60 * 1000;
  }

  if (match.status === "completed") {
    return startsAt >= now - RECENT_COMPLETED_DAYS * 24 * 60 * 60 * 1000;
  }

  return false;
}

function shouldFetchScorecard(match: CricketDataMatch, now = Date.now()) {
  const startsAt = new Date(match.start_time).getTime();
  if (!Number.isFinite(startsAt)) {
    return false;
  }

  if (match.status === "live") {
    return true;
  }

  if (match.status === "completed") {
    return startsAt >= now - RECENT_SCORECARD_LOOKBACK_HOURS * 60 * 60 * 1000;
  }

  return false;
}

function createContest(match: Match, source: CricketDataMatch): Contest {
  const homeTeam = normalizeIplTeam({
    id: providerId(TEAM_PREFIX, source.home_team.id),
    name: source.home_team.name,
    shortName: source.home_team.short_name,
    city: source.city || source.home_team.name
  });
  const awayTeam = normalizeIplTeam({
    id: providerId(TEAM_PREFIX, source.away_team.id),
    name: source.away_team.name,
    shortName: source.away_team.short_name,
    city: source.city || source.away_team.name
  });

  return {
    id: providerId(CONTEST_PREFIX, source.id),
    name: `${homeTeam.name} vs ${awayTeam.name}`,
    kind: "public",
    matchId: match.id,
    salaryCap: DEFAULT_SALARY_CAP,
    rosterRules: defaultRosterRules,
    iplRules: {
      maxPlayersPerTeam: 7,
      allowImpactPlayer: true,
      uncappedBonusPoints: 10
    },
    lockTime: match.startsAt,
    rewards: []
  };
}

function createWinnerQuestion(match: Match, source: CricketDataMatch): PredictionQuestion {
  const resolvesAt =
    source.end_time ??
    new Date(new Date(source.start_time).getTime() + 4 * 60 * 60 * 1000).toISOString();
  const homeTeam = normalizeIplTeam({
    id: providerId(TEAM_PREFIX, source.home_team.id),
    name: source.home_team.name,
    shortName: source.home_team.short_name,
    city: source.city || source.home_team.name
  });
  const awayTeam = normalizeIplTeam({
    id: providerId(TEAM_PREFIX, source.away_team.id),
    name: source.away_team.name,
    shortName: source.away_team.short_name,
    city: source.city || source.away_team.name
  });
  const matchupName = `${homeTeam.name} vs ${awayTeam.name}`;

  return {
    id: providerId(QUESTION_PREFIX, `${source.id}:winner`),
    matchId: match.id,
    prompt: `Who wins ${matchupName}?`,
    category: "winner",
    options: [
      {
        id: providerId(QUESTION_PREFIX, `${source.id}:winner:${source.home_team.id}`),
        label: homeTeam.name,
        value: providerId(TEAM_PREFIX, source.home_team.id)
      },
      {
        id: providerId(QUESTION_PREFIX, `${source.id}:winner:${source.away_team.id}`),
        label: awayTeam.name,
        value: providerId(TEAM_PREFIX, source.away_team.id)
      }
    ],
    locksAt: match.startsAt,
    resolvesAt,
    state: questionState(match),
    xpReward: 25
  };
}

function scoreEventsFromScorecard(matchId: string, scorecard: CricketDataScorecard): FantasyScoreEvent[] {
  const battingRuns = new Map<string, number>();
  const bowlingWickets = new Map<string, number>();

  for (const innings of scorecard.innings) {
    for (const batting of innings.batting) {
      battingRuns.set(
        batting.player_id,
        (battingRuns.get(batting.player_id) ?? 0) + batting.runs
      );
    }

    for (const bowling of innings.bowling) {
      bowlingWickets.set(
        bowling.player_id,
        (bowlingWickets.get(bowling.player_id) ?? 0) + bowling.wickets
      );
    }
  }

  const events: FantasyScoreEvent[] = [];

  for (const [playerId, runs] of battingRuns) {
    if (runs <= 0) {
      continue;
    }

    events.push({
      id: providerId(SCORE_EVENT_PREFIX, `${matchId}:bat:${playerId}`),
      matchId,
      playerId: providerId(PLAYER_PREFIX, playerId),
      label: "Batting Runs",
      points: runs,
      createdAt: new Date().toISOString()
    });
  }

  for (const [playerId, wickets] of bowlingWickets) {
    if (wickets <= 0) {
      continue;
    }

    events.push({
      id: providerId(SCORE_EVENT_PREFIX, `${matchId}:bowl:${playerId}`),
      matchId,
      playerId: providerId(PLAYER_PREFIX, playerId),
      label: "Wickets",
      points: wickets * 25,
      createdAt: new Date().toISOString()
    });
  }

  return events;
}

async function loadScorecard(gateway: ProviderSyncGateway, matchId: string) {
  try {
    return await gateway.getScorecard(matchId);
  } catch {
    return null;
  }
}

export function isProviderManagedId(id: string) {
  return id.startsWith(`${PROVIDER_PREFIX}:`);
}

export async function buildProviderSyncSnapshot(
  gateway: ProviderSyncGateway = cricketDataService,
  season = new Date().getFullYear()
): Promise<ProviderSyncSnapshot> {
  const now = Date.now();
  const providerMatches = (await gateway.getIPLMatches(season))
    .filter((match) => shouldIncludeMatch(match, now))
    .sort(
      (left, right) =>
        new Date(left.start_time).getTime() - new Date(right.start_time).getTime()
    );

  const squadMap = new Map<string, CricketDataSquad[]>();
  for (const match of providerMatches) {
    if (!shouldFetchSquads(match, now)) {
      continue;
    }

    const squads = await gateway.getMatchSquad(match.id).catch(() => [] as CricketDataSquad[]);
    squadMap.set(match.id, squads);
  }

  const teamMap = new Map<string, Team>();
  const playerMap = new Map<string, Player>();
  const matches: Match[] = [];
  const contests: Contest[] = [];
  const questions: PredictionQuestion[] = [];
  const scoreEvents: FantasyScoreEvent[] = [];

  for (const sourceMatch of providerMatches) {
    const homeTeamId = providerId(TEAM_PREFIX, sourceMatch.home_team.id);
    const awayTeamId = providerId(TEAM_PREFIX, sourceMatch.away_team.id);
    const homeTeam = normalizeIplTeam({
      id: homeTeamId,
      name: sourceMatch.home_team.name,
      shortName: sourceMatch.home_team.short_name,
      city: sourceMatch.city || sourceMatch.home_team.name
    });
    const awayTeam = normalizeIplTeam({
      id: awayTeamId,
      name: sourceMatch.away_team.name,
      shortName: sourceMatch.away_team.short_name,
      city: sourceMatch.city || sourceMatch.away_team.name
    });

    teamMap.set(homeTeamId, homeTeam);
    teamMap.set(awayTeamId, awayTeam);

    const match: Match = {
      id: providerId(MATCH_PREFIX, sourceMatch.id),
      homeTeamId,
      awayTeamId,
      startsAt: sourceMatch.start_time,
      venue: sourceMatch.venue,
      state: matchState(sourceMatch.status)
    };

    matches.push(match);

    const squads = squadMap.get(sourceMatch.id) ?? [];
    for (const squad of squads) {
      const teamId = providerId(TEAM_PREFIX, squad.team_id);
      const existingTeam = teamMap.get(teamId);
      if (!existingTeam) {
        teamMap.set(teamId, normalizeIplTeam({
          id: teamId,
          name: squad.team_name,
          shortName: squad.team_name.slice(0, 3).toUpperCase(),
          city: squad.team_name
        }));
      }

      for (const sourcePlayer of squad.players) {
        const playerId = providerId(PLAYER_PREFIX, sourcePlayer.id);
        playerMap.set(playerId, {
          id: playerId,
          name: sourcePlayer.name,
          teamId,
          role: sourcePlayer.role,
          credits: inferCredits(sourcePlayer),
          rating: inferRating(sourcePlayer),
          nationality: inferNationality(sourcePlayer),
          selectionPercent: sourcePlayer.selection_percent ?? 0
        });
      }
    }

    const matchPlayers = [...playerMap.values()].filter(
      (player) => player.teamId === homeTeamId || player.teamId === awayTeamId
    );

    if (matchPlayers.length > 0) {
      contests.push(createContest(match, sourceMatch));
    }

    questions.push(createWinnerQuestion(match, sourceMatch));

    if (!shouldFetchScorecard(sourceMatch, now)) {
      continue;
    }

    const scorecard = await loadScorecard(gateway, sourceMatch.id);
    if (!scorecard) {
      continue;
    }

    scoreEvents.push(
      ...scoreEventsFromScorecard(match.id, scorecard).filter((event) =>
        playerMap.has(event.playerId)
      )
    );
  }

  return {
    contests,
    matches,
    players: [...playerMap.values()],
    questions,
    scoreEvents,
    syncedAt: new Date().toISOString(),
    teams: [...teamMap.values()]
  };
}

export function providerSyncResult(snapshot: ProviderSyncSnapshot): ProviderSyncResult {
  return {
    status: "ready",
    syncedAt: snapshot.syncedAt,
    teams: snapshot.teams.length,
    players: snapshot.players.length,
    matches: snapshot.matches.length,
    contests: snapshot.contests.length,
    questions: snapshot.questions.length,
    scoreEvents: snapshot.scoreEvents.length
  };
}
