import { getIplTeamBranding, normalizeIplTeam } from "@fantasy-cricket/domain";
import type {
  CricketDataAPIResponse,
  CricketDataMatch,
  CricketDataPlayer,
  CricketDataSquad,
  CricketDataScorecard,
} from "@fantasy-cricket/types";

import { loadEnv } from "../lib/env";

const env = loadEnv();
const IST_TIME_ZONE = "Asia/Kolkata";

function nextIstMidnightIso(now = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = formatter.formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value ?? now.getUTCFullYear());
  const month = Number(parts.find((part) => part.type === "month")?.value ?? now.getUTCMonth() + 1);
  const day = Number(parts.find((part) => part.type === "day")?.value ?? now.getUTCDate());

  return new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0)).toISOString();
}

export class CricketDataRateLimitError extends Error {
  constructor(
    message: string,
    readonly retryAt: string
  ) {
    super(message);
    this.name = "CricketDataRateLimitError";
  }
}

interface CricApiSeriesSummary {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  odi: number;
  t20: number;
  test: number;
  squads: number;
  matches: number;
}

interface CricApiSeriesInfoMatch {
  id: string;
  name: string;
  matchType: string;
  status: string;
  venue: string;
  date?: string;
  dateTimeGMT?: string;
  teams?: string[];
  teamInfo?: Array<{
    name: string;
    shortname?: string;
  }>;
  matchStarted?: boolean;
  matchEnded?: boolean;
}

interface CricApiSeriesInfoResponse {
  info?: {
    id?: string;
    name?: string;
  };
  matchList?: CricApiSeriesInfoMatch[];
}

interface CricApiSquadPlayer {
  id: string;
  name: string;
  role?: string;
  battingStyle?: string;
  bowlingStyle?: string;
  country?: string;
  playerImg?: string;
}

interface CricApiSquadTeam {
  teamName: string;
  shortname?: string;
  players?: CricApiSquadPlayer[];
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class CricketDataService {
  private cache = new Map<string, CacheEntry<unknown>>();
  private blockedUntil: string | null = null;

  private static IPL_SERIES_SEARCH = "Indian Premier League";

  private async fetchWithCache<T>(
    endpoint: string,
    ttl: number
  ): Promise<T> {
    const cacheKey = endpoint;
    const cached = this.cache.get(cacheKey);
    
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data as T;
    }

    if (this.blockedUntil && Date.now() < new Date(this.blockedUntil).getTime()) {
      throw new CricketDataRateLimitError(
        "Cricket Data API is rate-limited for today.",
        this.blockedUntil
      );
    }

    if (!env.CRICKET_DATA_API_KEY) {
      throw new Error("CRICKET_DATA_API_KEY is not configured.");
    }

    const url = new URL(`${env.CRICKET_DATA_BASE_URL}${endpoint}`);
    url.searchParams.set("apikey", env.CRICKET_DATA_API_KEY);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      if (response.status === 429) {
        this.blockedUntil = nextIstMidnightIso();
        throw new CricketDataRateLimitError(
          "Cricket Data API rate limit exceeded.",
          this.blockedUntil
        );
      }

      throw new Error(`Cricket Data API error: ${response.status} ${response.statusText}`);
    }
    
    const json = await response.json() as CricketDataAPIResponse<T>;

    if (json.status !== "success") {
      const message = json.reason || json.message || "API request failed";
      if (/hits today exceeded hits limit|rate limit|blocked/i.test(message)) {
        this.blockedUntil = nextIstMidnightIso();
        throw new CricketDataRateLimitError(message, this.blockedUntil);
      }

      throw new Error(message);
    }

    if (json.data === undefined) {
      throw new Error("API response was missing data.");
    }

    this.cache.set(cacheKey, {
      data: json.data,
      expiresAt: Date.now() + ttl * 1000,
    });

    return json.data;
  }

  private async searchSeries(query: string): Promise<CricApiSeriesSummary[]> {
    const params = new URLSearchParams();
    params.set("offset", "0");
    params.set("search", query);

    const series = await this.fetchWithCache<CricApiSeriesSummary[] | null | undefined>(
      `/series?${params.toString()}`,
      env.CRICKET_DATA_CACHE_TTL
    );

    return Array.isArray(series) ? series : [];
  }

  private async getSeriesInfo(seriesId: string): Promise<CricApiSeriesInfoResponse> {
    return this.fetchWithCache<CricApiSeriesInfoResponse>(
      `/series_info?id=${seriesId}`,
      env.CRICKET_DATA_CACHE_TTL
    );
  }

  private findIplSeries(series: CricApiSeriesSummary[], season: number) {
    const exactYearMatch = series.find((entry) => entry.name.includes(String(season)));
    if (exactYearMatch) {
      return exactYearMatch;
    }

    return series[0];
  }

  private normalizeStatus(match: CricApiSeriesInfoMatch): CricketDataMatch["status"] {
    const status = match.status.toLowerCase();

    if (match.matchEnded || status.includes("won") || status.includes("abandoned")) {
      return status.includes("abandoned") ? "abandoned" : "completed";
    }

    if (match.matchStarted) {
      return "live";
    }

    return "upcoming";
  }

  private normalizeStartTime(match: CricApiSeriesInfoMatch) {
    if (match.dateTimeGMT) {
      return match.dateTimeGMT.endsWith("Z") ? match.dateTimeGMT : `${match.dateTimeGMT}Z`;
    }

    if (match.date) {
      return `${match.date}T00:00:00Z`;
    }

    return new Date().toISOString();
  }

  private normalizeVenueCity(venue: string) {
    const parts = venue.split(",");
    return parts.at(-1)?.trim() || venue;
  }

  private normalizeTeam(match: CricApiSeriesInfoMatch, index: number) {
    const rawName = match.teamInfo?.[index]?.name ?? match.teams?.[index] ?? `Team ${index + 1}`;
    const rawShortName =
      match.teamInfo?.[index]?.shortname ??
      getIplTeamBranding(rawName)?.shortName ??
      rawName
        .split(" ")
        .map((word) => word[0] ?? "")
        .join("")
        .slice(0, 4)
        .toUpperCase();
    const normalized = normalizeIplTeam({
      id: `provider:team:${rawShortName.toLowerCase()}`,
      name: rawName,
      shortName: rawShortName,
      city: this.normalizeVenueCity(rawName)
    });

    return {
      id: normalized.shortName.toLowerCase(),
      name: normalized.name,
      short_name: normalized.shortName
    };
  }

  private normalizePlayerRole(role?: string): CricketDataPlayer["role"] {
    const normalized = role?.toLowerCase() ?? "";

    if (normalized.includes("wk")) {
      return "WK";
    }

    if (normalized.includes("allrounder")) {
      return "AR";
    }

    if (normalized.includes("bowl")) {
      return "BOWL";
    }

    return "BAT";
  }

  private normalizeSquadTeamId(shortName?: string, teamName?: string) {
    const branding = getIplTeamBranding(shortName ?? "") ?? getIplTeamBranding(teamName ?? "");
    return branding?.shortName.toLowerCase() ?? (shortName ?? teamName ?? "team").toLowerCase();
  }

  private normalizeSeriesMatch(
    series: CricApiSeriesSummary,
    match: CricApiSeriesInfoMatch
  ): CricketDataMatch {
    const homeTeam = this.normalizeTeam(match, 0);
    const awayTeam = this.normalizeTeam(match, 1);
    const startTime = this.normalizeStartTime(match);
    const venue = match.venue?.trim() || "TBA";

    return {
      id: match.id,
      name: match.name,
      short_name: `${homeTeam.short_name} vs ${awayTeam.short_name}`,
      series_id: series.id,
      series_name: series.name,
      format: match.matchType?.toLowerCase() === "odi"
        ? "odi"
        : match.matchType?.toLowerCase() === "test"
          ? "test"
          : "t20",
      status: this.normalizeStatus(match),
      start_time: startTime,
      venue,
      city: this.normalizeVenueCity(venue),
      home_team: homeTeam,
      away_team: awayTeam
    };
  }

  async getMatchSquad(matchId: string): Promise<CricketDataSquad[]> {
    const squads = await this.fetchWithCache<CricApiSquadTeam[]>(
      `/match_squad?id=${matchId}&offset=0`,
      env.CRICKET_DATA_CACHE_TTL
    );

    return squads.map((team) => {
      const normalizedTeam = normalizeIplTeam({
        id: this.normalizeSquadTeamId(team.shortname, team.teamName),
        name: team.teamName,
        shortName: team.shortname ?? team.teamName.slice(0, 3).toUpperCase(),
        city: team.teamName
      });

      return {
        team_id: normalizedTeam.shortName.toLowerCase(),
        team_name: normalizedTeam.name,
        players: (team.players ?? []).map((player) => ({
          id: player.id,
          name: player.name,
          team_id: normalizedTeam.shortName.toLowerCase(),
          team_name: normalizedTeam.name,
          role: this.normalizePlayerRole(player.role),
          batting_style:
            player.battingStyle?.toLowerCase().includes("left") ? "LHB" : "RHB",
          bowling_style: player.bowlingStyle,
          image_url: player.playerImg,
          country: player.country
        }))
      };
    });
  }

  async getScorecard(matchId: string): Promise<CricketDataScorecard> {
    return this.fetchWithCache<CricketDataScorecard>(
      `/matches/${matchId}/scorecard`,
      env.CRICKET_DATA_CACHE_TTL
    );
  }

  async getIPLMatches(season?: number): Promise<CricketDataMatch[]> {
    const year = season ?? new Date().getFullYear();
    const series = await this.searchSeries(CricketDataService.IPL_SERIES_SEARCH);
    const iplSeries = this.findIplSeries(series, year);

    if (!iplSeries) {
      throw new Error(`IPL series for ${year} was not found.`);
    }

    const details = await this.getSeriesInfo(iplSeries.id);
    const matches = details.matchList ?? [];
    if (matches.length === 0) {
      throw new Error(`No IPL matches were returned for ${iplSeries.name}.`);
    }

    return matches
      .map((match) => this.normalizeSeriesMatch(iplSeries, match))
      .sort(
        (left, right) =>
          new Date(left.start_time).getTime() - new Date(right.start_time).getTime()
      );
  }

  clearCache() {
    this.cache.clear();
  }
}

export const cricketDataService = new CricketDataService();
