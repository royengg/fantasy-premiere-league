import { describe, expect, it } from "vitest";

import { createSeedStore } from "../apps/api/src/data/seed.ts";
import { InMemoryAppRepository } from "../apps/api/src/repositories/app-repository.ts";
import { AuthService } from "../apps/api/src/services/auth-service.ts";
import { GameService } from "../apps/api/src/services/game-service.ts";

describe("auth service", () => {
  it("creates a session token and authenticates it", async () => {
    const store = createSeedStore();
    const repository = new InMemoryAppRepository(store);
    const authService = new AuthService(repository);

    const session = await authService.bootstrap({
      name: "Aisha Singh",
      email: "captain@cricketclub.test"
    });
    const nextStore = await repository.loadStore();

    expect(session.token).toBeTruthy();
    expect(nextStore.sessions).toHaveLength(1);
    expect(await authService.authenticate(session.token)).toBe(session.userId);
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
