/**
 * Auth-specific Prisma repository implementation.
 *
 * Split from PrismaAppRepository (#3) to implement AuthRuntimeRepository in isolation.
 * Handles: user lookup, registration, sessions, onboarding, and admin checks.
 */

import type { Profile } from "@fantasy-cricket/types";
import { Prisma, type PrismaClient } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import type { AuthRuntimeRepository } from "./runtime-repository.js";
import { parseJsonColumn, equippedCosmeticsSchema, inputJson, mapProfiles } from "./prisma-helpers.js";

export class PrismaAuthRepository implements AuthRuntimeRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  async listProfileUsernamesByBase(baseUsername: string): Promise<string[]> {
    const rows = await this.client.profile.findMany({
      where: {
        username: {
          startsWith: baseUsername,
          mode: "insensitive"
        }
      },
      select: {
        username: true
      }
    });

    return rows.map((row) => row.username);
  }

  async findUserLoginRecord(email: string): Promise<{
    user: import("@fantasy-cricket/types").User;
    profile: Profile;
    passwordHash: string;
  } | null> {
    const row = await this.client.user.findUnique({
      where: { email },
      include: {
        credential: true,
        profile: true
      }
    });

    if (!row?.credential || !row.profile) {
      return null;
    }

    return {
      user: {
        id: row.id,
        email: row.email,
        name: row.name,
        isAdmin: row.isAdmin,
        createdAt: row.createdAt.toISOString()
      },
      profile: mapProfiles([row.profile])[0],
      passwordHash: row.credential.passwordHash
    };
  }

  async createRegisteredUserRecord(payload: {
    user: import("@fantasy-cricket/types").User;
    profile: Profile;
    passwordHash: string;
    sessionHash: string;
    sessionCreatedAt: string;
    sessionExpiresAt: string;
  }): Promise<void> {
    await this.client.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          id: payload.user.id,
          email: payload.user.email,
          name: payload.user.name,
          isAdmin: payload.user.isAdmin,
          createdAt: new Date(payload.user.createdAt)
        }
      });

      await tx.authCredential.create({
        data: {
          userId: payload.user.id,
          passwordHash: payload.passwordHash
        }
      });

      await tx.profile.create({
        data: {
          userId: payload.profile.userId,
          username: payload.profile.username,
          bio: payload.profile.bio ?? null,
          favoriteTeamId: payload.profile.favoriteTeamId ?? null,
          xp: payload.profile.xp,
          level: payload.profile.level,
          streak: payload.profile.streak,
          onboardingCompleted: payload.profile.onboardingCompleted,
          equippedCosmetics: inputJson(payload.profile.equippedCosmetics)
        }
      });

      await tx.userInventory.create({
        data: {
          userId: payload.user.id,
          cosmeticIds: [],
          badgeIds: [],
          equipped: inputJson({})
        }
      });

      await tx.session.create({
        data: {
          token: payload.sessionHash,
          userId: payload.user.id,
          createdAt: new Date(payload.sessionCreatedAt),
          expiresAt: new Date(payload.sessionExpiresAt)
        }
      });
    });
  }

  async createHashedSession(payload: {
    userId: string;
    sessionHash: string;
    createdAt: string;
    expiresAt: string;
  }): Promise<void> {
    await this.client.session.create({
      data: {
        token: payload.sessionHash,
        userId: payload.userId,
        createdAt: new Date(payload.createdAt),
        expiresAt: new Date(payload.expiresAt)
      }
    });
  }

  async hasAnyAdminUser(): Promise<boolean> {
    const count = await this.client.user.count({
      where: { isAdmin: true }
    });

    return count > 0;
  }

  async completeOnboardingProfile(payload: {
    userId: string;
    username: string;
    favoriteTeamId: string;
  }): Promise<Profile> {
    // Use a transaction to prevent TOCTOU race on username uniqueness (#4)
    try {
      const profile = await this.client.$transaction(async (tx) => {
        const [team, duplicate] = await Promise.all([
          tx.team.findUnique({
            where: { id: payload.favoriteTeamId },
            select: { id: true }
          }),
          tx.profile.findFirst({
            where: {
              username: {
                equals: payload.username,
                mode: "insensitive"
              },
              NOT: {
                userId: payload.userId
              }
            },
            select: {
              userId: true
            }
          })
        ]);

        if (!team) {
          throw new Error("Favorite team not found.");
        }

        if (duplicate) {
          throw new Error("Username is already taken.");
        }

        return tx.profile.update({
          where: { userId: payload.userId },
          data: {
            username: payload.username,
            favoriteTeamId: payload.favoriteTeamId,
            onboardingCompleted: true
          }
        });
      });

      return {
        userId: profile.userId,
        username: profile.username,
        bio: profile.bio ?? undefined,
        favoriteTeamId: profile.favoriteTeamId ?? undefined,
        xp: profile.xp,
        level: profile.level,
        streak: profile.streak,
        onboardingCompleted: profile.onboardingCompleted,
        equippedCosmetics: parseJsonColumn(equippedCosmeticsSchema, profile.equippedCosmetics, "Profile.equippedCosmetics")
      };
    } catch (error) {
      // Handle Prisma unique constraint violation on username (#4)
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new Error("Username is already taken.");
      }
      throw error;
    }
  }

  async findActiveSessionUserId(sessionHash: string, now: string): Promise<string | null> {
    const session = await this.client.session.findUnique({
      where: { token: sessionHash },
      select: {
        userId: true,
        expiresAt: true
      }
    });

    if (!session) {
      return null;
    }

    if (session.expiresAt.getTime() <= new Date(now).getTime()) {
      await this.client.session.delete({
        where: { token: sessionHash }
      }).catch(() => undefined);
      return null;
    }

    return session.userId;
  }

  async deleteSessionByHash(sessionHash: string): Promise<void> {
    await this.client.session.deleteMany({
      where: { token: sessionHash }
    });
  }

  async deleteExpiredSessions(now: string): Promise<void> {
    await this.client.session.deleteMany({
      where: { expiresAt: { lte: new Date(now) } }
    });
  }

  async isUserAdmin(userId: string): Promise<boolean> {
    const user = await this.client.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true }
    });

    return user?.isAdmin ?? false;
  }
}
