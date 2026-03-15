import { loadEnv } from "../lib/env";
import type {
  CricketDataAPIResponse,
  CricketDataMatch,
  CricketDataSeries,
  CricketDataPlayer,
  CricketDataSquad,
  CricketDataLiveScore,
  CricketDataScorecard,
} from "@fantasy-cricket/types";

const env = loadEnv();

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class CricketDataService {
  private cache = new Map<string, CacheEntry<unknown>>();
  private hitsRemaining: number = Infinity;
  private hitsLimit: number = Infinity;

  private async fetchWithCache<T>(
    endpoint: string,
    ttl: number
  ): Promise<T> {
    const cacheKey = endpoint;
    const cached = this.cache.get(cacheKey);
    
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data as T;
    }

    if (!env.CRICKET_DATA_API_KEY) {
      throw new Error("CRICKET_DATA_API_KEY is not configured.");
    }

    const url = new URL(`${env.CRICKET_DATA_BASE_URL}${endpoint}`);
    url.searchParams.set("apikey", env.CRICKET_DATA_API_KEY);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Cricket Data API error: ${response.status} ${response.statusText}`);
    }
    
    const json = await response.json() as CricketDataAPIResponse<T>;
    
    if (json.status === "error") {
      throw new Error(json.message || "API request failed");
    }

    if (json.hits_remaining !== undefined) {
      this.hitsRemaining = json.hits_remaining;
      this.hitsLimit = json.hits_limit ?? this.hitsLimit;
    }

    this.cache.set(cacheKey, {
      data: json.data,
      expiresAt: Date.now() + ttl * 1000,
    });

    return json.data;
  }

  async getSeries(seriesId?: string): Promise<CricketDataSeries[]> {
    const endpoint = seriesId ? `/series/${seriesId}` : "/series";
    return this.fetchWithCache<CricketDataSeries[]>(endpoint, env.CRICKET_DATA_CACHE_TTL);
  }

  async getMatches(params?: {
    seriesId?: string;
    status?: "upcoming" | "live" | "completed";
    date?: string;
  }): Promise<CricketDataMatch[]> {
    const searchParams = new URLSearchParams();
    if (params?.seriesId) searchParams.set("series_id", params.seriesId);
    if (params?.status) searchParams.set("status", params.status);
    if (params?.date) searchParams.set("date", params.date);
    
    const queryString = searchParams.toString();
    const endpoint = queryString ? `/matches?${queryString}` : "/matches";
    
    return this.fetchWithCache<CricketDataMatch[]>(endpoint, env.CRICKET_DATA_CACHE_TTL);
  }

  async getMatch(matchId: string): Promise<CricketDataMatch> {
    return this.fetchWithCache<CricketDataMatch>(`/matches/${matchId}`, env.CRICKET_DATA_LIVE_CACHE_TTL);
  }

  async getLiveMatches(): Promise<CricketDataMatch[]> {
    return this.getMatches({ status: "live" });
  }

  async getUpcomingMatches(days: number = 7): Promise<CricketDataMatch[]> {
    return this.fetchWithCache<CricketDataMatch[]>(
      `/matches?status=upcoming&days=${days}`,
      env.CRICKET_DATA_CACHE_TTL
    );
  }

  async getMatchSquad(matchId: string): Promise<CricketDataSquad[]> {
    return this.fetchWithCache<CricketDataSquad[]>(
      `/matches/${matchId}/squad`,
      env.CRICKET_DATA_CACHE_TTL
    );
  }

  async getPlayers(teamId?: string): Promise<CricketDataPlayer[]> {
    const endpoint = teamId ? `/players?team_id=${teamId}` : "/players";
    return this.fetchWithCache<CricketDataPlayer[]>(endpoint, env.CRICKET_DATA_CACHE_TTL);
  }

  async getPlayer(playerId: string): Promise<CricketDataPlayer> {
    return this.fetchWithCache<CricketDataPlayer>(`/players/${playerId}`, env.CRICKET_DATA_CACHE_TTL);
  }

  async getLiveScore(matchId: string): Promise<CricketDataLiveScore> {
    return this.fetchWithCache<CricketDataLiveScore>(
      `/matches/${matchId}/live`,
      env.CRICKET_DATA_LIVE_CACHE_TTL
    );
  }

  async getScorecard(matchId: string): Promise<CricketDataScorecard> {
    return this.fetchWithCache<CricketDataScorecard>(
      `/matches/${matchId}/scorecard`,
      env.CRICKET_DATA_CACHE_TTL
    );
  }

  async getIPLMatches(season?: number): Promise<CricketDataMatch[]> {
    const year = season ?? new Date().getFullYear();
    return this.fetchWithCache<CricketDataMatch[]>(
      `/matches?series=ipl-${year}`,
      env.CRICKET_DATA_CACHE_TTL
    );
  }

  getApiUsage() {
    return {
      hitsRemaining: this.hitsRemaining,
      hitsLimit: this.hitsLimit,
    };
  }

  clearCache() {
    this.cache.clear();
  }
}

export const cricketDataService = new CricketDataService();
