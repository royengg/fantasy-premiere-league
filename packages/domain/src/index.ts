import type {
  BuildRosterInput,
  Contest,
  CosmeticItem,
  CosmeticUnlock,
  ID,
  League,
  Match,
  Player,
  Profile,
  RosterRules,
  RosterValidationResult,
  UserInventory,
  PlayerNationality
} from "@fantasy-cricket/types";

export const defaultRosterRules: RosterRules = {
  totalPlayers: 11,
  minByRole: {
    WK: 1,
    BAT: 3,
    AR: 1,
    BOWL: 3
  },
  maxByRole: {
    WK: 4,
    BAT: 5,
    AR: 4,
    BOWL: 5
  },
  maxPerTeam: 4
};

export function validateRoster(
  contest: Contest,
  match: Match,
  players: Player[],
  input: BuildRosterInput,
  now = new Date()
): RosterValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const lockTime = new Date(contest.lockTime);

  if (now >= lockTime) {
    errors.push("This contest is locked.");
  }

  if (match.state !== "scheduled" && match.state !== "live") {
    errors.push("This match is not open for roster changes.");
  }

  const selected = players.filter((player) => input.playerIds.includes(player.id));
  const seenIds = new Set(input.playerIds);

  if (seenIds.size !== contest.rosterRules.totalPlayers) {
    errors.push("Select exactly 11 unique players.");
  }

  if (selected.length !== contest.rosterRules.totalPlayers) {
    errors.push("Some selected players are unavailable.");
  }

  const totalCredits = selected.reduce((sum, player) => sum + player.credits, 0);
  if (totalCredits > contest.salaryCap) {
    errors.push(`Roster exceeds the salary cap of ${contest.salaryCap}.`);
  }

  for (const [role, minimum] of Object.entries(contest.rosterRules.minByRole)) {
    const count = selected.filter((player) => player.role === role).length;
    if (count < minimum) {
      errors.push(`Add at least ${minimum} ${role} players.`);
    }
  }

  for (const [role, maximum] of Object.entries(contest.rosterRules.maxByRole)) {
    const count = selected.filter((player) => player.role === role).length;
    if (count > maximum) {
      errors.push(`Use no more than ${maximum} ${role} players.`);
    }
  }

  const teamCount: Record<ID, number> = {};
  for (const player of selected) {
    teamCount[player.teamId] = (teamCount[player.teamId] || 0) + 1;
  }

  for (const [teamId, count] of Object.entries(teamCount)) {
    if (count > contest.iplRules.maxPlayersPerTeam) {
      errors.push(`Maximum ${contest.iplRules.maxPlayersPerTeam} players allowed from one team.`);
    }
  }

  if (!input.playerIds.includes(input.captainPlayerId)) {
    errors.push("Captain must be selected in the roster.");
  }

  if (!input.playerIds.includes(input.viceCaptainPlayerId)) {
    errors.push("Vice captain must be selected in the roster.");
  }

  if (input.captainPlayerId === input.viceCaptainPlayerId) {
    errors.push("Captain and vice captain must be different players.");
  }

  const hasUncappedPlayer = selected.some(
    (p) => (p as Player & { nationality?: PlayerNationality }).nationality === "indian-uncapped"
  );

  if (!hasUncappedPlayer) {
    warnings.push("Consider selecting an uncapped player for bonus points.");
  }

  return {
    valid: errors.length === 0,
    totalCredits,
    errors,
    warnings,
    teamCount,
    hasUncappedPlayer
  };
}

export function createInviteCode(name: string): string {
  const prefix = name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 4)
    .padEnd(4, "X");

  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}${suffix}`;
}

export function createLeagueBanner(visibility: League["visibility"]): string {
  return visibility === "public" ? "sunset-grid" : "midnight-stripe";
}

export function levelFromXp(xp: number): number {
  return Math.floor(xp / 100) + 1;
}

export function equipCosmetic(
  inventory: UserInventory,
  profile: Profile,
  item: CosmeticItem
): { inventory: UserInventory; profile: Profile } {
  if (!inventory.cosmeticIds.includes(item.id)) {
    throw new Error("Cosmetic is not unlocked.");
  }

  return {
    inventory: {
      ...inventory,
      equipped: {
        ...inventory.equipped,
        [item.category]: item.id
      }
    },
    profile: {
      ...profile,
      equippedCosmetics: {
        ...profile.equippedCosmetics,
        [item.category]: item.id
      }
    }
  };
}

export function unlockCosmetic(
  inventory: UserInventory,
  userId: ID,
  item: CosmeticItem,
  source: CosmeticUnlock["source"],
  timestamp: string
): { inventory: UserInventory; unlock?: CosmeticUnlock } {
  if (inventory.cosmeticIds.includes(item.id)) {
    return { inventory };
  }

  return {
    inventory: {
      ...inventory,
      cosmeticIds: [...inventory.cosmeticIds, item.id]
    },
    unlock: {
      id: `${userId}-${item.id}`,
      userId,
      cosmeticId: item.id,
      source,
      unlockedAt: timestamp
    }
  };
}