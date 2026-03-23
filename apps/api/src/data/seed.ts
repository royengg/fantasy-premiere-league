import { defaultRosterRules } from "@fantasy-cricket/domain";

import type { AppStore } from "./store.js";

const hoursFromNow = (hours: number) => new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

export function createBootstrapStore(): AppStore {
  return {
    sessions: [],
    credentials: [],
    users: [],
    profiles: [],
    friendships: [],
    invites: [],
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
      { id: "p1", name: "Arjun Rao", teamId: "team-mi", role: "WK", rating: 88, nationality: "indian-capped", selectionPercent: 45 },
      { id: "p2", name: "Neel Sharma", teamId: "team-mi", role: "BAT", rating: 93, nationality: "indian-capped", selectionPercent: 78 },
      { id: "p3", name: "Rohan Iyer", teamId: "team-mi", role: "BAT", rating: 84, nationality: "indian-capped", selectionPercent: 52 },
      { id: "p4", name: "Kabir Sen", teamId: "team-mi", role: "AR", rating: 90, nationality: "indian-capped", selectionPercent: 67 },
      { id: "p5", name: "Dev Malhotra", teamId: "team-mi", role: "BOWL", rating: 86, nationality: "indian-capped", selectionPercent: 41 },
      { id: "p6", name: "Vivaan Patel", teamId: "team-mi", role: "BOWL", rating: 81, nationality: "indian-uncapped", selectionPercent: 23 },
      { id: "p7", name: "Ishan Batra", teamId: "team-mi", role: "AR", rating: 82, nationality: "indian-capped", selectionPercent: 38 },
      { id: "p8", name: "Aarav Mehta", teamId: "team-csk", role: "WK", rating: 85, nationality: "indian-capped", selectionPercent: 56 },
      { id: "p9", name: "Samar Joshi", teamId: "team-csk", role: "BAT", rating: 89, nationality: "indian-capped", selectionPercent: 61 },
      { id: "p10", name: "Reyansh Kapoor", teamId: "team-csk", role: "BAT", rating: 80, nationality: "indian-uncapped", selectionPercent: 19 },
      { id: "p11", name: "Kunal Desai", teamId: "team-csk", role: "AR", rating: 87, nationality: "indian-capped", selectionPercent: 44 },
      { id: "p12", name: "Pranav Gill", teamId: "team-csk", role: "BOWL", rating: 91, nationality: "overseas", selectionPercent: 72 },
      { id: "p13", name: "Tanish Ali", teamId: "team-csk", role: "BOWL", rating: 79, nationality: "indian-uncapped", selectionPercent: 15 },
      { id: "p14", name: "Yuvraj Nanda", teamId: "team-csk", role: "BAT", rating: 77, nationality: "indian-uncapped", selectionPercent: 12 }
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
        rosterRules: defaultRosterRules,
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
      }
    ],
    leagues: [
      {
        id: "league-public-1",
        name: "Open Nets",
        description: "Public practice league with cosmetic-only rewards.",
        visibility: "public",
        createdBy: "system",
        inviteCode: "OPEN2026",
        memberIds: [],
        contestIds: ["contest-1"],
        bannerStyle: "sunset-grid",
        mode: "season",
        maxMembers: 15,
        squadSize: 13
      }
    ],
    rosters: [],
    playerMatchStatLines: [],
    scoreEvents: [],
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
    cosmeticUnlocks: [],
    inventories: [],
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
    xpTransactions: [],
    provider: {
      status: "idle",
      syncedAt: new Date(0).toISOString(),
      lastAttemptedAt: new Date(0).toISOString(),
      requestDayKey: "",
      dailyRequestCount: 0
    }
  };
}
