import { levelFromXp } from "@fantasy-cricket/domain";
import type { User } from "@fantasy-cricket/types";
import type { AuthBootstrapInput } from "@fantasy-cricket/validators";

import type { AppStore } from "../data/store.js";

export class AuthService {
  constructor(private readonly store: AppStore) {}

  bootstrap(input: AuthBootstrapInput): { userId: string; profileUsername: string } {
    const existing = this.store.users.find((user) => user.email === input.email);
    if (existing) {
      const profile = this.store.profiles.find((entry) => entry.userId === existing.id);
      if (!profile) {
        throw new Error("Profile is missing.");
      }

      return {
        userId: existing.id,
        profileUsername: profile.username
      };
    }

    const user: User = {
      id: crypto.randomUUID(),
      email: input.email,
      name: input.name,
      createdAt: new Date().toISOString()
    };

    this.store.users.push(user);

    const username = input.name.replace(/\s+/g, "").slice(0, 16) || "CricketFan";
    this.store.profiles.push({
      userId: user.id,
      username,
      xp: 0,
      level: levelFromXp(0),
      streak: 0,
      equippedCosmetics: {}
    });

    this.store.inventories.push({
      userId: user.id,
      cosmeticIds: [],
      badgeIds: [],
      equipped: {}
    });

    return {
      userId: user.id,
      profileUsername: username
    };
  }
}

