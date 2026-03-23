import { createHash, randomBytes } from "node:crypto";

import { levelFromXp } from "@fantasy-cricket/domain";
import type { AuthResponse, AuthSession, Profile, User } from "@fantasy-cricket/types";
import type {
  AuthLoginInput,
  AuthOnboardingInput,
  AuthRegisterInput
} from "@fantasy-cricket/validators";

import { hashPassword, verifyPassword } from "../lib/password.js";
import type { AuthRuntimeRepository } from "../repositories/runtime-repository.js";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function createRawSessionToken() {
  return randomBytes(32).toString("base64url");
}

function usernameBaseFromName(name: string) {
  const alphanumeric = name.replace(/[^a-zA-Z0-9]/g, "");
  return (alphanumeric.slice(0, 16) || "CricketFan").replace(/^\d+/, "fan");
}

export class AuthService {
  constructor(private readonly repository: AuthRuntimeRepository) {}

  async register(input: AuthRegisterInput): Promise<AuthResponse> {
    const email = normalizeEmail(input.email);
    const [existing, hasAdminUser] = await Promise.all([
      this.repository.findUserLoginRecord(email),
      this.repository.hasAnyAdminUser()
    ]);
    if (existing) {
      throw new Error("An account with this email already exists.");
    }

    const now = new Date();
    const userId = crypto.randomUUID();
    const user: User = {
      id: userId,
      email,
      name: input.name.trim(),
      isAdmin: !hasAdminUser,
      createdAt: now.toISOString()
    };
    const username = await this.ensureUniqueUsername(usernameBaseFromName(user.name));
    const profile: Profile = {
      userId,
      username,
      xp: 0,
      level: levelFromXp(0),
      streak: 0,
      onboardingCompleted: false,
      equippedCosmetics: {}
    };
    const rawSessionToken = createRawSessionToken();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();

    await this.repository.createRegisteredUserRecord({
      user,
      profile,
      passwordHash: await hashPassword(input.password),
      sessionHash: hashSessionToken(rawSessionToken),
      sessionCreatedAt: now.toISOString(),
      sessionExpiresAt: expiresAt
    });

    return this.authResponse(
      {
        token: rawSessionToken,
        userId,
        createdAt: now.toISOString(),
        expiresAt
      },
      profile
    );
  }

  async login(input: AuthLoginInput): Promise<AuthResponse> {
    const email = normalizeEmail(input.email);
    const existing = await this.repository.findUserLoginRecord(email);

    if (!existing) {
      throw new Error("Invalid email or password.");
    }

    const passwordMatches = await verifyPassword(input.password, existing.passwordHash);
    if (!passwordMatches) {
      throw new Error("Invalid email or password.");
    }

    const now = new Date();
    const rawSessionToken = createRawSessionToken();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();

    await this.repository.createHashedSession({
      userId: existing.user.id,
      sessionHash: hashSessionToken(rawSessionToken),
      createdAt: now.toISOString(),
      expiresAt
    });

    return this.authResponse(
      {
        token: rawSessionToken,
        userId: existing.user.id,
        createdAt: now.toISOString(),
        expiresAt
      },
      existing.profile
    );
  }

  async completeOnboarding(userId: string, input: AuthOnboardingInput): Promise<Profile> {
    return this.repository.completeOnboardingProfile({
      userId,
      username: input.username.trim(),
      favoriteTeamId: input.favoriteTeamId
    });
  }

  async authenticate(token: string | null | undefined): Promise<string> {
    if (!token) {
      throw new Error("Authentication required.");
    }

    const userId = await this.repository.findActiveSessionUserId(
      hashSessionToken(token),
      new Date().toISOString()
    );
    if (!userId) {
      throw new Error("Session expired.");
    }

    return userId;
  }

  async assertAdmin(userId: string): Promise<void> {
    if (!(await this.repository.isUserAdmin(userId))) {
      throw new Error("Admin authorization failed.");
    }
  }

  async revoke(token: string | null | undefined): Promise<void> {
    if (!token) {
      return;
    }

    await this.repository.deleteSessionByHash(hashSessionToken(token));
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

  private async ensureUniqueUsername(baseUsername: string) {
    const normalizedBase = baseUsername || "CricketFan";
    const usernames = await this.repository.listProfileUsernamesByBase(normalizedBase);
    const existing = new Set(usernames.map((username) => username.toLowerCase()));

    if (!existing.has(normalizedBase.toLowerCase())) {
      return normalizedBase;
    }

    let attempt = 1;
    while (existing.has(`${normalizedBase}${attempt}`.toLowerCase())) {
      attempt += 1;
    }

    return `${normalizedBase}${attempt}`;
  }
}
