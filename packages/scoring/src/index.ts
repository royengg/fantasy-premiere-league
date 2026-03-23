import type {
  FantasyScoreEvent,
  Player,
  PlayerMatchStatLine,
  PlayerPointsBreakdown,
  PredictionAnswer,
  PredictionQuestion,
  PredictionResult,
  Roster,
  XPTransaction
} from "@fantasy-cricket/types";

const FANTASY_POINTS = {
  battingRun: 1,
  boundaryFour: 1,
  boundarySix: 2,
  wicket: 25,
  maiden: 12,
  dotBall: 1,
  catch: 8,
  stumping: 12,
  runOut: 6
} as const;

function eventId(matchId: string, playerId: string, slug: string) {
  return `stat:${matchId}:${playerId}:${slug}`;
}

function pushStatEvent(
  events: FantasyScoreEvent[],
  line: PlayerMatchStatLine,
  slug: string,
  label: string,
  points: number,
  createdAt: string
) {
  if (points === 0) {
    return;
  }

  events.push({
    id: eventId(line.matchId, line.playerId, slug),
    matchId: line.matchId,
    playerId: line.playerId,
    label,
    points,
    createdAt
  });
}

function strikeRateAdjustment(line: PlayerMatchStatLine) {
  if (!line.didBat || line.balls < 10 || line.battingStrikeRate == null) {
    return 0;
  }

  const rate = line.battingStrikeRate;
  if (rate >= 170) {
    return 6;
  }
  if (rate >= 150) {
    return 4;
  }
  if (rate >= 130) {
    return 2;
  }
  if (rate < 50) {
    return -6;
  }
  if (rate < 60) {
    return -4;
  }
  if (rate < 70) {
    return -2;
  }

  return 0;
}

function economyAdjustment(line: PlayerMatchStatLine) {
  if (!line.didBowl || line.ballsBowled < 12 || line.bowlingEconomy == null) {
    return 0;
  }

  const economy = line.bowlingEconomy;
  if (economy < 5) {
    return 6;
  }
  if (economy < 6) {
    return 4;
  }
  if (economy <= 7) {
    return 2;
  }
  if (economy >= 12) {
    return -6;
  }
  if (economy >= 11) {
    return -4;
  }
  if (economy >= 10) {
    return -2;
  }

  return 0;
}

export function createFantasyScoreEventsFromStatLines(
  statLines: PlayerMatchStatLine[],
  createdAt = new Date().toISOString()
): FantasyScoreEvent[] {
  const events: FantasyScoreEvent[] = [];

  for (const line of statLines) {
    pushStatEvent(
      events,
      line,
      "batting-runs",
      "Batting Runs",
      line.runs * FANTASY_POINTS.battingRun,
      createdAt
    );
    pushStatEvent(
      events,
      line,
      "fours",
      "Boundary Fours",
      line.fours * FANTASY_POINTS.boundaryFour,
      createdAt
    );
    pushStatEvent(
      events,
      line,
      "sixes",
      "Boundary Sixes",
      line.sixes * FANTASY_POINTS.boundarySix,
      createdAt
    );
    pushStatEvent(
      events,
      line,
      "wickets",
      "Wickets",
      line.wickets * FANTASY_POINTS.wicket,
      createdAt
    );
    pushStatEvent(
      events,
      line,
      "maidens",
      "Maidens",
      line.maidens * FANTASY_POINTS.maiden,
      createdAt
    );
    pushStatEvent(
      events,
      line,
      "dot-balls",
      "Dot Balls",
      line.dotBalls * FANTASY_POINTS.dotBall,
      createdAt
    );
    pushStatEvent(
      events,
      line,
      "catches",
      "Catches",
      line.catches * FANTASY_POINTS.catch,
      createdAt
    );
    pushStatEvent(
      events,
      line,
      "stumpings",
      "Stumpings",
      line.stumpings * FANTASY_POINTS.stumping,
      createdAt
    );
    pushStatEvent(
      events,
      line,
      "run-outs",
      "Run Outs",
      line.runOuts * FANTASY_POINTS.runOut,
      createdAt
    );
    pushStatEvent(
      events,
      line,
      "strike-rate",
      "Strike Rate",
      strikeRateAdjustment(line),
      createdAt
    );
    pushStatEvent(
      events,
      line,
      "economy",
      "Economy",
      economyAdjustment(line),
      createdAt
    );
  }

  return events;
}

export function calculateRosterPoints(
  roster: Roster,
  players: Player[],
  events: FantasyScoreEvent[],
  statLines: PlayerMatchStatLine[] = []
): { total: number; breakdown: PlayerPointsBreakdown[] } {
  const baseByPlayerId = new Map<string, number>();
  for (const event of events) {
    baseByPlayerId.set(event.playerId, (baseByPlayerId.get(event.playerId) ?? 0) + event.points);
  }
  const didPlayByPlayerId = new Map(
    statLines.map((line) => [line.playerId, line.didPlay])
  );

  const playerById = new Map(players.map((player) => [player.id, player]));
  const starters = roster.players.filter((selection) => selection.isStarter);
  const substitutes = roster.players.filter((selection) => !selection.isStarter);

  const starterBreakdown: PlayerPointsBreakdown[] = starters.map(({ playerId }) => {
    const player = playerById.get(playerId);
    if (!player) {
      throw new Error(`Unknown player ${playerId}`);
    }

    const basePoints = baseByPlayerId.get(playerId) ?? 0;
    const multiplier =
      playerId === roster.captainPlayerId ? 2 : playerId === roster.viceCaptainPlayerId ? 1.5 : 1;

    return {
      playerId,
      playerName: player.name,
      role: player.role,
      basePoints,
      multiplier,
      finalPoints: basePoints * multiplier,
      isStarter: true,
      didPlay: didPlayByPlayerId.get(playerId) ?? false
    } satisfies PlayerPointsBreakdown;
  });

  const substituteBreakdown: PlayerPointsBreakdown[] = substitutes.map(({ playerId }) => {
    const player = players.find((entry) => entry.id === playerId);
    if (!player) {
      throw new Error(`Unknown player ${playerId}`);
    }

    const basePoints = baseByPlayerId.get(playerId) ?? 0;

    return {
      playerId,
      playerName: player.name,
      role: player.role,
      basePoints,
      multiplier: 1,
      finalPoints: basePoints,
      isStarter: false,
      didPlay: didPlayByPlayerId.get(playerId) ?? false
    } satisfies PlayerPointsBreakdown;
  });

  const lockedStarterIds = new Set([roster.captainPlayerId, roster.viceCaptainPlayerId]);
  const substitutions: Array<{ benchId: string; starterId: string; gain: number }> = [];

  for (const bench of substituteBreakdown) {
    const eligibleStarters = starterBreakdown
      .filter(
        (starter) =>
          starter.role === bench.role &&
          !lockedStarterIds.has(starter.playerId) &&
          (starter.finalPoints < bench.finalPoints ||
            (!starter.didPlay && bench.didPlay)) &&
          !substitutions.some((entry) => entry.starterId === starter.playerId)
      )
      .sort((left, right) => {
        if (left.didPlay !== right.didPlay) {
          return left.didPlay ? 1 : -1;
        }

        return left.finalPoints - right.finalPoints;
      });

    const starterToReplace = eligibleStarters[0];
    if (!starterToReplace) {
      continue;
    }

    substitutions.push({
      benchId: bench.playerId,
      starterId: starterToReplace.playerId,
      gain: bench.finalPoints - starterToReplace.finalPoints
    });
  }

  const appliedSubstitutions = substitutions
    .sort((left, right) => right.gain - left.gain)
    .slice(0, 2);

  const starterById = new Map(starterBreakdown.map((entry) => [entry.playerId, entry]));
  const substituteById = new Map(substituteBreakdown.map((entry) => [entry.playerId, entry]));

  for (const substitution of appliedSubstitutions) {
    const starterIndex = starterBreakdown.findIndex((entry) => entry.playerId === substitution.starterId);
    const substitute = substituteById.get(substitution.benchId);
    if (starterIndex === -1 || !substitute) {
      continue;
    }

    // Clone to avoid mutating the original object (#12)
    const cloned = { ...starterBreakdown[starterIndex] };
    cloned.autoSubstituted = true;
    cloned.replacedPlayerId = substitute.playerId;
    cloned.replacedPlayerName = substitute.playerName;
    cloned.finalPoints = substitute.finalPoints;
    cloned.basePoints = substitute.basePoints;
    cloned.multiplier = substitute.multiplier;
    starterBreakdown[starterIndex] = cloned;
  }

  const breakdown = [...starterBreakdown, ...substituteBreakdown];

  return {
    total: starterBreakdown.reduce((sum, entry) => sum + entry.finalPoints, 0),
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
