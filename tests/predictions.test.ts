import { describe, expect, it } from "vitest";

import { canSubmitPrediction, settlePredictionAnswer } from "@fantasy-cricket/scoring";
import type { PredictionAnswer, PredictionQuestion } from "@fantasy-cricket/types";

const question: PredictionQuestion = {
  id: "q1",
  matchId: "m1",
  prompt: "Who wins?",
  category: "winner",
  options: [
    { id: "a", label: "Team A", value: "team-a" },
    { id: "b", label: "Team B", value: "team-b" }
  ],
  locksAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  resolvesAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
  state: "open",
  xpReward: 30,
  badgeRewardId: "badge-1",
  cosmeticRewardId: "cos-1"
};

describe("prediction rules", () => {
  it("allows submissions before lock time", () => {
    expect(canSubmitPrediction(question, new Date())).toBe(true);
  });

  it("settles correct answers with xp and rewards", () => {
    const answer: PredictionAnswer = {
      id: "ans-1",
      questionId: "q1",
      userId: "user-1",
      optionId: "a",
      submittedAt: new Date().toISOString()
    };

    const settled = settlePredictionAnswer(question, answer, "a", 2, new Date().toISOString());
    expect(settled.result.awardedXp).toBe(30);
    expect(settled.result.awardedBadgeId).toBe("badge-1");
    expect(settled.result.awardedCosmeticId).toBe("cos-1");
    expect(settled.result.streak).toBe(3);
  });

  it("resets the streak on a miss", () => {
    const answer: PredictionAnswer = {
      id: "ans-2",
      questionId: "q1",
      userId: "user-1",
      optionId: "b",
      submittedAt: new Date().toISOString()
    };

    const settled = settlePredictionAnswer(question, answer, "a", 4, new Date().toISOString());
    expect(settled.result.awardedXp).toBe(0);
    expect(settled.result.streak).toBe(0);
  });
});

