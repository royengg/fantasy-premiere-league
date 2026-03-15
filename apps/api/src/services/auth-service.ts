import { levelFromXp } from "@fantasy-cricket/domain";
import type { AuthResponse, AuthSession, Profile, User } from "@fantasy-cricket/types";
import type {
  AuthLoginInput,
  AuthOnboardingInput,
  AuthRegisterInput
} from "@fantasy-cricket/validators";

import type { AppStore, AuthCredential } from "../data/store.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import type { AppRepository } from "../repositories/app-repository.js";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function usernameBaseFromName(name: string) {
  const alphanumeric = name.replace(/[^a-zA-Z0-9]/g, "");
  return (alphanumeric.slice(0, 16) || "CricketFan").replace(/^\d+/, "fan");
}

export class AuthService {
  constructor(private readonly repository: AppRepository) {}

  async register(input: AuthRegisterInput): Promise<AuthResponse> {
    const store = await this.repository.loadStore();
    const email = normalizeEmail(input.email);

    if (store.users.some((user) => normalizeEmail(user.email) === email)) {
      throw new Error("An account with this email already exists.");
    }

    const userId = crypto.randomUUID();
    const now = new Date().toISOString();
    const user: User = {
      id: userId,
      email,
      name: input.name.trim(),
      createdAt: now
    };

    const profile: Profile = {
      userId,
      username: this.ensureUniqueUsername(store, usernameBaseFromName(user.name)),
      xp: 0,
      level: levelFromXp(0),
      streak: 0,
      onboardingCompleted: false,
      equippedCosmetics: {}
    };

    const credential: AuthCredential = {
      userId,
      passwordHash: await hashPassword(input.password),
      updatedAt: now
    };

    store.users.push(user);
    store.credentials.push(credential);
    store.profiles.push(profile);
    store.inventories.push({
      userId,
      cosmeticIds: [],
      badgeIds: [],
      equipped: {}
    });

    const session = this.createSession(store, userId);
    await this.repository.replaceStore(store);

    return this.authResponse(session, profile);
  }

  async login(input: AuthLoginInput): Promise<AuthResponse> {
    const store = await this.repository.loadStore();
    const email = normalizeEmail(input.email);
    const user = store.users.find((entry) => normalizeEmail(entry.email) === email);

    if (!user) {
      throw new Error("Invalid email or password.");
    }

    const credential = this.getCredential(store, user.id);
    const passwordMatches = await verifyPassword(input.password, credential.passwordHash);
    if (!passwordMatches) {
      throw new Error("Invalid email or password.");
    }

    const profile = this.getProfile(store, user.id);
    const session = this.createSession(store, user.id);
    await this.repository.replaceStore(store);

    return this.authResponse(session, profile);
  }

  async completeOnboarding(userId: string, input: AuthOnboardingInput): Promise<Profile> {
    const store = await this.repository.loadStore();
    const profile = this.getProfile(store, userId);
    const username = input.username.trim();

    if (store.teams.every((team) => team.id !== input.favoriteTeamId)) {
      throw new Error("Favorite team not found.");
    }

    const duplicateProfile = store.profiles.find(
      (entry) => entry.username.toLowerCase() === username.toLowerCase() && entry.userId !== userId
    );
    if (duplicateProfile) {
      throw new Error("Username is already taken.");
    }

    profile.username = username;
    profile.favoriteTeamId = input.favoriteTeamId;
    profile.onboardingCompleted = true;

    await this.repository.replaceStore(store);
    return profile;
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

  private authResponse(session: AuthSession, profile: Profile): AuthResponse {
    return {
      token: session.token,
      userId: session.userId,
      profileUsername: profile.username,
      expiresAt: session.expiresAt,
      onboardingCompleted: profile.onboardingCompleted
    };
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

  private ensureUniqueUsername(store: AppStore, baseUsername: string) {
    const normalizedBase = baseUsername || "CricketFan";
    const existing = new Set(store.profiles.map((profile) => profile.username.toLowerCase()));

    if (!existing.has(normalizedBase.toLowerCase())) {
      return normalizedBase;
    }

    let attempt = 1;
    while (existing.has(`${normalizedBase}${attempt}`.toLowerCase())) {
      attempt += 1;
    }

    return `${normalizedBase}${attempt}`;
  }

  private getCredential(store: AppStore, userId: string) {
    const credential = store.credentials.find((entry) => entry.userId === userId);
    if (!credential) {
      throw new Error("Auth credentials are missing.");
    }

    return credential;
  }

  private getProfile(store: AppStore, userId: string) {
    const profile = store.profiles.find((entry) => entry.userId === userId);
    if (!profile) {
      throw new Error("Profile is missing.");
    }

    return profile;
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
