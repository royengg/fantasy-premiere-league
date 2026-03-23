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
  UserInventory
} from "@fantasy-cricket/types";

export * from "./ipl-teams";
export * from "./auction";

export const defaultRosterRules: RosterRules = {
  startingPlayers: 11,
  substitutePlayers: 2,
  totalPlayers: 13,
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
  maxPerTeam: 7
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
  const combinedPlayerIds = [...input.starterPlayerIds, ...input.substitutePlayerIds];

  if (now >= lockTime) {
    errors.push("This contest is locked.");
  }

  if (match.state !== "scheduled" && match.state !== "live") {
    errors.push("This match is not open for roster changes.");
  }

  const selected = players.filter((player) => combinedPlayerIds.includes(player.id));
  const selectedStarters = players.filter((player) => input.starterPlayerIds.includes(player.id));
  const selectedSubstitutes = players.filter((player) => input.substitutePlayerIds.includes(player.id));
  const seenIds = new Set(combinedPlayerIds);

  if (input.starterPlayerIds.length !== contest.rosterRules.startingPlayers) {
    errors.push(`Select exactly ${contest.rosterRules.startingPlayers} starters.`);
  }

  if (input.substitutePlayerIds.length !== contest.rosterRules.substitutePlayers) {
    errors.push(`Select exactly ${contest.rosterRules.substitutePlayers} substitutes.`);
  }

  if (seenIds.size !== contest.rosterRules.totalPlayers) {
    errors.push(`Select exactly ${contest.rosterRules.totalPlayers} unique players.`);
  }

  if (selected.length !== contest.rosterRules.totalPlayers) {
    errors.push("Some selected players are unavailable.");
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
    if (count > contest.rosterRules.maxPerTeam) {
      errors.push(`Maximum ${contest.rosterRules.maxPerTeam} players allowed from one team.`);
    }
  }

  if (!input.starterPlayerIds.includes(input.captainPlayerId)) {
    errors.push("Captain must be selected in the starting XI.");
  }

  if (!input.starterPlayerIds.includes(input.viceCaptainPlayerId)) {
    errors.push("Vice captain must be selected in the starting XI.");
  }

  if (input.captainPlayerId === input.viceCaptainPlayerId) {
    errors.push("Captain and vice captain must be different players.");
  }

  if (selectedStarters.length !== contest.rosterRules.startingPlayers) {
    errors.push("Some selected starters are unavailable.");
  }

  if (selectedSubstitutes.length !== contest.rosterRules.substitutePlayers) {
    errors.push("Some selected substitutes are unavailable.");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    teamCount
  };
}

export function createInviteCode(name: string): string {
  const prefix = name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 4)
    .padEnd(4, "X");

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = new Uint8Array(4);
  globalThis.crypto.getRandomValues(bytes);
  const suffix = Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("");
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
