import { defaultRosterRules, normalizeIplTeam } from "@fantasy-cricket/domain";
import { createFantasyScoreEventsFromStatLines } from "@fantasy-cricket/scoring";
import type {
  Contest,
  CricketDataMatch,
  CricketDataPlayer,
  CricketDataScorecard,
  CricketDataSquad,
  FantasyScoreEvent,
  Match,
  Player,
  PlayerMatchStatLine,
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
const STAT_LINE_PREFIX = `${PROVIDER_PREFIX}:statline:`;
const TEAM_PREFIX = `${PROVIDER_PREFIX}:team:`;
const FIXTURE_SYNC_WINDOW_DAYS = 30;
const SQUAD_LOOKAHEAD_HOURS = 72;
const RECENT_COMPLETED_DAYS = 2;
const RECENT_SCORECARD_LOOKBACK_HOURS = 48;

export interface ProviderSyncGateway {
  getIPLMatches: (season?: number) => Promise<CricketDataMatch[]>;
  getMatchSquad: (matchId: string) => Promise<CricketDataSquad[]>;
  getScorecard: (matchId: string) => Promise<CricketDataScorecard>;
}

export interface ProviderSyncSnapshot {
  contests: Contest[];
  matches: Match[];
  players: Player[];
  statLines: PlayerMatchStatLine[];
  questions: PredictionQuestion[];
  scoreEvents: FantasyScoreEvent[];
  syncedAt: string;
  teams: Team[];
}

export interface ProviderSyncResult {
  contests: number;
  matches: number;
  players: number;
  statLines: number;
  questions: number;
  scoreEvents: number;
  status: "ready";
  syncedAt: string;
  teams: number;
}

export interface ProviderSyncBuildOptions {
  maxProviderRequests?: number;
  maxSquadRequests?: number;
  squadFetchMode?: "window" | "cover-all-upcoming-teams";
}

function providerId(prefix: string, remoteId: string) {
  return `${prefix}${remoteId}`;
}

function inferNationality(player: CricketDataPlayer): Player["nationality"] {
  const country = player.country?.trim().toLowerCase();
  return country === "india" ? "indian-capped" : "overseas";
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

function compareSyncPriority(left: CricketDataMatch, right: CricketDataMatch) {
  const statusPriority = (match: CricketDataMatch) => {
    switch (match.status) {
      case "live":
        return 0;
      case "upcoming":
        return 1;
      case "completed":
        return 2;
      default:
        return 3;
    }
  };

  const leftPriority = statusPriority(left);
  const rightPriority = statusPriority(right);
  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }

  const leftStartsAt = new Date(left.start_time).getTime();
  const rightStartsAt = new Date(right.start_time).getTime();
  if (left.status === "completed" && right.status === "completed") {
    return rightStartsAt - leftStartsAt;
  }

  return leftStartsAt - rightStartsAt;
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
    rosterRules: defaultRosterRules,
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

function normalizePlayerNameKey(name: string) {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitFielderNames(value: string) {
  return value
    .replace(/\band\b/gi, ",")
    .replace(/[\/&]/g, ",")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function oversToBalls(overs: number) {
  const wholeOvers = Math.trunc(overs);
  const partialBalls = Math.round((overs - wholeOvers) * 10);
  return wholeOvers * 6 + partialBalls;
}

function ensurePlayerIdEntry(
  index: Map<string, Set<string>>,
  name: string | undefined,
  playerId: string | undefined
) {
  if (!name || !playerId) {
    return;
  }

  const key = normalizePlayerNameKey(name);
  if (!key) {
    return;
  }

  const current = index.get(key) ?? new Set<string>();
  current.add(playerId);
  index.set(key, current);
}

function resolveNamedPlayerIds(index: Map<string, Set<string>>, rawName?: string) {
  if (!rawName) {
    return [] as string[];
  }

  const resolvedIds = new Set<string>();
  for (const candidate of splitFielderNames(rawName)) {
    const ids = index.get(normalizePlayerNameKey(candidate));
    if (!ids) {
      continue;
    }

    for (const id of ids) {
      resolvedIds.add(id);
    }
  }

  return [...resolvedIds];
}

function createEmptyStatLine(matchId: string, playerId: string): PlayerMatchStatLine {
  return {
    id: providerId(STAT_LINE_PREFIX, `${matchId}:${playerId}`),
    matchId,
    playerId,
    runs: 0,
    balls: 0,
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
    battingStrikeRate: undefined,
    bowlingEconomy: undefined,
    didPlay: false,
    didBat: false,
    didBowl: false,
    didField: false,
    sourceUpdatedAt: new Date().toISOString()
  };
}

function getStatLine(
  lines: Map<string, PlayerMatchStatLine>,
  matchId: string,
  playerId: string
) {
  const current = lines.get(playerId);
  if (current) {
    return current;
  }

  const next = createEmptyStatLine(matchId, playerId);
  lines.set(playerId, next);
  return next;
}

function buildMatchPlayerNameIndex(
  squads: CricketDataSquad[],
  scorecard: CricketDataScorecard
) {
  const index = new Map<string, Set<string>>();

  for (const squad of squads) {
    for (const player of squad.players) {
      ensurePlayerIdEntry(index, player.name, providerId(PLAYER_PREFIX, player.id));
      ensurePlayerIdEntry(index, player.short_name, providerId(PLAYER_PREFIX, player.id));
    }
  }

  for (const innings of scorecard.innings) {
    for (const batting of innings.batting) {
      ensurePlayerIdEntry(index, batting.player_name, providerId(PLAYER_PREFIX, batting.player_id));
    }

    for (const bowling of innings.bowling) {
      ensurePlayerIdEntry(index, bowling.player_name, providerId(PLAYER_PREFIX, bowling.player_id));
    }
  }

  return index;
}

function awardFieldingDismissal(
  lines: Map<string, PlayerMatchStatLine>,
  matchId: string,
  dismissal: string,
  fielderIds: string[],
  bowlerIds: string[]
) {
  const normalizedDismissal = dismissal.toLowerCase();
  const isStumping =
    normalizedDismissal.includes("stumped") || /^st[\s.]/.test(normalizedDismissal);
  const isRunOut = normalizedDismissal.includes("run out");
  const isCaughtAndBowled =
    normalizedDismissal.includes("caught and bowled") ||
    normalizedDismissal.includes("c&b") ||
    normalizedDismissal.includes("c and b");
  const isCaught =
    normalizedDismissal.includes("caught") || /^c[\s.]/.test(normalizedDismissal);

  if (isStumping) {
    const keeperId = fielderIds[0];
    if (!keeperId) {
      return;
    }

    const line = getStatLine(lines, matchId, keeperId);
    line.stumpings += 1;
    line.didField = true;
    line.didPlay = true;
    return;
  }

  if (isRunOut) {
    const fielderId = fielderIds[0];
    if (!fielderId) {
      return;
    }

    const line = getStatLine(lines, matchId, fielderId);
    line.runOuts += 1;
    line.didField = true;
    line.didPlay = true;
    return;
  }

  if (isCaughtAndBowled) {
    const fielderId = fielderIds[0] ?? bowlerIds[0];
    if (!fielderId) {
      return;
    }

    const line = getStatLine(lines, matchId, fielderId);
    line.catches += 1;
    line.didField = true;
    line.didPlay = true;
    return;
  }

  if (isCaught) {
    const fielderId = fielderIds[0];
    if (!fielderId) {
      return;
    }

    const line = getStatLine(lines, matchId, fielderId);
    line.catches += 1;
    line.didField = true;
    line.didPlay = true;
  }
}

export function createPlayerMatchStatLinesFromScorecard(
  matchId: string,
  scorecard: CricketDataScorecard,
  squads: CricketDataSquad[] = [],
  sourceUpdatedAt = new Date().toISOString()
): PlayerMatchStatLine[] {
  const lines = new Map<string, PlayerMatchStatLine>();
  const playerNameIndex = buildMatchPlayerNameIndex(squads, scorecard);

  for (const innings of scorecard.innings) {
    for (const batting of innings.batting) {
      const playerId = providerId(PLAYER_PREFIX, batting.player_id);
      const line = getStatLine(lines, matchId, playerId);
      line.runs += batting.runs;
      line.balls += batting.balls;
      line.fours += batting.fours;
      line.sixes += batting.sixes;
      line.didPlay = true;
      line.didBat = true;

      if (batting.out && batting.dismissal) {
        awardFieldingDismissal(
          lines,
          matchId,
          batting.dismissal,
          resolveNamedPlayerIds(playerNameIndex, batting.fielder),
          resolveNamedPlayerIds(playerNameIndex, batting.bowler)
        );
      }
    }

    for (const bowling of innings.bowling) {
      const playerId = providerId(PLAYER_PREFIX, bowling.player_id);
      const line = getStatLine(lines, matchId, playerId);
      line.wickets += bowling.wickets;
      line.maidens += bowling.maidens;
      line.dotBalls += bowling.dots;
      line.runsConceded += bowling.runs;
      line.ballsBowled += oversToBalls(bowling.overs);
      line.didPlay = true;
      line.didBowl = true;
    }
  }

  return [...lines.values()].map((line) => ({
    ...line,
    battingStrikeRate: line.balls > 0 ? Number(((line.runs / line.balls) * 100).toFixed(2)) : undefined,
    bowlingEconomy:
      line.ballsBowled > 0
        ? Number(((line.runsConceded * 6) / line.ballsBowled).toFixed(2))
        : undefined,
    sourceUpdatedAt
  }));
}

function providerScoreEventsFromStatLines(
  statLines: PlayerMatchStatLine[],
  createdAt: string
): FantasyScoreEvent[] {
  return createFantasyScoreEventsFromStatLines(statLines, createdAt).map((event) => ({
    ...event,
    id: providerId(
      SCORE_EVENT_PREFIX,
      `${event.matchId}:${event.playerId}:${event.label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")}`
    )
  }));
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

export function selectMatchesForSquadSync(
  providerMatches: CricketDataMatch[],
  now = Date.now(),
  mode: NonNullable<ProviderSyncBuildOptions["squadFetchMode"]> = "window",
  maxSquadRequests = Number.POSITIVE_INFINITY
) {
  if (maxSquadRequests <= 0) {
    return [] as CricketDataMatch[];
  }

  if (mode === "cover-all-upcoming-teams") {
    const candidates = providerMatches
      .filter((match) => match.status === "live" || match.status === "upcoming")
      .sort(compareSyncPriority);
    const expectedTeamIds = new Set(
      candidates.flatMap((match) => [match.home_team.id, match.away_team.id])
    );
    const coveredTeamIds = new Set<string>();
    const selected: CricketDataMatch[] = [];

    for (const match of candidates) {
      if (selected.length >= maxSquadRequests) {
        break;
      }

      const teamIds = [match.home_team.id, match.away_team.id];
      if (teamIds.every((teamId) => coveredTeamIds.has(teamId))) {
        continue;
      }

      selected.push(match);
      for (const teamId of teamIds) {
        coveredTeamIds.add(teamId);
      }

      if (coveredTeamIds.size >= expectedTeamIds.size) {
        break;
      }
    }

    return selected;
  }

  return [...providerMatches]
    .sort(compareSyncPriority)
    .filter((match) => shouldFetchSquads(match, now))
    .slice(0, maxSquadRequests);
}

export async function buildProviderSyncSnapshot(
  gateway: ProviderSyncGateway = cricketDataService,
  season = new Date().getFullYear(),
  options: ProviderSyncBuildOptions = {}
): Promise<ProviderSyncSnapshot> {
  const now = Date.now();
  const syncedAt = new Date().toISOString();
  const maxProviderRequests = Math.max(options.maxProviderRequests ?? Number.POSITIVE_INFINITY, 0);
  const providerFollowUpBudget = Number.isFinite(maxProviderRequests)
    ? Math.max(maxProviderRequests - 2, 0)
    : Number.POSITIVE_INFINITY;
  const maxSquadRequests = Number.isFinite(options.maxSquadRequests ?? Number.POSITIVE_INFINITY)
    ? Math.min(
        Math.max(options.maxSquadRequests ?? Number.POSITIVE_INFINITY, 0),
        providerFollowUpBudget
      )
    : providerFollowUpBudget;
  let remainingFollowUpRequests = Number.isFinite(maxProviderRequests)
    ? Math.max(maxProviderRequests - 2, 0)
    : Number.POSITIVE_INFINITY;
  const providerMatches = (await gateway.getIPLMatches(season))
    .filter((match) => shouldIncludeMatch(match, now))
    .sort(
      (left, right) =>
        new Date(left.start_time).getTime() - new Date(right.start_time).getTime()
    );
  const prioritizedMatches = [...providerMatches].sort(compareSyncPriority);

  const squadMap = new Map<string, CricketDataSquad[]>();
  for (const match of selectMatchesForSquadSync(
    providerMatches,
    now,
    options.squadFetchMode ?? "window",
    maxSquadRequests
  )) {
    if (remainingFollowUpRequests <= 0) {
      break;
    }

    const squads = await gateway.getMatchSquad(match.id).catch(() => [] as CricketDataSquad[]);
    squadMap.set(match.id, squads);
    if (Number.isFinite(remainingFollowUpRequests)) {
      remainingFollowUpRequests -= 1;
    }
  }

  const teamMap = new Map<string, Team>();
  const playerMap = new Map<string, Player>();
  const matches: Match[] = [];
  const contests: Contest[] = [];
  const questions: PredictionQuestion[] = [];
  const statLines: PlayerMatchStatLine[] = [];
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

    if (remainingFollowUpRequests <= 0) {
      continue;
    }

    if (Number.isFinite(remainingFollowUpRequests)) {
      remainingFollowUpRequests -= 1;
    }
    const scorecard = await loadScorecard(gateway, sourceMatch.id);
    if (!scorecard) {
      continue;
    }

    const matchStatLines = createPlayerMatchStatLinesFromScorecard(
      match.id,
      scorecard,
      squads,
      syncedAt
    ).filter((line) => playerMap.has(line.playerId));

    statLines.push(...matchStatLines);
    scoreEvents.push(...providerScoreEventsFromStatLines(matchStatLines, syncedAt));
  }

  return {
    contests,
    matches,
    players: [...playerMap.values()],
    statLines,
    questions,
    scoreEvents,
    syncedAt,
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
    statLines: snapshot.statLines.length,
    scoreEvents: snapshot.scoreEvents.length
  };
}
