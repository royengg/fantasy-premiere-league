import { describe, expect, it } from "vitest";

import { createSeedStore } from "../apps/api/src/data/seed.ts";
import { InMemoryAppRepository } from "../apps/api/src/repositories/app-repository.ts";
import { AuthService } from "../apps/api/src/services/auth-service.ts";
import { GameService } from "../apps/api/src/services/game-service.ts";
import type { ProviderSyncGateway } from "../apps/api/src/services/provider-sync-service.ts";

describe("auth service", () => {
  it("registers a new user, creates a session token, and authenticates it", async () => {
    const store = createSeedStore();
    const repository = new InMemoryAppRepository(store);
    const authService = new AuthService(repository);

    const session = await authService.register({
      name: "New Captain",
      email: "newcaptain@example.com",
      password: "password123"
    });
    const nextStore = await repository.loadStore();

    expect(session.token).toBeTruthy();
    expect(session.onboardingCompleted).toBe(false);
    expect(nextStore.sessions).toHaveLength(1);
    expect(await authService.authenticate(session.token)).toBe(session.userId);
  });

  it("logs in with seeded credentials, completes onboarding, and revokes the session", async () => {
    const store = createSeedStore();
    const repository = new InMemoryAppRepository(store);
    const authService = new AuthService(repository);

    const session = await authService.login({
      email: "captain@cricketclub.test",
      password: "password123"
    });

    expect(session.userId).toBe("user-1");
    expect(session.onboardingCompleted).toBe(true);

    const profile = await authService.completeOnboarding("user-1", {
      username: "CaptainAisha",
      favoriteTeamId: "team-ben"
    });

    expect(profile.username).toBe("CaptainAisha");
    expect(profile.favoriteTeamId).toBe("team-ben");
    expect(profile.onboardingCompleted).toBe(true);

    await authService.revoke(session.token);
    await expect(authService.authenticate(session.token)).rejects.toThrow("Session expired.");
  });
});

describe("game service prediction settlement", () => {
  it("awards xp, badges, cosmetics, and updates streaks", async () => {
    const store = createSeedStore();
    const repository = new InMemoryAppRepository(store);
    const gameService = new GameService(repository);
    await gameService.initialize();

    await gameService.answerPrediction("user-1", "question-1", { optionId: "question-1-a" });
    await gameService.answerPrediction("user-1", "question-2", { optionId: "question-2-b" });

    const winnerResult = await gameService.settlePrediction("question-1", "question-1-a");
    const propResult = await gameService.settlePrediction("question-2", "question-2-b");
    const nextStore = await repository.loadStore();

    const profile = nextStore.profiles.find((entry) => entry.userId === "user-1");
    const inventory = nextStore.inventories.find((entry) => entry.userId === "user-1");

    expect(winnerResult.settledCount).toBe(1);
    expect(propResult.settledCount).toBe(1);
    expect(profile?.xp).toBe(250);
    expect(profile?.level).toBe(3);
    expect(profile?.streak).toBe(4);
    expect(inventory?.badgeIds).toContain("badge-night-watch");
    expect(inventory?.cosmeticIds).toContain("cos-frame-copper");
    expect(nextStore.results).toHaveLength(2);
    expect(nextStore.xpTransactions).toHaveLength(3);
  });
});

describe("provider sync", () => {
  it("imports provider matches, squads, and score events into the public dashboard", async () => {
    const gateway: ProviderSyncGateway = {
      async getIPLMatches() {
        return [
          {
            id: "ipl-1",
            name: "Bengaluru Blaze vs Mumbai Tides",
            short_name: "BEN vs MUM",
            series_id: "ipl-2026",
            series_name: "IPL 2026",
            format: "t20",
            status: "upcoming",
            start_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            venue: "Eden Arena",
            city: "Mumbai",
            home_team: { id: "ben", name: "Bengaluru Blaze", short_name: "BEN" },
            away_team: { id: "mum", name: "Mumbai Tides", short_name: "MUM" }
          }
        ];
      },
      async getMatchSquad() {
        return [
          {
            team_id: "ben",
            team_name: "Bengaluru Blaze",
            players: [
              {
                id: "p-ben-1",
                name: "Viraj Rao",
                team_id: "ben",
                team_name: "Bengaluru Blaze",
                role: "BAT",
                country: "India",
                selection_percent: 72
              },
              {
                id: "p-ben-2",
                name: "Amit Singh",
                team_id: "ben",
                team_name: "Bengaluru Blaze",
                role: "BOWL",
                country: "India",
                selection_percent: 45
              }
            ]
          },
          {
            team_id: "mum",
            team_name: "Mumbai Tides",
            players: [
              {
                id: "p-mum-1",
                name: "Daniel Ross",
                team_id: "mum",
                team_name: "Mumbai Tides",
                role: "AR",
                country: "Australia",
                selection_percent: 61
              },
              {
                id: "p-mum-2",
                name: "Rakesh Iyer",
                team_id: "mum",
                team_name: "Mumbai Tides",
                role: "WK",
                country: "India",
                selection_percent: 54
              }
            ]
          }
        ];
      },
      async getScorecard() {
        return {
          match_id: "ipl-1",
          innings: [
            {
              batting_team: "Bengaluru Blaze",
              bowling_team: "Mumbai Tides",
              total_runs: 180,
              total_wickets: 6,
              total_overs: 20,
              extras: 8,
              batting: [
                {
                  player_id: "p-ben-1",
                  player_name: "Viraj Rao",
                  runs: 54,
                  balls: 35,
                  fours: 5,
                  sixes: 2,
                  strike_rate: 154.2,
                  out: true
                }
              ],
              bowling: [
                {
                  player_id: "p-mum-1",
                  player_name: "Daniel Ross",
                  overs: 4,
                  maidens: 0,
                  runs: 28,
                  wickets: 2,
                  economy: 7,
                  dots: 9
                }
              ],
              fall_of_wickets: []
            }
          ]
        };
      }
    };

    const store = createSeedStore();
    const repository = new InMemoryAppRepository(store);
    const gameService = new GameService(repository, gateway);

    const syncResult = await gameService.syncProvider();
    const dashboard = await gameService.getDashboard("user-1");

    expect(syncResult.matches).toBe(1);
    expect(syncResult.players).toBe(4);
    expect(dashboard.contests.some((contest) => contest.id.startsWith("provider:contest:"))).toBe(true);
    expect(dashboard.matches.some((match) => match.id.startsWith("provider:match:"))).toBe(true);
    expect(dashboard.questions.some((question) => question.id.startsWith("provider:question:"))).toBe(true);
    expect(dashboard.players.some((player) => player.id.startsWith("provider:player:"))).toBe(true);
  });
});
