import type {
  FantasyScoreEvent,
  Player,
  PlayerPointsBreakdown,
  PredictionAnswer,
  PredictionQuestion,
  PredictionResult,
  Roster,
  XPTransaction
} from "@fantasy-cricket/types";

export function calculateRosterPoints(
  roster: Roster,
  players: Player[],
  events: FantasyScoreEvent[]
): { total: number; breakdown: PlayerPointsBreakdown[] } {
  const breakdown = roster.players.map(({ playerId }) => {
    const player = players.find((entry) => entry.id === playerId);
    if (!player) {
      throw new Error(`Unknown player ${playerId}`);
    }

    const basePoints = events
      .filter((event) => event.playerId === playerId)
      .reduce((sum, event) => sum + event.points, 0);

    const multiplier = playerId === roster.captainPlayerId ? 2 : playerId === roster.viceCaptainPlayerId ? 1.5 : 1;

    return {
      playerId,
      playerName: player.name,
      basePoints,
      multiplier,
      finalPoints: basePoints * multiplier
    };
  });

  return {
    total: breakdown.reduce((sum, entry) => sum + entry.finalPoints, 0),
    breakdown
  };
}

export function canSubmitPrediction(question: PredictionQuestion, now = new Date()): boolean {
  return question.state === "open" && now < new Date(question.locksAt);
}

export function settlePredictionAnswer(
  question: PredictionQuestion,
  answer: PredictionAnswer,
  correctOptionId: string,
  currentStreak: number,
  settledAt: string
): { result: PredictionResult; transaction: XPTransaction } {
  const isCorrect = answer.optionId === correctOptionId;
  const awardedXp = isCorrect ? question.xpReward : 0;
  const streak = isCorrect ? currentStreak + 1 : 0;

  return {
    result: {
      id: `${question.id}-${answer.userId}`,
      questionId: question.id,
      userId: answer.userId,
      correctOptionId,
      awardedXp,
      awardedBadgeId: isCorrect ? question.badgeRewardId : undefined,
      awardedCosmeticId: isCorrect ? question.cosmeticRewardId : undefined,
      streak,
      settledAt
    },
    transaction: {
      id: `${answer.userId}-${question.id}-xp`,
      userId: answer.userId,
      source: "prediction",
      amount: awardedXp,
      description: isCorrect ? `Correct prediction: ${question.prompt}` : `Prediction missed: ${question.prompt}`,
      createdAt: settledAt
    }
  };
}
