import { describe, expect, it } from "vitest";

import { createSeedStore } from "../apps/api/src/data/seed.ts";
import type { AppStore } from "../apps/api/src/data/store.ts";
import type { AppRepository } from "../apps/api/src/repositories/app-repository.ts";
import { AuthService } from "../apps/api/src/services/auth-service.ts";
import { GameService } from "../apps/api/src/services/game-service.ts";
import type { ProviderSyncGateway } from "../apps/api/src/services/provider-sync-service.ts";

function cloneStore(store: AppStore): AppStore {
  return structuredClone(store);
}

class TestAppRepository implements AppRepository {
  constructor(private store: AppStore) {}

  async initialize(seedStore: AppStore): Promise<void> {
    if (!this.store.users.length) {
      this.store = cloneStore(seedStore);
    }
  }

  async loadStore(): Promise<AppStore> {
    return cloneStore(this.store);
  }

  async replaceStore(store: AppStore): Promise<void> {
    this.store = cloneStore(store);
  }

  async updateProviderState(patch: Partial<AppStore["provider"]>): Promise<void> {
    this.store = {
      ...this.store,
      provider: {
        ...this.store.provider,
        ...patch
      }
    };
  }
}

describe("auth service", () => {
  it("registers a new user, creates a session token, and authenticates it", async () => {
    const store = createSeedStore();
    const repository = new TestAppRepository(store);
    const authService = new AuthService(repository);

    const session = await authService.register({
      name: "New Captain",
      email: "newcaptain@example.com",
      password: "password123"
    });
    const nextStore = await repository.loadStore();
    const profile = nextStore.profiles.find((entry) => entry.userId === session.userId);

    expect(session.token).toBeTruthy();
    expect(session.onboardingCompleted).toBe(false);
    expect(nextStore.sessions).toHaveLength(1);
    expect(profile?.credits).toBe(100);
    expect(await authService.authenticate(session.token)).toBe(session.userId);
  });

  it("rejects duplicate registration emails and wrong passwords", async () => {
    const repository = new TestAppRepository(createSeedStore());
    const authService = new AuthService(repository);

    await expect(
      authService.register({
        name: "Another Aisha",
        email: "captain@cricketclub.test",
        password: "password123"
      })
    ).rejects.toThrow("already exists");

    await expect(
      authService.login({
        email: "captain@cricketclub.test",
        password: "wrong-password"
      })
    ).rejects.toThrow("Invalid email or password.");
  });

  it("logs in with seeded credentials, completes onboarding, and revokes the session", async () => {
    const store = createSeedStore();
    const repository = new TestAppRepository(store);
    const authService = new AuthService(repository);

    const session = await authService.login({
      email: "captain@cricketclub.test",
      password: "password123"
    });

    expect(session.userId).toBe("user-1");
    expect(session.onboardingCompleted).toBe(true);

    const profile = await authService.completeOnboarding("user-1", {
      username: "CaptainAisha",
      favoriteTeamId: "team-mi"
    });

    expect(profile.username).toBe("CaptainAisha");
    expect(profile.favoriteTeamId).toBe("team-mi");
    expect(profile.onboardingCompleted).toBe(true);

    await authService.revoke(session.token);
    await expect(authService.authenticate(session.token)).rejects.toThrow("Session expired.");
  });

  it("rejects onboarding when the username is already taken", async () => {
    const repository = new TestAppRepository(createSeedStore());
    const authService = new AuthService(repository);

    await expect(
      authService.completeOnboarding("user-1", {
        username: "LateCutRehan",
        favoriteTeamId: "team-mi"
      })
    ).rejects.toThrow("Username is already taken.");
  });
});

describe("game service prediction settlement", () => {
  it("awards xp, badges, cosmetics, and updates streaks", async () => {
    const store = createSeedStore();
    const repository = new TestAppRepository(store);
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

describe("game service roster credits", () => {
  it("gives new users enough credits for their first team and charges roster costs by delta", async () => {
    const store = createSeedStore();
    const repository = new TestAppRepository(store);
    const authService = new AuthService(repository);
    const gameService = new GameService(repository);
    await gameService.initialize();

    const session = await authService.register({
      name: "Squad Builder",
      email: "squadbuilder@example.com",
      password: "password123"
    });

    await authService.completeOnboarding(session.userId, {
      username: "SquadBuilder",
      favoriteTeamId: "team-mi"
    });

    const firstRoster = await gameService.submitRoster(session.userId, "contest-1", {
      playerIds: ["p1", "p2", "p3", "p4", "p5", "p8", "p9", "p10", "p11", "p12", "p13"],
      captainPlayerId: "p2",
      viceCaptainPlayerId: "p12"
    });

    let nextStore = await repository.loadStore();
    let profile = nextStore.profiles.find((entry) => entry.userId === session.userId);

    expect(firstRoster.totalCredits).toBe(95.5);
    expect(profile?.credits).toBe(4.5);

    const updatedRoster = await gameService.submitRoster(session.userId, "contest-1", {
      playerIds: ["p1", "p3", "p4", "p5", "p6", "p7", "p8", "p10", "p11", "p13", "p14"],
      captainPlayerId: "p4",
      viceCaptainPlayerId: "p11"
    });

    nextStore = await repository.loadStore();
    profile = nextStore.profiles.find((entry) => entry.userId === session.userId);

    expect(updatedRoster.totalCredits).toBe(92);
    expect(profile?.credits).toBe(8);

    await expect(
      gameService.submitRoster(session.userId, "contest-2", {
        playerIds: ["p1", "p2", "p3", "p4", "p5", "p8", "p9", "p10", "p11", "p12", "p13"],
        captainPlayerId: "p2",
        viceCaptainPlayerId: "p12"
      })
    ).rejects.toThrow("Not enough credits.");
  });
});

describe("provider sync", () => {
  it("imports provider matches, squads, and score events into the public dashboard", async () => {
    const gateway: ProviderSyncGateway = {
      async getIPLMatches() {
        return [
          {
            id: "ipl-1",
            name: "Mumbai Indians vs Chennai Super Kings",
            short_name: "MI vs CSK",
            series_id: "ipl-2026",
            series_name: "IPL 2026",
            format: "t20",
            status: "upcoming",
            start_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            venue: "Eden Arena",
            city: "Mumbai",
            home_team: { id: "mi", name: "Mumbai Indians", short_name: "MI" },
            away_team: { id: "csk", name: "Chennai Super Kings", short_name: "CSK" }
          }
        ];
      },
      async getMatchSquad() {
        return [
          {
            team_id: "mi",
            team_name: "Mumbai Indians",
            players: [
              {
                id: "p-mi-1",
                name: "Viraj Rao",
                team_id: "mi",
                team_name: "Mumbai Indians",
                role: "BAT",
                country: "India",
                selection_percent: 72
              },
              {
                id: "p-mi-2",
                name: "Amit Singh",
                team_id: "mi",
                team_name: "Mumbai Indians",
                role: "BOWL",
                country: "India",
                selection_percent: 45
              }
            ]
          },
          {
            team_id: "csk",
            team_name: "Chennai Super Kings",
            players: [
              {
                id: "p-csk-1",
                name: "Daniel Ross",
                team_id: "csk",
                team_name: "Chennai Super Kings",
                role: "AR",
                country: "Australia",
                selection_percent: 61
              },
              {
                id: "p-csk-2",
                name: "Rakesh Iyer",
                team_id: "csk",
                team_name: "Chennai Super Kings",
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
              batting_team: "Mumbai Indians",
              bowling_team: "Chennai Super Kings",
              total_runs: 180,
              total_wickets: 6,
              total_overs: 20,
              extras: 8,
              batting: [
                {
                  player_id: "p-mi-1",
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
                  player_id: "p-csk-1",
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
    const repository = new TestAppRepository(store);
    const gameService = new GameService(repository, gateway);

    const syncResult = await gameService.syncProvider();
    const dashboard = await gameService.getDashboard("user-1");

    expect(syncResult.matches).toBe(1);
    expect(syncResult.players).toBe(4);
    expect(dashboard.contests.some((contest) => contest.id.startsWith("provider:contest:"))).toBe(true);
    expect(dashboard.matches.some((match) => match.id.startsWith("provider:match:"))).toBe(true);
    expect(dashboard.questions.some((question) => question.id.startsWith("provider:question:"))).toBe(true);
    expect(dashboard.players.some((player) => player.id.startsWith("provider:player:"))).toBe(true);
    expect(dashboard.teams.some((team) => team.name === "Mumbai Indians" && team.shortName === "MI")).toBe(true);
    expect(dashboard.teams.some((team) => team.name === "Chennai Super Kings" && team.shortName === "CSK")).toBe(true);
  });
});
