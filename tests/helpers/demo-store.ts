import { hashPasswordSync } from "../../apps/api/src/lib/password.ts";
import { createBootstrapStore } from "../../apps/api/src/data/seed.ts";
import type { AppStore } from "../../apps/api/src/data/store.ts";

const hoursFromNow = (hours: number) => new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

export function createDemoSeedStore(): AppStore {
  const base = createBootstrapStore();

  return {
    ...base,
    credentials: [
      {
        userId: "user-1",
        passwordHash: hashPasswordSync("password123"),
        updatedAt: hoursAgo(72)
      },
      {
        userId: "user-2",
        passwordHash: hashPasswordSync("password123"),
        updatedAt: hoursAgo(48)
      }
    ],
    users: [
      {
        id: "user-1",
        email: "captain@cricketclub.test",
        name: "Aisha Singh",
        isAdmin: true,
        createdAt: hoursAgo(72)
      },
      {
        id: "user-2",
        email: "friend@cricketclub.test",
        name: "Rehan Malik",
        isAdmin: false,
        createdAt: hoursAgo(48)
      }
    ],
    profiles: [
      {
        userId: "user-1",
        username: "AishaCovers",
        credits: 100,
        xp: 180,
        level: 2,
        streak: 2,
        onboardingCompleted: true,
        favoriteTeamId: "team-mi",
        equippedCosmetics: {
          "profile-theme": "cos-theme-saffron"
        }
      },
      {
        userId: "user-2",
        username: "LateCutRehan",
        credits: 5,
        xp: 110,
        level: 2,
        streak: 1,
        onboardingCompleted: true,
        favoriteTeamId: "team-csk",
        equippedCosmetics: {}
      }
    ],
    friendships: [
      {
        id: "friend-1",
        requesterId: "user-1",
        addresseeId: "user-2",
        status: "accepted",
        createdAt: hoursAgo(24)
      }
    ],
    invites: [
      {
        id: "invite-1",
        leagueId: "league-1",
        code: "FRND2026",
        createdBy: "user-1",
        createdAt: hoursAgo(12)
      }
    ],
    contests: [
      ...base.contests,
      {
        id: "contest-2",
        name: "Friends League: MI vs CSK",
        kind: "private",
        matchId: "match-1",
        leagueId: "league-1",
        salaryCap: 100,
        rosterRules: base.contests[0].rosterRules,
        iplRules: base.contests[0].iplRules,
        lockTime: hoursFromNow(27),
        rewards: [
          {
            id: "reward-2",
            name: "Private League Title",
            type: "badge",
            value: 1,
            badgeId: "badge-night-watch"
          }
        ]
      }
    ],
    leagues: [
      {
        id: "league-1",
        name: "Weekend XI",
        description: "Private room for friends to run fantasy and prop picks together.",
        visibility: "private",
        createdBy: "user-1",
        inviteCode: "FRND2026",
        memberIds: ["user-1", "user-2"],
        contestIds: ["contest-2"],
        bannerStyle: "midnight-stripe"
      },
      {
        id: "league-2",
        name: "Open Nets",
        description: "Public practice league with cosmetic-only rewards.",
        visibility: "public",
        createdBy: "user-2",
        inviteCode: "OPEN2026",
        memberIds: ["user-1", "user-2"],
        contestIds: ["contest-1"],
        bannerStyle: "sunset-grid"
      }
    ],
    rosters: [
      {
        id: "roster-1",
        contestId: "contest-1",
        userId: "user-2",
        players: [
          { playerId: "p1" },
          { playerId: "p2" },
          { playerId: "p3" },
          { playerId: "p4" },
          { playerId: "p5" },
          { playerId: "p7" },
          { playerId: "p8" },
          { playerId: "p9" },
          { playerId: "p11" },
          { playerId: "p12" },
          { playerId: "p14" }
        ],
        captainPlayerId: "p2",
        viceCaptainPlayerId: "p12",
        totalCredits: 95,
        submittedAt: hoursAgo(2),
        locked: false,
        hasUncappedPlayer: true
      }
    ],
    scoreEvents: [
      { id: "event-1", matchId: "match-1", playerId: "p2", label: "Runs", points: 32, createdAt: hoursAgo(1) },
      { id: "event-2", matchId: "match-1", playerId: "p12", label: "Wickets", points: 25, createdAt: hoursAgo(1) },
      { id: "event-3", matchId: "match-1", playerId: "p4", label: "Catches", points: 8, createdAt: hoursAgo(1) },
      { id: "event-4", matchId: "match-1", playerId: "p9", label: "Runs", points: 14, createdAt: hoursAgo(1) }
    ],
    cosmeticUnlocks: [
      {
        id: "unlock-1",
        userId: "user-1",
        cosmeticId: "cos-theme-saffron",
        source: "seasonal",
        unlockedAt: hoursAgo(3)
      }
    ],
    inventories: [
      {
        userId: "user-1",
        cosmeticIds: ["cos-theme-saffron"],
        badgeIds: ["badge-founder"],
        equipped: {
          "profile-theme": "cos-theme-saffron"
        }
      },
      {
        userId: "user-2",
        cosmeticIds: [],
        badgeIds: [],
        equipped: {}
      }
    ],
    xpTransactions: [
      {
        id: "xp-1",
        userId: "user-1",
        source: "seasonal",
        amount: 80,
        description: "Season setup bonus",
        createdAt: hoursAgo(6)
      }
    ],
    provider: {
      status: "ready",
      syncedAt: hoursAgo(1),
      lastAttemptedAt: hoursAgo(1)
    }
  };
}
