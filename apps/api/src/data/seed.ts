import { defaultRosterRules } from "@fantasy-cricket/domain";
import { hashPasswordSync } from "../lib/password.js";
import type { AppStore } from "./store.js";

const hoursFromNow = (hours: number) => new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

const defaultIplRules = {
  maxPlayersPerTeam: 7 as const,
  allowImpactPlayer: true,
  uncappedBonusPoints: 10
};

export function createSeedStore(): AppStore {
  return {
    sessions: [],
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
        createdAt: hoursAgo(72)
      },
      {
        id: "user-2",
        email: "friend@cricketclub.test",
        name: "Rehan Malik",
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
    teams: [
      {
        id: "team-mi",
        name: "Mumbai Indians",
        shortName: "MI",
        city: "Mumbai"
      },
      {
        id: "team-csk",
        name: "Chennai Super Kings",
        shortName: "CSK",
        city: "Chennai"
      }
    ],
    players: [
      { id: "p1", name: "Arjun Rao", teamId: "team-mi", role: "WK", credits: 9, rating: 88, nationality: "indian-capped", selectionPercent: 45 },
      { id: "p2", name: "Neel Sharma", teamId: "team-mi", role: "BAT", credits: 9.5, rating: 93, nationality: "indian-capped", selectionPercent: 78 },
      { id: "p3", name: "Rohan Iyer", teamId: "team-mi", role: "BAT", credits: 8.5, rating: 84, nationality: "indian-capped", selectionPercent: 52 },
      { id: "p4", name: "Kabir Sen", teamId: "team-mi", role: "AR", credits: 9, rating: 90, nationality: "indian-capped", selectionPercent: 67 },
      { id: "p5", name: "Dev Malhotra", teamId: "team-mi", role: "BOWL", credits: 8.5, rating: 86, nationality: "indian-capped", selectionPercent: 41 },
      { id: "p6", name: "Vivaan Patel", teamId: "team-mi", role: "BOWL", credits: 8, rating: 81, nationality: "indian-uncapped", selectionPercent: 23 },
      { id: "p7", name: "Ishan Batra", teamId: "team-mi", role: "AR", credits: 8.5, rating: 82, nationality: "indian-capped", selectionPercent: 38 },
      { id: "p8", name: "Aarav Mehta", teamId: "team-csk", role: "WK", credits: 8.5, rating: 85, nationality: "indian-capped", selectionPercent: 56 },
      { id: "p9", name: "Samar Joshi", teamId: "team-csk", role: "BAT", credits: 9, rating: 89, nationality: "indian-capped", selectionPercent: 61 },
      { id: "p10", name: "Reyansh Kapoor", teamId: "team-csk", role: "BAT", credits: 8, rating: 80, nationality: "indian-uncapped", selectionPercent: 19 },
      { id: "p11", name: "Kunal Desai", teamId: "team-csk", role: "AR", credits: 8.5, rating: 87, nationality: "indian-capped", selectionPercent: 44 },
      { id: "p12", name: "Pranav Gill", teamId: "team-csk", role: "BOWL", credits: 9, rating: 91, nationality: "overseas", selectionPercent: 72 },
      { id: "p13", name: "Tanish Ali", teamId: "team-csk", role: "BOWL", credits: 8, rating: 79, nationality: "indian-uncapped", selectionPercent: 15 },
      { id: "p14", name: "Yuvraj Nanda", teamId: "team-csk", role: "BAT", credits: 7.5, rating: 77, nationality: "indian-uncapped", selectionPercent: 12 }
    ],
    matches: [
      {
        id: "match-1",
        homeTeamId: "team-mi",
        awayTeamId: "team-csk",
        startsAt: hoursFromNow(28),
        venue: "Wankhede Stadium",
        state: "scheduled"
      }
    ],
    contests: [
      {
        id: "contest-1",
        name: "Mumbai Indians vs Chennai Super Kings",
        kind: "public",
        matchId: "match-1",
        salaryCap: 100,
        rosterRules: defaultRosterRules,
        iplRules: defaultIplRules,
        lockTime: hoursFromNow(27),
        rewards: [
          {
            id: "reward-1",
            name: "Matchday Aura",
            type: "cosmetic",
            value: 1,
            cosmeticId: "cos-theme-neon"
          }
        ]
      },
      {
        id: "contest-2",
        name: "Friends League: MI vs CSK",
        kind: "private",
        matchId: "match-1",
        leagueId: "league-1",
        salaryCap: 100,
        rosterRules: defaultRosterRules,
        iplRules: defaultIplRules,
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
    leaderboard: [],
    questions: [
      {
        id: "question-1",
        matchId: "match-1",
        prompt: "Which side wins the match?",
        category: "winner",
        options: [
          { id: "question-1-a", label: "Mumbai Indians", value: "team-mi" },
          { id: "question-1-b", label: "Chennai Super Kings", value: "team-csk" }
        ],
        locksAt: hoursFromNow(27),
        resolvesAt: hoursFromNow(31),
        state: "open",
        xpReward: 30,
        badgeRewardId: "badge-night-watch"
      },
      {
        id: "question-2",
        matchId: "match-1",
        prompt: "Who scores the most fantasy points?",
        category: "player-performance",
        options: [
          { id: "question-2-a", label: "Kabir Sen", value: "p4" },
          { id: "question-2-b", label: "Pranav Gill", value: "p12" },
          { id: "question-2-c", label: "Samar Joshi", value: "p9" }
        ],
        locksAt: hoursFromNow(27),
        resolvesAt: hoursFromNow(31),
        state: "open",
        xpReward: 40,
        cosmeticRewardId: "cos-frame-copper"
      }
    ],
    answers: [],
    results: [],
    cosmetics: [
      {
        id: "cos-theme-saffron",
        name: "Saffron Pulse",
        description: "Warm scoreboard gradient for your profile.",
        category: "profile-theme",
        rarity: "rare",
        themeToken: "#ff8c42",
        gameplayAffecting: false,
        transferable: false,
        redeemable: false,
        resaleValue: 0
      },
      {
        id: "cos-theme-neon",
        name: "Night Neon",
        description: "Electric profile theme for top matchday finishes.",
        category: "profile-theme",
        rarity: "epic",
        themeToken: "#62f6ff",
        gameplayAffecting: false,
        transferable: false,
        redeemable: false,
        resaleValue: 0
      },
      {
        id: "cos-frame-copper",
        name: "Copper Frame",
        description: "Avatar frame for correctly calling player props.",
        category: "avatar-frame",
        rarity: "common",
        themeToken: "#b87333",
        gameplayAffecting: false,
        transferable: false,
        redeemable: false,
        resaleValue: 0
      }
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
    badges: [
      {
        id: "badge-founder",
        label: "Founding Captain",
        description: "Joined the club before the first toss.",
        category: "seasonal"
      },
      {
        id: "badge-night-watch",
        label: "Night Watch",
        description: "Called the winner before first ball.",
        category: "streak"
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
