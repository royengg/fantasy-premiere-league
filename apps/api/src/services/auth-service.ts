import { levelFromXp } from "@fantasy-cricket/domain";
import type { AuthBootstrapResponse, AuthSession, User } from "@fantasy-cricket/types";
import type { AuthBootstrapInput } from "@fantasy-cricket/validators";

import type { AppStore } from "../data/store.js";
import type { AppRepository } from "../repositories/app-repository.js";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

export class AuthService {
  constructor(private readonly repository: AppRepository) {}

  async bootstrap(input: AuthBootstrapInput): Promise<AuthBootstrapResponse> {
    const store = await this.repository.loadStore();
    const existing = store.users.find((user) => user.email === input.email);
    if (existing) {
      const profile = store.profiles.find((entry) => entry.userId === existing.id);
      if (!profile) {
        throw new Error("Profile is missing.");
      }

      const session = this.createSession(store, existing.id);
      await this.repository.replaceStore(store);

      return {
        token: session.token,
        userId: existing.id,
        profileUsername: profile.username,
        expiresAt: session.expiresAt
      };
    }

    const user: User = {
      id: crypto.randomUUID(),
      email: input.email,
      name: input.name,
      createdAt: new Date().toISOString()
    };

    store.users.push(user);

    const username = input.name.replace(/\s+/g, "").slice(0, 16) || "CricketFan";
    store.profiles.push({
      userId: user.id,
      username,
      xp: 0,
      level: levelFromXp(0),
      streak: 0,
      equippedCosmetics: {}
    });

    store.inventories.push({
      userId: user.id,
      cosmeticIds: [],
      badgeIds: [],
      equipped: {}
    });

    const session = this.createSession(store, user.id);
    await this.repository.replaceStore(store);

    return {
      token: session.token,
      userId: user.id,
      profileUsername: username,
      expiresAt: session.expiresAt
    };
  }

  async authenticate(token: string | null | undefined): Promise<string> {
    if (!token) {
      throw new Error("Authentication required.");
    }

    const store = await this.repository.loadStore();
    const hadExpiredSessions = this.pruneExpiredSessions(store);
    const session = store.sessions.find((entry) => entry.token === token);

    if (hadExpiredSessions) {
      await this.repository.replaceStore(store);
    }

    if (!session) {
      throw new Error("Session expired.");
    }

    return session.userId;
  }

  async revoke(token: string | null | undefined): Promise<void> {
    if (!token) {
      return;
    }

    const store = await this.repository.loadStore();
    const nextSessions = store.sessions.filter((entry) => entry.token !== token);
    if (nextSessions.length === store.sessions.length) {
      return;
    }

    store.sessions = nextSessions;
    await this.repository.replaceStore(store);
  }

  private createSession(store: AppStore, userId: string): AuthSession {
    const now = new Date();
    const session: AuthSession = {
      token: crypto.randomUUID(),
      userId,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + SESSION_TTL_MS).toISOString()
    };

    store.sessions.push(session);
    return session;
  }

  private pruneExpiredSessions(store: AppStore): boolean {
    const now = Date.now();
    const nextSessions = store.sessions.filter(
      (session) => new Date(session.expiresAt).getTime() > now
    );

    const changed = nextSessions.length !== store.sessions.length;
    if (changed) {
      store.sessions = nextSessions;
    }

    return changed;
  }
}
